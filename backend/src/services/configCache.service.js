const redis = require('../utils/redis');
const logger = require('../utils/logger');
const LRU = require('lru-cache');

/**
 * 配置缓存服务 - CMS核心基础设施
 * 实现多层缓存：LRU(内存) → Redis → 快照 → DB
 * 支持失效广播和版本化
 */
class ConfigCacheService {
  constructor() {
    // L1: 内存LRU缓存 (30秒TTL)
    this.memoryCache = new LRU({
      max: 1000,
      ttl: 1000 * 30, // 30秒
      updateAgeOnGet: true
    });

    // 缓存键前缀
    this.CACHE_PREFIX = 'cms:config:';
    this.INVALIDATE_CHANNEL = 'cms:invalidate';

    // 版本号缓存，防止快速连续变更
    this.versionCache = new Map();
    this.unsubscribe = null;

    // 初始化Redis订阅
    this.initRedisSubscription();
  }

  /**
   * 获取或设置缓存
   * @param {Object} options - 缓存选项
   * @param {Function} fetcher - 数据获取函数
   * @returns {Promise<any>} 缓存数据
   */
  async getOrSet(options, fetcher) {
    const { scope, key, version = 'latest' } = options;
    const cacheKey = this.buildCacheKey(scope, key, version);

    try {
      // L1: 检查内存LRU缓存
      let data = this.memoryCache.get(cacheKey);
      if (data !== undefined) {
        logger.debug(`Cache hit (L1): ${cacheKey}`);
        return data;
      }

      // L2: 检查Redis缓存
      const cached = await redis.get(cacheKey);
      if (cached) {
        data = JSON.parse(cached);
        this.memoryCache.set(cacheKey, data);
        logger.debug(`Cache hit (L2): ${cacheKey}`);
        return data;
      }

      // L3: 检查快照（用于降级场景）
      const snapshotData = await this.getSnapshot(scope, key, version);
      if (snapshotData) {
        data = snapshotData;
        this.memoryCache.set(cacheKey, data);
        await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5分钟Redis缓存
        logger.debug(`Cache hit (L3 - Snapshot): ${cacheKey}`);
        return data;
      }

      // L4: 从数据源获取
      data = await fetcher();

      // 存入各级缓存
      this.memoryCache.set(cacheKey, data);
      await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5分钟Redis缓存
      await this.saveSnapshot(scope, key, version, data);

      logger.debug(`Cache miss and fetched: ${cacheKey}`);
      return data;

    } catch (error) {
      logger.error(`Cache error for ${cacheKey}:`, error);
      // 降级：尝试从快照读取
      const snapshotData = await this.getSnapshot(scope, key, version);
      if (snapshotData) {
        return snapshotData;
      }
      throw error;
    }
  }

  /**
   * 精准失效缓存
   * @param {string} scope - 作用域
   * @param {string} key - 缓存键
   * @param {string} version - 版本号
   */
  async invalidate(scope, key, version) {
    const invalidationKey = this.buildInvalidationKey(scope, key, version);

    try {
      // 更新版本号
      this.versionCache.set(invalidationKey, Date.now());

      // 清除本地内存缓存
      const patterns = [
        this.buildCacheKey(scope, key, version),
        this.buildCacheKey(scope, key, 'latest')
      ];

      patterns.forEach(pattern => {
        this.memoryCache.delete(pattern);
      });

      // 清除Redis缓存
      const redisPattern = `${this.CACHE_PREFIX}${scope}:${key}:*`;
      const keys = await redis.keys(redisPattern);
      if (keys.length > 0) {
        await Promise.all(keys.map(k => redis.del(k)));
      }

      // 发布失效广播
      await this.publishInvalidation(scope, key, version);

      logger.info(`Cache invalidated: ${scope}:${key}:${version}`);
    } catch (error) {
      logger.error(`Cache invalidation error for ${scope}:${key}:${version}:`, error);
    }
  }

  /**
   * 批量失效
   * @param {string} scope - 作用域
   */
  async invalidateScope(scope) {
    try {
      // 清除本地内存缓存
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(`${this.CACHE_PREFIX}${scope}:`)) {
          this.memoryCache.delete(key);
        }
      }

      // 清除Redis缓存
      const redisPattern = `${this.CACHE_PREFIX}${scope}:*`;
      const keys = await redis.keys(redisPattern);
      if (keys.length > 0) {
        await Promise.all(keys.map(k => redis.del(k)));
      }

      // 发布广播
      await this.publishInvalidation(scope, '*', '*');

      logger.info(`Cache scope invalidated: ${scope}`);
    } catch (error) {
      logger.error(`Cache scope invalidation error for ${scope}:`, error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      memoryCache: {
        size: this.memoryCache.size,
        itemCount: this.memoryCache.itemCount
      },
      versionCache: {
        size: this.versionCache.size
      }
    };
  }

  /**
   * 初始化Redis订阅
   */
  async initRedisSubscription() {
    try {
      if (this.unsubscribe) {
        return;
      }

      this.unsubscribe = await redis.subscribe(this.INVALIDATE_CHANNEL, (message) => {
        if (!message) {
          return;
        }
        this.handleInvalidation(message);
      });

      logger.info(`[ConfigCache] Subscribed to ${this.INVALIDATE_CHANNEL}`);
    } catch (error) {
      logger.warn('Failed to initialize Redis subscription:', error);
    }
  }

  /**
   * 发布失效广播
   */
  async publishInvalidation(scope, key, version) {
    try {
      const message = JSON.stringify({
        scope,
        key,
        version,
        timestamp: Date.now()
      });

      await redis.publish(this.INVALIDATE_CHANNEL, message);
    } catch (error) {
      logger.error('Failed to publish invalidation:', error);
    }
  }

  /**
   * 处理失效广播
   */
  handleInvalidation(message) {
    try {
      const { scope, key, version } = JSON.parse(message);

      // 清除本地缓存
      const patterns = [
        this.buildCacheKey(scope, key, version),
        this.buildCacheKey(scope, key, 'latest')
      ];

      patterns.forEach(pattern => {
        this.memoryCache.delete(pattern);
      });

      logger.debug(`Handled invalidation broadcast: ${scope}:${key}:${version}`);
    } catch (error) {
      logger.error('Error handling invalidation broadcast:', error);
    }
  }

  /**
   * 构建缓存键
   */
  buildCacheKey(scope, key, version) {
    return `${this.CACHE_PREFIX}${scope}:${key}:${version}`;
  }

  /**
   * 构建失效键
   */
  buildInvalidationKey(scope, key, version) {
    return `${scope}:${key}:${version}`;
  }

  /**
   * 保存快照（简化实现，实际应该存储到文件或数据库）
   */
  async saveSnapshot(scope, key, version, data) {
    // 简化实现：快照存储到Redis的单独namespace
    const snapshotKey = `snapshot:${this.buildCacheKey(scope, key, version)}`;
    try {
      await redis.setex(snapshotKey, 3600, JSON.stringify(data)); // 1小时快照
    } catch (error) {
      logger.warn('Failed to save snapshot:', error);
    }
  }

  /**
   * 获取快照
   */
  async getSnapshot(scope, key, version) {
    const snapshotKey = `snapshot:${this.buildCacheKey(scope, key, version)}`;
    try {
      const snapshot = await redis.get(snapshotKey);
      return snapshot ? JSON.parse(snapshot) : null;
    } catch (error) {
      logger.warn('Failed to get snapshot:', error);
      return null;
    }
  }

  /**
   * 预热缓存
   */
  async warmup(dataLoaders) {
    if (!dataLoaders) {
      return;
    }

    logger.info('Starting cache warmup...');

    const entries = Array.isArray(dataLoaders)
      ? dataLoaders
      : Object.entries(dataLoaders).map(([descriptor, loader]) => {
          if (typeof loader === 'function') {
            const [scope, key, version] = descriptor.split(':');
            return {
              options: {
                scope,
                key,
                version: version || 'latest'
              },
              loader
            };
          }

          if (loader && typeof loader === 'object' && typeof loader.loader === 'function') {
            return {
              options: {
                scope: loader.scope,
                key: loader.key,
                version: loader.version || 'latest'
              },
              loader: loader.loader
            };
          }

          return null;
        }).filter(Boolean);

    for (const entry of entries) {
      const { options, loader } = entry;
      if (!options?.scope || !options?.key || typeof loader !== 'function') {
        logger.warn('[ConfigCache] Invalid warmup entry, skip', { entry });
        continue;
      }

      try {
        await this.getOrSet(options, loader);
        logger.debug(`[ConfigCache] Warmed cache: ${options.scope}:${options.key}`);
      } catch (error) {
        logger.warn(`[ConfigCache] Warmup failed for ${options.scope}:${options.key}`, error);
      }
    }

    logger.info('Cache warmup completed');
  }
}

// 单例实例
const configCacheService = new ConfigCacheService();

module.exports = configCacheService;
