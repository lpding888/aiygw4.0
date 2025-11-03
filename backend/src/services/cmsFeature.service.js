const db = require('../config/database');
const cmsCacheService = require('./cmsCache.service');
const rbacService = require('./rbac.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * CMS功能目录服务
 * 提供功能的CRUD、发布、回滚、审计等功能
 */
class CmsFeatureService {
  /**
   * 获取功能列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>}
   */
  async getFeatures(options = {}) {
    const {
      page = 1,
      limit = 20,
      category,
      status,
      enabled,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options;

    try {
      let query = db('cms_features')
        .select([
          'id',
          'key',
          'name',
          'description',
          'category',
          'enabled',
          'status',
          'config',
          'menu',
          'metadata',
          'version',
          'published_at',
          'created_at',
          'updated_at'
        ]);

      // 应用筛选条件
      if (category) {
        query = query.where('category', category);
      }
      if (status) {
        query = query.where('status', status);
      }
      if (enabled !== undefined) {
        query = query.where('enabled', enabled);
      }
      if (search) {
        query = query.where(function() {
          this.where('name', 'like', `%${search}%`)
              .orWhere('description', 'like', `%${search}%`)
              .orWhere('key', 'like', `%${search}%`);
        });
      }

      // 排序
      if (sortBy) {
        query = query.orderBy(sortBy, sortOrder);
      }

      // 分页
      const offset = (page - 1) * limit;
      const totalCount = await query.clone().clearSelect().count('* as count');
      const features = await query.limit(limit).offset(offset);

      return {
        features,
        pagination: {
          current: page,
          pageSize: limit,
          total: parseInt(totalCount[0].count),
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      };

    } catch (error) {
      logger.error('[CmsFeatureService] Get features failed:', error);
      throw new AppError('获取功能列表失败', 500, 'GET_FEATURES_FAILED');
    }
  }

  /**
   * 根据ID获取功能详情
   * @param {string} id - 功能ID
   * @returns {Promise<Object>}
   */
  async getFeatureById(id) {
    try {
      const feature = await db('cms_features')
        .where('id', id)
        .first();

      if (!feature) {
        throw new AppError('功能不存在', 404, 'FEATURE_NOT_FOUND');
      }

      return feature;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('[CmsFeatureService] Get feature by ID failed:', error);
      throw new AppError('获取功能详情失败', 500, 'GET_FEATURE_FAILED');
    }
  }

  /**
   * 根据key获取功能
   * @param {string} key - 功能键
   * @returns {Promise<Object>}
   */
  async getFeatureByKey(key) {
    const cacheKey = `cms_features:${key}`;
    return await cmsCacheService.getOrSet('features', cacheKey, async () => {
      const feature = await db('cms_features')
        .where('key', key)
        .first();

      if (!feature) {
        throw new AppError('功能不存在', 404, 'FEATURE_NOT_FOUND');
      }

      return feature;
    }, { ttl: 600 }); // 10分钟缓存
  }

  /**
   * 创建功能
   * @param {Object} featureData - 功能数据
   * @param {string} userId - 创建用户ID
   * @returns {Promise<Object>}
   */
  async createFeature(featureData, userId) {
    const {
      key,
      name,
      description,
      category,
      config = {},
      menu = {},
      metadata = {},
      enabled = true
    } = featureData;

    try {
      // 检查key是否已存在
      const existing = await db('cms_features').where('key', key).first();
      if (existing) {
        throw new AppError('功能键已存在', 400, 'FEATURE_KEY_EXISTS');
      }

      // 生成版本号
      const version = await cmsCacheService.generateVersion('features', key);

      // 创建功能
      const [feature] = await db('cms_features').insert({
        key,
        name,
        description,
        category,
        config: JSON.stringify(config),
        menu: JSON.stringify(menu),
        metadata: JSON.stringify(metadata),
        enabled,
        status: 'draft',
        version,
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');

      // 创建快照
      await cmsCacheService.createSnapshot(
        'features',
        key,
        feature,
        'create',
        '创建功能',
        userId
      );

      // 失效相关缓存
      await cmsCacheService.invalidate('features', key);

      logger.info(`[CmsFeatureService] Feature created: ${key} by ${userId}`);
      return feature;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('[CmsFeatureService] Create feature failed:', error);
      throw new AppError('创建功能失败', 500, 'CREATE_FEATURE_FAILED');
    }
  }

  /**
   * 更新功能
   * @param {string} id - 功能ID
   * @param {Object} updateData - 更新数据
   * @param {string} userId - 更新用户ID
   * @returns {Promise<Object>}
   */
  async updateFeature(id, updateData, userId) {
    try {
      const feature = await this.getFeatureById(id);

      // 生成新版本号
      const version = await cmsCacheService.generateVersion('features', feature.key);

      // 更新数据
      const updates = {
        ...updateData,
        version,
        updated_by: userId,
        updated_at: new Date()
      };

      // 转换JSON字段
      if (updates.config) {
        updates.config = JSON.stringify(updates.config);
      }
      if (updates.menu) {
        updates.menu = JSON.stringify(updates.menu);
      }
      if (updates.metadata) {
        updates.metadata = JSON.stringify(updates.metadata);
      }

      const [updatedFeature] = await db('cms_features')
        .where('id', id)
        .update(updates)
        .returning('*');

      // 创建快照
      await cmsCacheService.createSnapshot(
        'features',
        feature.key,
        updatedFeature,
        'update',
        '更新功能',
        userId
      );

      // 失效相关缓存
      await cmsCacheService.invalidate('features', feature.key);

      logger.info(`[CmsFeatureService] Feature updated: ${feature.key} by ${userId}`);
      return updatedFeature;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('[CmsFeatureService] Update feature failed:', error);
      throw new AppError('更新功能失败', 500, 'UPDATE_FEATURE_FAILED');
    }
  }

  /**
   * 删除功能
   * @param {string} id - 功能ID
   * @param {string} userId - 删除用户ID
   * @returns {Promise<void>}
   */
  async deleteFeature(id, userId) {
    try {
      const feature = await this.getFeatureById(id);

      await db('cms_features').where('id', id).del();

      // 创建快照
      await cmsCacheService.createSnapshot(
        'features',
        feature.key,
        feature,
        'delete',
        '删除功能',
        userId
      );

      // 失效相关缓存
      await cmsCacheService.invalidate('features', feature.key);

      logger.info(`[CmsFeatureService] Feature deleted: ${feature.key} by ${userId}`);

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('[CmsFeatureService] Delete feature failed:', error);
      throw new AppError('删除功能失败', 500, 'DELETE_FEATURE_FAILED');
    }
  }

  /**
   * 发布功能
   * @param {string} id - 功能ID
   * @param {string} userId - 发布用户ID
   * @returns {Promise<Object>}
   */
  async publishFeature(id, userId) {
    try {
      const feature = await this.getFeatureById(id);

      if (feature.status === 'published') {
        throw new AppError('功能已发布', 400, 'FEATURE_ALREADY_PUBLISHED');
      }

      // 更新状态
      const [publishedFeature] = await db('cms_features')
        .where('id', id)
        .update({
          status: 'published',
          published_at: new Date(),
          updated_by: userId,
          updated_at: new Date()
        })
        .returning('*');

      // 创建发布快照
      await cmsCacheService.createSnapshot(
        'features',
        feature.key,
        publishedFeature,
        'publish',
        '发布功能',
        userId
      );

      // 失效相关缓存
      await cmsCacheService.invalidate('features', feature.key);
      await cmsCacheService.invalidateScope('ui'); // 同时失效UI缓存

      logger.info(`[CmsFeatureService] Feature published: ${feature.key} by ${userId}`);
      return publishedFeature;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('[CmsFeatureService] Publish feature failed:', error);
      throw new AppError('发布功能失败', 500, 'PUBLISH_FEATURE_FAILED');
    }
  }

  /**
   * 回滚功能到指定版本
   * @param {string} id - 功能ID
   * @param {string} version - 目标版本
   * @param {string} userId - 操作用户ID
   * @returns {Promise<Object>}
   */
  async rollbackFeature(id, version, userId) {
    try {
      const feature = await this.getFeatureById(id);

      // 执行回滚
      const rolledBackData = await cmsCacheService.rollback(
        'features',
        feature.key,
        version,
        userId
      );

      // 更新数据库
      const [rolledBackFeature] = await db('cms_features')
        .where('id', id)
        .update({
          config: rolledBackData.config,
          menu: rolledBackData.menu,
          metadata: rolledBackData.metadata,
          version: rolledBackData.version,
          updated_by: userId,
          updated_at: new Date()
        })
        .returning('*');

      // 失效相关缓存
      await cmsCacheService.invalidate('features', feature.key);
      await cmsCacheService.invalidateScope('ui');

      logger.info(`[CmsFeatureService] Feature rolled back: ${feature.key} to ${version} by ${userId}`);
      return rolledBackFeature;

    } catch (error) {
      logger.error('[CmsFeatureService] Rollback feature failed:', error);
      throw new AppError('回滚功能失败', 500, 'ROLLBACK_FEATURE_FAILED');
    }
  }

  /**
   * 获取功能版本历史
   * @param {string} id - 功能ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>}
   */
  async getFeatureHistory(id, options = {}) {
    const { page = 1, limit = 20 } = options;

    try {
      const feature = await this.getFeatureById(id);

      const offset = (page - 1) * limit;
      const totalCount = await db('config_snapshots')
        .where({ scope: 'features', key: feature.key })
        .count('* as count');

      const history = await db('config_snapshots')
        .where({ scope: 'features', key: feature.key })
        .select([
          'version',
          'action',
          'description',
          'created_by',
          'created_at'
        ])
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      return {
        history,
        pagination: {
          current: page,
          pageSize: limit,
          total: parseInt(totalCount[0].count),
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      };

    } catch (error) {
      logger.error('[CmsFeatureService] Get feature history failed:', error);
      throw new AppError('获取功能历史失败', 500, 'GET_FEATURE_HISTORY_FAILED');
    }
  }

  /**
   * 批量操作功能状态
   * @param {Array} ids - 功能ID列表
   * @param {Object} updateData - 更新数据
   * @param {string} userId - 操作用户ID
   * @returns {Promise<Object>}
   */
  async batchUpdateFeatures(ids, updateData, userId) {
    try {
      const results = {
        success: [],
        failed: []
      };

      for (const id of ids) {
        try {
          const updatedFeature = await this.updateFeature(id, updateData, userId);
          results.success.push(updatedFeature);
        } catch (error) {
          results.failed.push({ id, error: error.message });
        }
      }

      logger.info(`[CmsFeatureService] Batch update completed: ${results.success.length} success, ${results.failed.length} failed`);
      return results;

    } catch (error) {
      logger.error('[CmsFeatureService] Batch update failed:', error);
      throw new AppError('批量更新功能失败', 500, 'BATCH_UPDATE_FAILED');
    }
  }
}

module.exports = new CmsFeatureService();