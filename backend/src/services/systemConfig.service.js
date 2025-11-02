const db = require('../config/database');
const logger = require('../utils/logger');
const cacheService = require('./cache.service'); // P1-010: 使用Redis缓存

/**
 * 系统配置服务 (P1-010优化)
 * 提供动态配置管理功能，支持运行时修改API密钥、提示词等配置
 * 艹！老王我用Redis缓存替换了Map缓存，多进程共享杠杠的
 */
class SystemConfigService {
  constructor() {
    // P1-010: 不再使用内存缓存，改用Redis缓存
    this._CACHE_TTL = 5 * 60; // 5分钟缓存(秒)
  }

  /**
   * 获取配置值 (P1-010: 使用Redis缓存)
   * @param {string} key - 配置键名
   * @param {any} defaultValue - 默认值
   * @returns {Promise<any>} 配置值
   */
  async get(key, defaultValue = null) {
    try {
      // P1-010: 使用Redis缓存的Cache-Aside模式
      return await cacheService.getCachedSystemConfig(key, async () => {
        const config = await db('system_configs')
          .where('config_key', key)
          .where('is_active', true)
          .first();

        if (!config) {
          logger.warn(`[SystemConfigService] 配置不存在: ${key}`);
          return defaultValue;
        }

        const value = this._parseValue(config.config_value, config.config_type);
        return value;
      });
    } catch (error) {
      logger.error(`[SystemConfigService] 获取配置失败: ${key}`, error);
      return defaultValue;
    }
  }

  /**
   * 获取多个配置值
   * @param {Array<string>} keys - 配置键名数组
   * @returns {Promise<Object>} 配置键值对
   */
  async getMultiple(keys) {
    try {
      const results = {};

      for (const key of keys) {
        results[key] = await this.get(key);
      }

      return results;
    } catch (error) {
      logger.error('[SystemConfigService] 批量获取配置失败', error);
      throw error;
    }
  }

  /**
   * 获取按分类分组的配置
   * @param {string} category - 配置分类
   * @param {boolean} includeSecrets - 是否包含敏感配置
   * @returns {Promise<Object>} 分组配置
   */
  async getByCategory(category, includeSecrets = false) {
    try {
      let query = db('system_configs')
        .where('category', category)
        .where('is_active', true)
        .orderBy('sort_order', 'asc');

      if (!includeSecrets) {
        query = query.where('is_secret', false);
      }

      const configs = await query;
      const result = {};

      configs.forEach(config => {
        const value = this._parseValue(config.config_value, config.config_type);
        // 敏感配置隐藏真实值
        if (config.is_secret && !includeSecrets) {
          result[config.config_key] = value ? '***已配置***' : '';
        } else {
          result[config.config_key] = value;
        }
      });

      return result;
    } catch (error) {
      logger.error(`[SystemConfigService] 获取分类配置失败: ${category}`, error);
      throw error;
    }
  }

  /**
   * 设置配置值
   * @param {string} key - 配置键名
   * @param {any} value - 配置值
   * @param {string} type - 配置类型
   * @param {string} description - 配置描述
   * @param {number} userId - 操作用户ID
   * @returns {Promise<boolean>}
   */
  async set(key, value, type = 'string', description = '', userId = null) {
    try {
      const now = new Date();
      const configValue = this._serializeValue(value, type);

      const exists = await db('system_configs')
        .where('config_key', key)
        .first();

      if (exists) {
        // 更新现有配置
        await db('system_configs')
          .where('config_key', key)
          .update({
            config_value: configValue,
            config_type: type,
            description: description || exists.description,
            updated_by: userId,
            updated_at: now
          });

        logger.info(`[SystemConfigService] 配置更新成功: ${key}`, { userId });
      } else {
        // 创建新配置
        await db('system_configs').insert({
          config_key: key,
          config_value: configValue,
          config_type: type,
          description,
          created_by: userId,
          created_at: now,
          updated_at: now
        });

        logger.info(`[SystemConfigService] 配置创建成功: ${key}`, { userId });
      }

      // P1-010: 清除Redis缓存
      await cacheService.invalidateSystemConfig(key);

      return true;
    } catch (error) {
      logger.error(`[SystemConfigService] 设置配置失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * 批量设置配置
   * @param {Array<Object>} configs - 配置数组 [{key, value, type, description}]
   * @param {number} userId - 操作用户ID
   * @returns {Promise<boolean>}
   */
  async setMultiple(configs, userId = null) {
    try {
      const trx = await db.transaction();

      try {
        for (const config of configs) {
          const { key, value, type = 'string', description = '' } = config;
          const configValue = this._serializeValue(value, type);
          const now = new Date();

          const exists = await trx('system_configs')
            .where('config_key', key)
            .first();

          if (exists) {
            await trx('system_configs')
              .where('config_key', key)
              .update({
                config_value: configValue,
                config_type: type,
                description: description || exists.description,
                updated_by: userId,
                updated_at: now
              });
          } else {
            await trx('system_configs').insert({
              config_key: key,
              config_value: configValue,
              config_type: type,
              description,
              created_by: userId,
              created_at: now,
              updated_at: now
            });
          }

          // P1-010: 清除Redis缓存
          await cacheService.invalidateSystemConfig(key);
        }

        await trx.commit();
        logger.info('[SystemConfigService] 批量配置更新成功', { userId, count: configs.length });
        return true;
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      logger.error('[SystemConfigService] 批量设置配置失败', error);
      throw error;
    }
  }

  /**
   * 删除配置
   * @param {string} key - 配置键名
   * @param {number} userId - 操作用户ID
   * @returns {Promise<boolean>}
   */
  async delete(key, userId = null) {
    try {
      const config = await db('system_configs')
        .where('config_key', key)
        .first();

      if (!config) {
        return false;
      }

      if (config.is_system) {
        throw new Error('系统配置不可删除');
      }

      await db('system_configs')
        .where('config_key', key)
        .del();

      // P1-010: 清除Redis缓存
      await cacheService.invalidateSystemConfig(key);

      logger.info(`[SystemConfigService] 配置删除成功: ${key}`, { userId });
      return true;
    } catch (error) {
      logger.error(`[SystemConfigService] 删除配置失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * 获取所有配置分类
   * @returns {Promise<Array<string>>}
   */
  async getCategories() {
    try {
      const categories = await db('system_configs')
        .select('category')
        .distinct()
        .where('is_active', true)
        .orderBy('category', 'asc');

      return categories.map(c => c.category);
    } catch (error) {
      logger.error('[SystemConfigService] 获取配置分类失败', error);
      throw error;
    }
  }

  /**
   * 获取配置列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>}
   */
  async list(options = {}) {
    try {
      const {
        category = null,
        page = 1,
        limit = 50,
        includeInactive = false
      } = options;

      let query = db('system_configs')
        .select('*')
        .orderBy('category', 'asc')
        .orderBy('sort_order', 'asc')
        .orderBy('config_key', 'asc');

      if (category) {
        query = query.where('category', category);
      }

      if (!includeInactive) {
        query = query.where('is_active', true);
      }

      const offset = (page - 1) * limit;
      const configs = await query.limit(limit).offset(offset);

      const [{ count }] = await db('system_configs')
        .count('* as count');

      // 格式化配置，隐藏敏感信息
      const formattedConfigs = configs.map(config => ({
        ...config,
        config_value: config.is_secret ? '***敏感配置***' : config.config_value,
        parsed_value: this._parseValue(config.config_value, config.config_type)
      }));

      return {
        configs: formattedConfigs,
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      };
    } catch (error) {
      logger.error('[SystemConfigService] 获取配置列表失败', error);
      throw error;
    }
  }

  /**
   * 重新加载配置缓存 (P1-010: 清空Redis缓存)
   */
  async reloadCache() {
    // P1-010: 清空所有系统配置的Redis缓存
    await cacheService.invalidateAllSystemConfigs();
    logger.info('[SystemConfigService] 配置缓存已清空');
  }

  /**
   * P1-010: 已移除_isCacheValid()和_clearCache()方法
   * 现在使用Redis缓存，不再需要内存缓存管理方法
   */

  /**
   * 解析配置值
   * @private
   */
  _parseValue(value, type) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    try {
      switch (type) {
        case 'number':
          return Number(value);
        case 'boolean':
          return value === 'true' || value === true || value === 1;
        case 'json':
          return typeof value === 'string' ? JSON.parse(value) : value;
        default:
          return value;
      }
    } catch (error) {
      logger.error(`[SystemConfigService] 解析配置值失败: ${value} (${type})`, error);
      return value;
    }
  }

  /**
   * 序列化配置值
   * @private
   */
  _serializeValue(value, type) {
    if (value === null || value === undefined) {
      return '';
    }

    switch (type) {
      case 'json':
        return typeof value === 'object' ? JSON.stringify(value) : value;
      default:
        return String(value);
    }
  }
}

module.exports = new SystemConfigService();