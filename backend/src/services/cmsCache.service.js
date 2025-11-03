const redis = require('../utils/redis');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * CMS配置缓存服务
 * 实现多层缓存：内存LRU → Redis → 快照 → DB
 * 支持失效广播和版本化
 */
class CmsCacheService {
  constructor() {
    this.CACHE_PREFIX = 'cms:cache:';
    this.SNAPSHOT_PREFIX = 'cms:snapshot:';
    this.INVALIDATE_CHANNEL = 'cms:invalidate';
    this.memoryCache = new Map(); // 简单的内存缓存
    this.cacheTimeout = 5 * 60 * 1000; // 5分钟
  }

  /**
   * 获取或设置缓存
   * @param {string} scope - 作用域
   * @param {string} key - 缓存键
   * @param {Function} fetcher - 数据获取函数
   * @param {Object} options - 选项
   * @returns {Promise<any>}
   */
  async getOrSet(scope, key, fetcher, options = {}) {
    const { version = 'latest', ttl = 300 } = options;
    const cacheKey = `${this.CACHE_PREFIX}${scope}:${key}:${version}`;
    const memoryKey = `${scope}:${key}:${version}`;

    try {
      // L1: 检查内存缓存
      const memoryData = this.memoryCache.get(memoryKey);
      if (memoryData && (Date.now() - memoryData.timestamp < this.cacheTimeout)) {
        logger.debug(`[CMS Cache] Memory hit: ${memoryKey}`);
        return memoryData.data;
      }

      // L2: 检查Redis缓存
      const cached = await redis.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        this.memoryCache.set(memoryKey, {
          data,
          timestamp: Date.now()
        });
        logger.debug(`[CMS Cache] Redis hit: ${cacheKey}`);
        return data;
      }

      // L3: 检查快照
      const snapshotData = await this.getSnapshot(scope, key, version);
      if (snapshotData) {
        this.memoryCache.set(memoryKey, {
          data: snapshotData,
          timestamp: Date.now()
        });
        await redis.setex(cacheKey, ttl, JSON.stringify(snapshotData));
        logger.debug(`[CMS Cache] Snapshot hit: ${scope}:${key}`);
        return snapshotData;
      }

      // L4: 从数据库获取
      const data = await fetcher();

      // 存储到各级缓存
      this.memoryCache.set(memoryKey, {
        data,
        timestamp: Date.now()
      });
      await redis.setex(cacheKey, ttl, JSON.stringify(data));
      await this.saveSnapshot(scope, key, version, data);

      logger.debug(`[CMS Cache] DB fetch: ${scope}:${key}`);
      return data;

    } catch (error) {
      logger.error(`[CMS Cache] Error for ${scope}:${key}:`, error);
      // 降级：尝试从快照读取
      try {
        const snapshotData = await this.getSnapshot(scope, key, version);
        if (snapshotData) {
          return snapshotData;
        }
      } catch (snapshotError) {
        logger.error('[CMS Cache] Snapshot fallback failed:', snapshotError);
      }
      throw error;
    }
  }

  /**
   * 失效缓存
   * @param {string} scope - 作用域
   * @param {string} key - 缓存键
   * @param {string} version - 版本
   */
  async invalidate(scope, key, version = '*') {
    try {
      // 清除内存缓存
      for (const [memoryKey] of this.memoryCache) {
        if (memoryKey.startsWith(`${scope}:${key}:`) ||
            (key === '*' && memoryKey.startsWith(`${scope}:`))) {
          this.memoryCache.delete(memoryKey);
        }
      }

      // 清除Redis缓存
      const pattern = key === '*'
        ? `${this.CACHE_PREFIX}${scope}:*`
        : `${this.CACHE_PREFIX}${scope}:${key}:*`;

      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await Promise.all(keys.map(k => redis.del(k)));
      }

      // 发布失效广播
      await this.publishInvalidation(scope, key, version);

      logger.info(`[CMS Cache] Invalidated: ${scope}:${key}:${version}`);
    } catch (error) {
      logger.error(`[CMS Cache] Invalidating ${scope}:${key}:`, error);
    }
  }

  /**
   * 批量失效整个作用域
   * @param {string} scope - 作用域
   */
  async invalidateScope(scope) {
    await this.invalidate(scope, '*');
  }

  /**
   * 保存快照
   * @param {string} scope - 作用域
   * @param {string} key - 键
   * @param {string} version - 版本
   * @param {any} data - 数据
   */
  async saveSnapshot(scope, key, version, data) {
    try {
      const snapshotKey = `${this.SNAPSHOT_PREFIX}${scope}:${key}:${version}`;
      await db('config_snapshots').insert({
        scope,
        key,
        version,
        data: JSON.stringify(data),
        action: 'cache',
        description: '自动缓存快照',
        created_at: new Date()
      }).onConflict().ignore(); // 避免重复插入
    } catch (error) {
      logger.warn(`[CMS Cache] Failed to save snapshot:`, error);
    }
  }

  /**
   * 获取快照
   * @param {string} scope - 作用域
   * @param {string} key - 键
   * @param {string} version - 版本
   * @returns {Promise<any>}
   */
  async getSnapshot(scope, key, version) {
    try {
      const snapshot = await db('config_snapshots')
        .where({
          scope,
          key,
          version
        })
        .orderBy('created_at', 'desc')
        .first();

      return snapshot ? JSON.parse(snapshot.data) : null;
    } catch (error) {
      logger.warn(`[CMS Cache] Failed to get snapshot:`, error);
      return null;
    }
  }

  /**
   * 发布失效广播
   * @param {string} scope - 作用域
   * @param {string} key - 键
   * @param {string} version - 版本
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
      logger.error('[CMS Cache] Failed to publish invalidation:', error);
    }
  }

  /**
   * 创建配置快照（用于发布/回滚）
   * @param {string} scope - 作用域
   * @param {string} key - 键
   * @param {any} data - 数据
   * @param {string} action - 操作类型
   * @param {string} description - 描述
   * @param {string} userId - 操作用户
   */
  async createSnapshot(scope, key, data, action, description, userId) {
    try {
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

      // 更新数据版本
      await this.updateDataVersion(scope, key, version, data);

      // 失效相关缓存
      await this.invalidate(scope, key);

      logger.info(`[CMS Cache] Created snapshot: ${scope}:${key}:${version}`);
      return version;
    } catch (error) {
      logger.error(`[CMS Cache] Failed to create snapshot:`, error);
      throw error;
    }
  }

  /**
   * 回滚到指定版本
   * @param {string} scope - 作用域
   * @param {string} key - 键
   * @param {string} version - 目标版本
   * @param {string} userId - 操作用户
   */
  async rollback(scope, key, version, userId) {
    try {
      const snapshot = await db('config_snapshots')
        .where({ scope, key, version })
        .first();

      if (!snapshot) {
        throw new Error(`Snapshot not found: ${scope}:${key}:${version}`);
      }

      const data = JSON.parse(snapshot.data);

      // 创建回滚快照
      await this.createSnapshot(scope, key, data, 'rollback',
        `回滚到版本 ${version}`, userId);

      logger.info(`[CMS Cache] Rolled back: ${scope}:${key} to ${version}`);
      return data;
    } catch (error) {
      logger.error(`[CMS Cache] Failed to rollback:`, error);
      throw error;
    }
  }

  /**
   * 生成版本号
   * @param {string} scope - 作用域
   * @param {string} key - 键
   * @returns {Promise<string>}
   */
  async generateVersion(scope, key) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `v${timestamp}-${random}`;
  }

  /**
   * 更新数据版本
   * @param {string} scope - 作用域
   * @param {string} key - 键
   * @param {string} version - 版本
   * @param {any} data - 数据
   */
  async updateDataVersion(scope, key, version, data) {
    // 根据不同的作用域更新不同的表
    if (scope === 'features') {
      await db('cms_features')
        .where('key', key)
        .update({
          version,
          config: JSON.stringify(data),
          updated_at: new Date()
        });
    }
    // 其他作用域的处理...
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      memoryCacheSize: this.memoryCache.size,
      cacheTimeout: this.cacheTimeout
    };
  }

  /**
   * 清理过期的内存缓存
   */
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.memoryCache) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.memoryCache.delete(key);
      }
    }
  }
}

// 单例实例
const cmsCacheService = new CmsCacheService();

// 定期清理过期缓存
setInterval(() => {
  cmsCacheService.cleanup();
}, 60000); // 每分钟清理一次

module.exports = cmsCacheService;