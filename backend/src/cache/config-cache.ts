import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { LRUCache } from 'lru-cache';

import logger from '../utils/logger.js';
import redisManager from '../utils/redis.js';

export interface CacheOptions {
  scope: string;
  key: string;
  version?: string;
  lruTtl?: number;
  redisTtl?: number;
  useSnapshot?: boolean;
}

interface CacheEntry<T> {
  data: T;
  version: string;
  timestamp: number;
  lruExpiry: number;
  redisExpiry: number;
}

interface InvalidationPayload {
  scope: string;
  key?: string;
  version: string;
  timestamp: number;
}

interface SnapshotRecord<T = unknown> {
  version: string;
  timestamp: number;
  expiry?: number;
  checksum: string;
  data: T;
}

type SnapshotStore = Record<string, SnapshotRecord>;

const SNAPSHOT_FILENAME = process.env.CONFIG_SNAPSHOT_PATH ?? './data/config-snapshots.json';

class ConfigCacheService {
  private readonly lruCache = new LRUCache<string, CacheEntry<unknown>>({
    max: 1000,
    ttl: 30 * 1000,
    updateAgeOnGet: true,
    allowStale: true
  });

  private readonly invalidationChannel = 'cfg:invalidate';
  private isInitialized = false;
  private unsubscribe: (() => Promise<void>) | null = null;

  constructor(private readonly snapshotPath: string = SNAPSHOT_FILENAME) {
    this.initialize().catch((error) => {
      logger.error('Config cache initialize failed', { error });
    });
  }

  private async initialize(): Promise<void> {
    try {
      const snapshotDir = path.dirname(this.snapshotPath);
      if (!fs.existsSync(snapshotDir)) {
        fs.mkdirSync(snapshotDir, { recursive: true });
      }

      if (!fs.existsSync(this.snapshotPath)) {
        fs.writeFileSync(this.snapshotPath, JSON.stringify({}));
      }

      if (!this.unsubscribe) {
        this.unsubscribe = await redisManager.subscribe(
          this.invalidationChannel,
          async (message) => {
            if (!message) return;
            await this.handleInvalidation(message);
          }
        );
      }

      this.isInitialized = true;
      logger.info('[ConfigCache] initialized');
    } catch (error) {
      logger.error('[ConfigCache] 初始化失败，进入降级模式', { error });
      this.isInitialized = false;
    }
  }

  async getOrSet<T>(options: CacheOptions, fetcher: () => Promise<T>): Promise<T> {
    const {
      scope,
      key,
      version = '1.0.0',
      lruTtl = 30,
      redisTtl = 300,
      useSnapshot = true
    } = options;
    const cacheKey = this.buildCacheKey(scope, key, version);

    try {
      const lruEntry = this.lruCache.get(cacheKey) as CacheEntry<T> | undefined;
      if (lruEntry && !this.isExpired(lruEntry.lruExpiry)) {
        logger.debug(`[ConfigCache] LRU hit ${scope}:${key}`);
        return lruEntry.data;
      }

      const redisData = await this.getFromRedis<T>(cacheKey, version);
      if (redisData) {
        this.setLRU(cacheKey, redisData, lruTtl, redisTtl, version);
        logger.debug(`[ConfigCache] Redis hit ${scope}:${key}`);
        return redisData;
      }

      if (useSnapshot) {
        const snapshot = await this.readSnapshot<T>(cacheKey, version);
        if (snapshot) {
          logger.warn(`[ConfigCache] snapshot fallback ${scope}:${key}`);
          this.setLRU(cacheKey, snapshot, lruTtl, redisTtl, version);
          return snapshot;
        }
      }

      const freshData = await fetcher();
      await this.setAllLayers(cacheKey, freshData, {
        scope,
        key,
        version,
        lruTtl,
        redisTtl
      });
      logger.debug(`[ConfigCache] fetch success ${scope}:${key}`);
      return freshData;
    } catch (error) {
      logger.error('[ConfigCache] getOrSet failed', { scope, key, error });
      throw error;
    }
  }

  async invalidate(scope: string, key?: string, version = '1.0.0'): Promise<void> {
    const payload: InvalidationPayload = {
      scope,
      key,
      version,
      timestamp: Date.now()
    };

    try {
      await redisManager.publish(this.invalidationChannel, JSON.stringify(payload));
      logger.info(`[ConfigCache] broadcast invalidation ${scope}:${key ?? '*'}`);
    } catch (error) {
      logger.error('[ConfigCache] broadcast invalidation failed, fallback local', { error });
      await this.handleInvalidation(JSON.stringify(payload));
    }
  }

  async clear(): Promise<void> {
    this.lruCache.clear();
    const keys = await redisManager.keys('config:*');
    if (keys.length > 0) {
      await redisManager.del(...keys);
    }
    logger.info('[ConfigCache] 全部缓存清理完成');
  }

  getStats(): Record<string, unknown> {
    return {
      lru: {
        size: this.lruCache.size,
        maxSize: this.lruCache.max
      },
      snapshotPath: this.snapshotPath,
      isInitialized: this.isInitialized
    };
  }

  // ===== 内部实现 =====
  private setLRU<T>(
    cacheKey: string,
    data: T,
    lruTtlSeconds: number,
    redisTtlSeconds: number,
    version: string
  ): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      version,
      timestamp: now,
      lruExpiry: now + lruTtlSeconds * 1000,
      redisExpiry: now + redisTtlSeconds * 1000
    };
    this.lruCache.set(cacheKey, entry, { ttl: lruTtlSeconds * 1000 });
  }

  private async setAllLayers<T>(
    cacheKey: string,
    data: T,
    options: Required<Pick<CacheOptions, 'scope' | 'key' | 'version' | 'lruTtl' | 'redisTtl'>>
  ): Promise<void> {
    const { scope, key, version, lruTtl, redisTtl } = options;
    this.setLRU(cacheKey, data, lruTtl, redisTtl, version);
    await this.setRedis(cacheKey, data, redisTtl, version);
    await this.saveSnapshot(cacheKey, data, version, redisTtl);
    logger.info(`[ConfigCache] 数据写入多层缓存 ${scope}:${key}`);
  }

  private async getFromRedis<T>(cacheKey: string, version: string): Promise<T | null> {
    const payload = await redisManager.get(cacheKey);
    if (!payload) return null;

    try {
      const parsed = JSON.parse(payload) as CacheEntry<T>;
      if (parsed.version !== version) {
        logger.debug(`[ConfigCache] Redis版本不匹配 ${cacheKey}`);
        return null;
      }
      if (this.isExpired(parsed.redisExpiry)) {
        return null;
      }
      return parsed.data;
    } catch (error) {
      logger.error('[ConfigCache] Redis数据解析失败', { cacheKey, error });
      return null;
    }
  }

  private async setRedis<T>(
    cacheKey: string,
    data: T,
    ttlSeconds: number,
    version: string
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      version,
      timestamp: Date.now(),
      lruExpiry: Date.now() + ttlSeconds * 1000,
      redisExpiry: Date.now() + ttlSeconds * 1000
    };
    await redisManager.setex(cacheKey, ttlSeconds, JSON.stringify(entry));
  }

  private async readSnapshot<T>(cacheKey: string, version: string): Promise<T | null> {
    try {
      const content = fs.readFileSync(this.snapshotPath, 'utf8');
      if (!content) return null;
      const snapshots = JSON.parse(content) as SnapshotStore;
      const record = snapshots[cacheKey] as SnapshotRecord<T> | undefined;
      if (!record) return null;
      if (record.version !== version) return null;
      if (record.expiry && this.isExpired(record.expiry)) return null;
      return record.data;
    } catch (error) {
      logger.error('[ConfigCache] 读取快照失败', { error });
      return null;
    }
  }

  private async saveSnapshot<T>(
    cacheKey: string,
    data: T,
    version: string,
    ttlSeconds: number
  ): Promise<void> {
    try {
      const content = fs.existsSync(this.snapshotPath)
        ? fs.readFileSync(this.snapshotPath, 'utf8')
        : '{}';
      const snapshots = JSON.parse(content) as SnapshotStore;

      const serialized = JSON.stringify(data);
      const record: SnapshotRecord<T> = {
        version,
        timestamp: Date.now(),
        expiry: Date.now() + ttlSeconds * 1000,
        checksum: crypto.createHash('md5').update(serialized).digest('hex'),
        data
      };

      snapshots[cacheKey] = record as SnapshotRecord;
      this.cleanupExpiredSnapshots(snapshots);

      fs.writeFileSync(this.snapshotPath, JSON.stringify(snapshots, null, 2));
    } catch (error) {
      logger.error('[ConfigCache] 保存快照失败', { error });
    }
  }

  private cleanupExpiredSnapshots(store: SnapshotStore): void {
    const now = Date.now();
    Object.keys(store).forEach((cacheKey: string) => {
      const record = store[cacheKey];
      if (record?.expiry && record.expiry < now) {
        delete store[cacheKey];
      }
    });
  }

  private buildCacheKey(scope: string, key: string, version: string): string {
    return `config:${scope}:${key}:${version}`;
  }

  private isExpired(expiry: number | undefined): boolean {
    if (!expiry) return false;
    return Date.now() > expiry;
  }

  private async handleInvalidation(message: string): Promise<void> {
    try {
      const payload = JSON.parse(message) as InvalidationPayload;
      const { scope, key, version } = payload;
      logger.debug(`[ConfigCache] 接收失效消息 ${scope}:${key ?? '*'}`);

      if (key) {
        const cacheKey = this.buildCacheKey(scope, key, version);
        this.lruCache.delete(cacheKey);
        await redisManager.del(cacheKey);
      } else {
        const pattern = `config:${scope}:*`;
        for (const cacheKey of this.lruCache.keys()) {
          if (cacheKey.startsWith(`config:${scope}:`)) {
            this.lruCache.delete(cacheKey);
          }
        }
        const keys = await redisManager.keys(pattern);
        if (keys.length > 0) {
          await redisManager.del(...keys);
        }
      }
    } catch (error) {
      logger.error('[ConfigCache] 处理失效消息失败', { error });
    }
  }
}

const configCacheService = new ConfigCacheService();

export default configCacheService;
