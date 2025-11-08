import redis from '../utils/redis.js';
import logger from '../utils/logger.js';
import { LRUCache } from 'lru-cache';

export interface CacheOptions {
  scope: string;
  key: string;
  version?: string;
}

export interface InvalidationMessage {
  scope: string;
  key: string;
  version: string;
  timestamp: number;
}

export interface WarmupEntry {
  options: CacheOptions;
  loader: () => Promise<any>;
}

export interface CacheStats {
  memoryCache: {
    size: number;
    itemCount: number;
  };
  versionCache: {
    size: number;
  };
}

export class ConfigCacheService {
  private memoryCache: LRUCache<string, any>;
  private readonly CACHE_PREFIX = 'cms:config:';
  private readonly INVALIDATE_CHANNEL = 'cms:invalidate';
  private versionCache: Map<string, number>;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.memoryCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 30,
      updateAgeOnGet: true
    });

    this.versionCache = new Map();
    this.initRedisSubscription();
  }

  async getOrSet(options: CacheOptions, fetcher: () => Promise<any>): Promise<any> {
    const { scope, key, version = 'latest' } = options;
    const cacheKey = this.buildCacheKey(scope, key, version);

    try {
      let data = this.memoryCache.get(cacheKey);
      if (data !== undefined) {
        logger.debug(`Cache hit (L1): ${cacheKey}`);
        return data;
      }

      const cached = await redis.get(cacheKey);
      if (cached) {
        data = JSON.parse(cached);
        this.memoryCache.set(cacheKey, data);
        logger.debug(`Cache hit (L2): ${cacheKey}`);
        return data;
      }

      const snapshotData = await this.getSnapshot(scope, key, version);
      if (snapshotData) {
        data = snapshotData;
        this.memoryCache.set(cacheKey, data);
        await redis.setex(cacheKey, 300, JSON.stringify(data));
        logger.debug(`Cache hit (L3 - Snapshot): ${cacheKey}`);
        return data;
      }

      data = await fetcher();

      this.memoryCache.set(cacheKey, data);
      await redis.setex(cacheKey, 300, JSON.stringify(data));
      await this.saveSnapshot(scope, key, version, data);

      logger.debug(`Cache miss and fetched: ${cacheKey}`);
      return data;
    } catch (error: any) {
      logger.error(`Cache error for ${cacheKey}:`, error);
      const snapshotData = await this.getSnapshot(scope, key, version);
      if (snapshotData) {
        return snapshotData;
      }
      throw error;
    }
  }

  async invalidate(scope: string, key: string, version: string): Promise<void> {
    const invalidationKey = this.buildInvalidationKey(scope, key, version);

    try {
      this.versionCache.set(invalidationKey, Date.now());

      const patterns = [
        this.buildCacheKey(scope, key, version),
        this.buildCacheKey(scope, key, 'latest')
      ];

      patterns.forEach((pattern) => {
        this.memoryCache.delete(pattern);
      });

      const redisPattern = `${this.CACHE_PREFIX}${scope}:${key}:*`;
      const keys = await redis.keys(redisPattern);
      if (keys.length > 0) {
        await Promise.all(keys.map((k) => redis.del(k)));
      }

      await this.publishInvalidation(scope, key, version);

      logger.info(`Cache invalidated: ${scope}:${key}:${version}`);
    } catch (error: any) {
      logger.error(`Cache invalidation error for ${scope}:${key}:${version}:`, error);
    }
  }

  async invalidateScope(scope: string): Promise<void> {
    try {
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(`${this.CACHE_PREFIX}${scope}:`)) {
          this.memoryCache.delete(key);
        }
      }

      const redisPattern = `${this.CACHE_PREFIX}${scope}:*`;
      const keys = await redis.keys(redisPattern);
      if (keys.length > 0) {
        await Promise.all(keys.map((k) => redis.del(k)));
      }

      await this.publishInvalidation(scope, '*', '*');

      logger.info(`Cache scope invalidated: ${scope}`);
    } catch (error: any) {
      logger.error(`Cache scope invalidation error for ${scope}:`, error);
    }
  }

  getStats(): CacheStats {
    return {
      memoryCache: {
        size: this.memoryCache.size,
        itemCount: this.memoryCache.size
      },
      versionCache: {
        size: this.versionCache.size
      }
    };
  }

  async initRedisSubscription(): Promise<void> {
    try {
      if (this.unsubscribe) {
        return;
      }

      this.unsubscribe = await redis.subscribe(this.INVALIDATE_CHANNEL, (message: string) => {
        if (!message) {
          return;
        }
        this.handleInvalidation(message);
      });

      logger.info(`[ConfigCache] Subscribed to ${this.INVALIDATE_CHANNEL}`);
    } catch (error: any) {
      logger.warn('Failed to initialize Redis subscription:', error);
    }
  }

  async publishInvalidation(scope: string, key: string, version: string): Promise<void> {
    try {
      const message: InvalidationMessage = {
        scope,
        key,
        version,
        timestamp: Date.now()
      };

      await redis.publish(this.INVALIDATE_CHANNEL, JSON.stringify(message));
    } catch (error: any) {
      logger.error('Failed to publish invalidation:', error);
    }
  }

  handleInvalidation(message: string): void {
    try {
      const { scope, key, version } = JSON.parse(message) as InvalidationMessage;

      const patterns = [
        this.buildCacheKey(scope, key, version),
        this.buildCacheKey(scope, key, 'latest')
      ];

      patterns.forEach((pattern) => {
        this.memoryCache.delete(pattern);
      });

      logger.debug(`Handled invalidation broadcast: ${scope}:${key}:${version}`);
    } catch (error: any) {
      logger.error('Error handling invalidation broadcast:', error);
    }
  }

  buildCacheKey(scope: string, key: string, version: string): string {
    return `${this.CACHE_PREFIX}${scope}:${key}:${version}`;
  }

  buildInvalidationKey(scope: string, key: string, version: string): string {
    return `${scope}:${key}:${version}`;
  }

  async saveSnapshot(scope: string, key: string, version: string, data: any): Promise<void> {
    const snapshotKey = `snapshot:${this.buildCacheKey(scope, key, version)}`;
    try {
      await redis.setex(snapshotKey, 3600, JSON.stringify(data));
    } catch (error: any) {
      logger.warn('Failed to save snapshot:', error);
    }
  }

  async getSnapshot(scope: string, key: string, version: string): Promise<any> {
    const snapshotKey = `snapshot:${this.buildCacheKey(scope, key, version)}`;
    try {
      const snapshot = await redis.get(snapshotKey);
      return snapshot ? JSON.parse(snapshot) : null;
    } catch (error: any) {
      logger.warn('Failed to get snapshot:', error);
      return null;
    }
  }

  async warmup(dataLoaders: any): Promise<void> {
    if (!dataLoaders) {
      return;
    }

    logger.info('Starting cache warmup...');

    let entries: WarmupEntry[] = [];

    if (Array.isArray(dataLoaders)) {
      entries = dataLoaders;
    } else {
      const mappedEntries: (WarmupEntry | null)[] = Object.entries(dataLoaders ?? {}).map(
        ([descriptor, loader]: [string, any]) => {
          if (typeof loader === 'function') {
            const [scope, key, version] = descriptor.split(':');
            if (!scope || !key) {
              return null;
            }

            const entry: WarmupEntry = {
              options: {
                scope,
                key,
                version: version || 'latest'
              },
              loader
            };

            return entry;
          }

          if (loader && typeof loader === 'object' && typeof loader.loader === 'function') {
            const entry: WarmupEntry = {
              options: {
                scope: loader.scope,
                key: loader.key,
                version: loader.version || 'latest'
              },
              loader: loader.loader
            };

            return entry;
          }

          return null;
        }
      );

      entries = mappedEntries.filter(
        (entry): entry is WarmupEntry => entry !== null && typeof entry.loader === 'function'
      );
    }

    for (const entry of entries) {
      const { options, loader } = entry;
      if (!options?.scope || !options?.key || typeof loader !== 'function') {
        logger.warn('[ConfigCache] Invalid warmup entry, skip', { entry });
        continue;
      }

      try {
        await this.getOrSet(options, loader);
        logger.debug(`[ConfigCache] Warmed cache: ${options.scope}:${options.key}`);
      } catch (error: any) {
        logger.warn(`[ConfigCache] Warmup failed for ${options.scope}:${options.key}`, error);
      }
    }

    logger.info('Cache warmup completed');
  }
}

const configCacheService = new ConfigCacheService();

export default configCacheService;
