const { getCache, setCache, delCache, delCachePattern } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * 缓存服务 (P1-010)
 * 艹！实现Cache-Aside模式，高频查询性能杠杠的
 *
 * Cache-Aside模式：
 * 1. 读取：先查缓存，缓存miss则查数据库并写入缓存
 * 2. 写入：先写数据库，成功后删除缓存（而不是更新缓存）
 */
class CacheService {
  /**
   * 获取或设置缓存 (Cache-Aside模式核心方法)
   * 艹！这个方法是老王我最骄傲的实现，自动处理缓存miss
   *
   * @param {string} key - 缓存键
   * @param {Function} fetchFn - 缓存miss时的数据获取函数
   * @param {number} ttl - 过期时间(秒)，默认3600秒（1小时）
   * @returns {Promise<any>} 缓存的数据
   */
  async getOrSet(key, fetchFn, ttl = 3600) {
    try {
      // 1. 先查缓存（Cache Hit）
      const cached = await getCache(key);
      if (cached !== null) {
        logger.debug(`[CacheService] 缓存命中: ${key}`);
        return cached;
      }

      // 2. 缓存miss，调用数据获取函数
      logger.debug(`[CacheService] 缓存未命中，查询数据源: ${key}`);
      const data = await fetchFn();

      // 3. 将数据写入缓存
      if (data !== null && data !== undefined) {
        await setCache(key, data, ttl);
        logger.debug(`[CacheService] 数据已缓存: ${key}, TTL=${ttl}s`);
      }

      return data;
    } catch (error) {
      logger.error(`[CacheService] getOrSet失败: ${error.message}`, { key });
      // 缓存失败不影响业务，直接调用数据获取函数
      return await fetchFn();
    }
  }

  /**
   * 使缓存失效
   * 艹！数据更新时必须删除缓存，保证数据一致性
   *
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>}
   */
  async invalidate(key) {
    try {
      await delCache(key);
      logger.debug(`[CacheService] 缓存已失效: ${key}`);
      return true;
    } catch (error) {
      logger.error(`[CacheService] invalidate失败: ${error.message}`, { key });
      return false;
    }
  }

  /**
   * 批量使缓存失效（支持通配符）
   * 艹！这个方法用于批量删除相关缓存，比如删除用户的所有缓存
   *
   * @param {string} pattern - 缓存键模式（例如: user:123:*）
   * @returns {Promise<number>} 删除的缓存数量
   */
  async invalidatePattern(pattern) {
    try {
      const deletedCount = await delCachePattern(pattern);
      logger.debug(`[CacheService] 批量缓存失效: ${pattern}, 删除数量=${deletedCount}`);
      return deletedCount;
    } catch (error) {
      logger.error(`[CacheService] invalidatePattern失败: ${error.message}`, { pattern });
      return 0;
    }
  }

  /**
   * 直接设置缓存（不推荐，优先使用getOrSet）
   *
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 过期时间(秒)
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttl = 3600) {
    try {
      await setCache(key, value, ttl);
      logger.debug(`[CacheService] 缓存已设置: ${key}, TTL=${ttl}s`);
      return true;
    } catch (error) {
      logger.error(`[CacheService] set失败: ${error.message}`, { key });
      return false;
    }
  }

  /**
   * 直接获取缓存（不推荐，优先使用getOrSet）
   *
   * @param {string} key - 缓存键
   * @returns {Promise<any>}
   */
  async get(key) {
    try {
      const cached = await getCache(key);
      if (cached !== null) {
        logger.debug(`[CacheService] 缓存命中: ${key}`);
      } else {
        logger.debug(`[CacheService] 缓存未命中: ${key}`);
      }
      return cached;
    } catch (error) {
      logger.error(`[CacheService] get失败: ${error.message}`, { key });
      return null;
    }
  }

  // ========== 业务相关缓存方法 ==========

  /**
   * 缓存用户信息
   * TTL = 1小时（用户信息不经常变化）
   */
  async getCachedUser(userId, fetchUserFn) {
    const key = `user:${userId}:info`;
    return await this.getOrSet(key, fetchUserFn, 3600); // 1小时
  }

  /**
   * 使用户信息缓存失效
   * 艹！用户更新时必须调用这个方法
   */
  async invalidateUser(userId) {
    const key = `user:${userId}:info`;
    return await this.invalidate(key);
  }

  /**
   * 缓存系统配置
   * TTL = 24小时（系统配置很少变化）
   */
  async getCachedSystemConfig(configKey, fetchConfigFn) {
    const key = `system_config:${configKey}`;
    return await this.getOrSet(key, fetchConfigFn, 86400); // 24小时
  }

  /**
   * 使系统配置缓存失效
   */
  async invalidateSystemConfig(configKey) {
    const key = `system_config:${configKey}`;
    return await this.invalidate(key);
  }

  /**
   * 批量使所有系统配置缓存失效
   */
  async invalidateAllSystemConfigs() {
    return await this.invalidatePattern('system_config:*');
  }

  /**
   * 缓存功能定义
   * TTL = 6小时（功能定义偶尔会变）
   */
  async getCachedFeature(featureId, fetchFeatureFn) {
    const key = `feature:${featureId}`;
    return await this.getOrSet(key, fetchFeatureFn, 21600); // 6小时
  }

  /**
   * 使功能定义缓存失效
   */
  async invalidateFeature(featureId) {
    const key = `feature:${featureId}`;
    return await this.invalidate(key);
  }

  /**
   * 批量使所有功能定义缓存失效
   */
  async invalidateAllFeatures() {
    return await this.invalidatePattern('feature:*');
  }
}

module.exports = new CacheService();
