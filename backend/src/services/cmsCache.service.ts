import { db } from '../config/database.js';
import redis from '../utils/redis.js';
import logger from '../utils/logger.js';

interface CacheOptions {
  version?: string;
  ttl?: number;
}

interface MemoryCacheEntry<T> {
  data: T;
  timestamp: number;
}

interface SnapshotRecord {
  scope: string;
  key: string;
  version: string;
  data: string;
  action: string;
  description?: string;
  created_at: Date;
}

type Loader<T> = () => Promise<T>;

interface WarmupDescriptor {
  options: {
    scope: string;
    key: string;
    version?: string;
  };
  loader: Loader<unknown>;
}

type WarmupSource =
  | Record<
      string,
      Loader<unknown> | { scope: string; key: string; version?: string; loader: Loader<unknown> }
    >
  | WarmupDescriptor[]
  | undefined;

class CmsCacheService {
  private readonly CACHE_PREFIX = 'cms:cache:';
  private readonly SNAPSHOT_PREFIX = 'cms:snapshot:';
  private readonly INVALIDATE_CHANNEL = 'cms:invalidate';
  private readonly memoryCache = new Map<string, MemoryCacheEntry<unknown>>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 分钟
  private readonly versionCache = new Map<string, number>();
  private unsubscribe: (() => Promise<void>) | null = null;
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.initSubscription().catch((error) => {
      logger.error('[CmsCacheService] 初始化订阅失败', { error });
    });

    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    this.cleanupTimer.unref?.();
  }

  async getOrSet<T>(
    scope: string,
    key: string,
    fetcher: Loader<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const version = options.version ?? 'latest';
    const ttl = options.ttl ?? 300;
    const cacheKey = this.buildCacheKey(scope, key, version);
    const memoryKey = this.buildMemoryKey(scope, key, version);

    try {
      const memoryEntry = this.memoryCache.get(memoryKey) as MemoryCacheEntry<T> | undefined;
      if (memoryEntry && Date.now() - memoryEntry.timestamp < this.cacheTimeout) {
        logger.debug('[CmsCacheService] 内存缓存命中', { cacheKey });
        return memoryEntry.data;
      }

      const cached = await redis.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached) as T;
        this.memoryCache.set(memoryKey, { data, timestamp: Date.now() });
        logger.debug('[CmsCacheService] Redis 缓存命中', { cacheKey });
        return data;
      }

      const snapshot = await this.getSnapshot<T>(scope, key, version);
      if (snapshot) {
        this.memoryCache.set(memoryKey, { data: snapshot, timestamp: Date.now() });
        await redis.setex(cacheKey, ttl, JSON.stringify(snapshot));
        logger.debug('[CmsCacheService] 快照命中', { cacheKey });
        return snapshot;
      }

      const data = await fetcher();

      this.memoryCache.set(memoryKey, { data, timestamp: Date.now() });
      await redis.setex(cacheKey, ttl, JSON.stringify(data));
      await this.saveSnapshot(scope, key, version, data);

      logger.debug('[CmsCacheService] 缓存缺失，回源成功', { cacheKey });
      return data;
    } catch (error) {
      logger.error('[CmsCacheService] 缓存读取失败', { cacheKey, error });
      const snapshot = await this.getSnapshot<T>(scope, key, version);
      if (snapshot) {
        return snapshot;
      }
      throw error;
    }
  }

  async invalidate(scope: string, key: string, version: string = 'latest'): Promise<void> {
    const invalidationKey = this.buildInvalidationKey(scope, key, version);
    this.versionCache.set(invalidationKey, Date.now());

    const memoryPatterns = [
      this.buildMemoryKey(scope, key, version),
      this.buildMemoryKey(scope, key, 'latest')
    ];

    for (const pattern of memoryPatterns) {
      this.memoryCache.delete(pattern);
    }

    const redisPattern =
      key === '*' ? `${this.CACHE_PREFIX}${scope}:*` : `${this.CACHE_PREFIX}${scope}:${key}:*`;

    const keys = await redis.keys(redisPattern);
    if (keys.length > 0) {
      await Promise.all(keys.map((cacheKey) => redis.del(cacheKey)));
    }

    await this.publishInvalidation(scope, key, version);
    logger.info('[CmsCacheService] 缓存失效', { scope, key, version });
  }

  async invalidateScope(scope: string): Promise<void> {
    await this.invalidate(scope, '*');
  }

  async saveSnapshot(scope: string, key: string, version: string, data: unknown): Promise<void> {
    const snapshotKey = `${this.SNAPSHOT_PREFIX}${scope}:${key}:${version}`;
    try {
      await redis.setex(snapshotKey, 3600, JSON.stringify(data));
    } catch (error) {
      logger.warn('[CmsCacheService] 保存快照失败', { scope, key, version, error });
    }
  }

  async getSnapshot<T>(scope: string, key: string, version: string): Promise<T | null> {
    const snapshotKey = `${this.SNAPSHOT_PREFIX}${scope}:${key}:${version}`;
    try {
      const snapshot = await redis.get(snapshotKey);
      return snapshot ? (JSON.parse(snapshot) as T) : null;
    } catch (error) {
      logger.warn('[CmsCacheService] 读取快照失败', { scope, key, version, error });
      return null;
    }
  }

  async publishInvalidation(scope: string, key: string, version: string): Promise<void> {
    try {
      const message = JSON.stringify({
        scope,
        key,
        version,
        timestamp: Date.now()
      });
      await redis.publish(this.INVALIDATE_CHANNEL, message);
    } catch (error) {
      logger.error('[CmsCacheService] 发布缓存失效消息失败', { scope, key, version, error });
    }
  }

  async initSubscription(): Promise<void> {
    if (this.unsubscribe) {
      return;
    }

    try {
      this.unsubscribe = await redis.subscribe(this.INVALIDATE_CHANNEL, (payload) => {
        if (!payload) {
          return;
        }
        this.handleInvalidation(payload);
      });
      logger.info('[CmsCacheService] 已订阅缓存失效频道');
    } catch (error) {
      logger.warn('[CmsCacheService] 订阅缓存失效频道失败', { error });
    }
  }

  handleInvalidation(message: string): void {
    try {
      const { scope, key, version } = JSON.parse(message) as {
        scope: string;
        key: string;
        version: string;
      };

      const memoryKeys = Array.from(this.memoryCache.keys());
      for (const memoryKey of memoryKeys) {
        if (!memoryKey.startsWith(`${scope}:`)) {
          continue;
        }

        if (key === '*' || memoryKey.includes(`:${key}:`)) {
          this.memoryCache.delete(memoryKey);
        } else if (version !== 'latest' && memoryKey.endsWith(`:${version}`)) {
          this.memoryCache.delete(memoryKey);
        }
      }

      logger.debug('[CmsCacheService] 处理失效消息完成', { scope, key, version });
    } catch (error) {
      logger.error('[CmsCacheService] 处理失效消息失败', { error });
    }
  }

  async createSnapshot(
    scope: string,
    key: string,
    data: unknown,
    action: string,
    description: string,
    userId: string
  ): Promise<string> {
    const version = await this.generateVersion(scope, key);

    await db('config_snapshots').insert({
      scope,
      key,
      version,
      data: JSON.stringify(data),
      action,
      description,
      created_by: userId,
      created_at: new Date()
    });

    await this.updateDataVersion(scope, key, version, data);
    await this.invalidate(scope, key);

    logger.info('[CmsCacheService] 创建快照成功', { scope, key, version, action });
    return version;
  }

  async rollback(scope: string, key: string, version: string, userId: string): Promise<unknown> {
    const snapshot = (await db('config_snapshots').where({ scope, key, version }).first()) as
      | SnapshotRecord
      | undefined;

    if (!snapshot) {
      throw new Error(`Snapshot not found: ${scope}:${key}:${version}`);
    }

    const data = JSON.parse(snapshot.data) as unknown;

    await this.createSnapshot(scope, key, data, 'rollback', `回滚到版本 ${version}`, userId);

    logger.info('[CmsCacheService] 回滚完成', { scope, key, version });
    return data;
  }

  async generateVersion(scope: string, key: string): Promise<string> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 7);
    const version = `v${timestamp}-${random}`;
    return version;
  }

  async updateDataVersion(
    scope: string,
    key: string,
    version: string,
    data: unknown
  ): Promise<void> {
    if (scope !== 'features') {
      return;
    }

    await db('cms_features')
      .where('key', key)
      .update({
        version,
        config: JSON.stringify(data),
        updated_at: new Date()
      });
  }

  async warmup(source: WarmupSource): Promise<void> {
    if (!source) {
      return;
    }

    let entries: WarmupDescriptor[] = [];

    if (Array.isArray(source)) {
      entries = source;
    } else {
      const mappedEntries: (WarmupDescriptor | null)[] = Object.entries(source ?? {}).map(
        ([descriptor, value]) => {
          if (typeof value === 'function') {
            const [scope, key, version] = descriptor.split(':');
            if (!scope || !key) {
              return null;
            }

            const descriptorEntry: WarmupDescriptor = {
              options: { scope, key, version },
              loader: value as Loader<unknown>
            };
            return descriptorEntry;
          }

          if (value && typeof value === 'object' && 'loader' in value) {
            const descriptorEntry: WarmupDescriptor = {
              options: {
                scope: value.scope,
                key: value.key,
                version: value.version
              },
              loader: value.loader as Loader<unknown>
            };
            return descriptorEntry;
          }

          return null;
        }
      );

      entries = mappedEntries.filter(
        (entry): entry is WarmupDescriptor => entry !== null && typeof entry.loader === 'function'
      );
    }

    for (const { options, loader } of entries) {
      if (!options.scope || !options.key || typeof loader !== 'function') {
        logger.warn('[CmsCacheService] 无效的预热配置，已跳过', { options });
        continue;
      }

      try {
        await this.getOrSet(options.scope, options.key, loader, {
          version: options.version,
          ttl: 300
        });
        logger.debug('[CmsCacheService] 预热完成', { options });
      } catch (error) {
        logger.warn('[CmsCacheService] 预热失败', { options, error });
      }
    }
  }

  getStats(): { memoryCacheSize: number; versionCacheSize: number } {
    return {
      memoryCacheSize: this.memoryCache.size,
      versionCacheSize: this.versionCache.size
    };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.memoryCache.delete(key);
      }
    }
  }

  private buildCacheKey(scope: string, key: string, version: string): string {
    return `${this.CACHE_PREFIX}${scope}:${key}:${version}`;
  }

  private buildMemoryKey(scope: string, key: string, version: string): string {
    return `${scope}:${key}:${version}`;
  }

  private buildInvalidationKey(scope: string, key: string, version: string): string {
    return `${scope}:${key}:${version}`;
  }
}

export const cmsCacheService = new CmsCacheService();
export default cmsCacheService;
