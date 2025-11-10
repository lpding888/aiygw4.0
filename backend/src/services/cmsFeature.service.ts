import { db } from '../config/database.js';
import cmsCacheService from './cmsCache.service.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import type { Knex } from 'knex';
import type {
  CmsFeature,
  FeatureQueryOptions,
  FeatureListResponse,
  CreateFeatureData,
  UpdateFeatureData,
  FeatureHistoryResponse,
  HistoryQueryOptions,
  BatchUpdateResult,
  CmsCacheService
} from '../types/cms-feature.types.js';

class CmsFeatureService {
  async getFeatures(options: FeatureQueryOptions = {}): Promise<FeatureListResponse> {
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
      let query: Knex.QueryBuilder = db('cms_features').select([
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

      if (category) query = query.where('category', category);
      if (status) query = query.where('status', status);
      if (enabled !== undefined) query = query.where('enabled', enabled);
      if (search) {
        query = query.where(function (this: Knex.QueryBuilder) {
          this.where('name', 'like', `%${search}%`)
            .orWhere('description', 'like', `%${search}%`)
            .orWhere('key', 'like', `%${search}%`);
        });
      }

      if (sortBy) query = query.orderBy(sortBy, sortOrder);

      const offset = (page - 1) * limit;
      const totalCount = (await query.clone().clearSelect().count('* as count')) as Array<{
        count: number;
      }>;
      const features = (await query.limit(limit).offset(offset)) as CmsFeature[];

      return {
        features,
        pagination: {
          current: page,
          pageSize: limit,
          total: parseInt(String(totalCount[0].count)),
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      };
    } catch (error) {
      logger.error('[CmsFeatureService] Get features failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '获取功能列表失败');
    }
  }

  async getFeatureById(id: string): Promise<CmsFeature> {
    try {
      const feature = (await db('cms_features').where('id', id).first()) as CmsFeature | undefined;
      if (!feature) {
        throw AppError.custom(ERROR_CODES.USER_NOT_FOUND, '功能不存在');
      }
      return feature;
    } catch (error) {
      if (AppError.isAppError?.(error)) throw error;
      logger.error('[CmsFeatureService] Get feature by ID failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '获取功能详情失败');
    }
  }

  async getFeatureByKey(key: string): Promise<CmsFeature> {
    const cacheKey = `cms_features:${key}`;
    return await (cmsCacheService as unknown as CmsCacheService).getOrSet<CmsFeature>(
      'features',
      cacheKey,
      async () => {
        const feature = (await db('cms_features').where('key', key).first()) as
          | CmsFeature
          | undefined;
        if (!feature) {
          throw AppError.custom(ERROR_CODES.USER_NOT_FOUND, '功能不存在');
        }
        return feature;
      },
      { ttl: 600 }
    );
  }

  async createFeature(featureData: CreateFeatureData, userId: string): Promise<CmsFeature> {
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
      const existing = await db('cms_features').where('key', key).first();
      if (existing) {
        throw AppError.custom(ERROR_CODES.INVALID_PARAMETERS, '功能键已存在');
      }
      const version = await (cmsCacheService as unknown as CmsCacheService).generateVersion(
        'features',
        key
      );
      const [feature] = (await db('cms_features')
        .insert({
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
        })
        .returning('*')) as CmsFeature[];

      await (cmsCacheService as unknown as CmsCacheService).createSnapshot(
        'features',
        key,
        feature,
        'create',
        '创建功能',
        userId
      );
      await (cmsCacheService as unknown as CmsCacheService).invalidate('features', key);
      logger.info(`[CmsFeatureService] Feature created: ${key} by ${userId}`);
      return feature;
    } catch (error) {
      if (AppError.isAppError?.(error)) throw error;
      logger.error('[CmsFeatureService] Create feature failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '创建功能失败');
    }
  }

  async updateFeature(
    id: string,
    updateData: UpdateFeatureData,
    userId: string
  ): Promise<CmsFeature> {
    try {
      const feature = await this.getFeatureById(id);
      const config =
        updateData.config !== undefined ? JSON.stringify(updateData.config) : feature.config;
      const menu = updateData.menu !== undefined ? JSON.stringify(updateData.menu) : feature.menu;
      const metadata =
        updateData.metadata !== undefined ? JSON.stringify(updateData.metadata) : feature.metadata;

      const [updated] = (await db('cms_features')
        .where('id', id)
        .update({
          ...updateData,
          config,
          menu,
          metadata,
          updated_by: userId,
          updated_at: new Date()
        })
        .returning('*')) as CmsFeature[];

      await (cmsCacheService as unknown as CmsCacheService).createSnapshot(
        'features',
        feature.key,
        updated,
        'update',
        '更新功能',
        userId
      );
      await (cmsCacheService as unknown as CmsCacheService).invalidate('features', feature.key);
      logger.info(`[CmsFeatureService] Feature updated: ${feature.key} by ${userId}`);
      return updated;
    } catch (error) {
      if (AppError.isAppError?.(error)) throw error;
      logger.error('[CmsFeatureService] Update feature failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '更新功能失败');
    }
  }

  async deleteFeature(id: string, userId: string): Promise<void> {
    try {
      const feature = await this.getFeatureById(id);
      await db('cms_features').where('id', id).del();
      await (cmsCacheService as unknown as CmsCacheService).createSnapshot(
        'features',
        feature.key,
        feature,
        'delete',
        '删除功能',
        userId
      );
      await (cmsCacheService as unknown as CmsCacheService).invalidate('features', feature.key);
      logger.info(`[CmsFeatureService] Feature deleted: ${feature.key} by ${userId}`);
    } catch (error) {
      if (AppError.isAppError?.(error)) throw error;
      logger.error('[CmsFeatureService] Delete feature failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '删除功能失败');
    }
  }

  async publishFeature(id: string, userId: string): Promise<CmsFeature> {
    try {
      const feature = await this.getFeatureById(id);
      if (feature.status === 'published') {
        throw AppError.custom(ERROR_CODES.INVALID_REQUEST, '功能已发布');
      }
      const [publishedFeature] = (await db('cms_features')
        .where('id', id)
        .update({
          status: 'published',
          published_at: new Date(),
          updated_by: userId,
          updated_at: new Date()
        })
        .returning('*')) as CmsFeature[];
      await (cmsCacheService as unknown as CmsCacheService).createSnapshot(
        'features',
        feature.key,
        publishedFeature,
        'publish',
        '发布功能',
        userId
      );
      await (cmsCacheService as unknown as CmsCacheService).invalidate('features', feature.key);
      await (cmsCacheService as unknown as CmsCacheService).invalidateScope('ui');
      logger.info(`[CmsFeatureService] Feature published: ${feature.key} by ${userId}`);
      return publishedFeature;
    } catch (error) {
      if (AppError.isAppError?.(error)) throw error;
      logger.error('[CmsFeatureService] Publish feature failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '发布功能失败');
    }
  }

  async rollbackFeature(id: string, version: string, userId: string): Promise<CmsFeature> {
    try {
      const feature = await this.getFeatureById(id);
      const rolledBackData = await (cmsCacheService as unknown as CmsCacheService).rollback(
        'features',
        feature.key,
        version,
        userId
      );
      const [rolledBackFeature] = (await db('cms_features')
        .where('id', id)
        .update({
          config: rolledBackData.config,
          menu: rolledBackData.menu,
          metadata: rolledBackData.metadata,
          version: rolledBackData.version,
          updated_by: userId,
          updated_at: new Date()
        })
        .returning('*')) as CmsFeature[];
      await (cmsCacheService as unknown as CmsCacheService).invalidate('features', feature.key);
      await (cmsCacheService as unknown as CmsCacheService).invalidateScope('ui');
      logger.info(
        `[CmsFeatureService] Feature rolled back: ${feature.key} to ${version} by ${userId}`
      );
      return rolledBackFeature;
    } catch (error) {
      logger.error('[CmsFeatureService] Rollback feature failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '回滚功能失败');
    }
  }

  async getFeatureHistory(
    id: string,
    options: HistoryQueryOptions = {}
  ): Promise<FeatureHistoryResponse> {
    const { page = 1, limit = 20 } = options;
    try {
      const feature = await this.getFeatureById(id);
      const offset = (page - 1) * limit;
      const totalCount = (await db('config_snapshots')
        .where({ scope: 'features', key: feature.key })
        .count('* as count')) as Array<{ count: number }>;
      const history = (await db('config_snapshots')
        .where({ scope: 'features', key: feature.key })
        .select(['version', 'action', 'description', 'created_by', 'created_at'])
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)) as Array<{
        version: number;
        action: string;
        description: string;
        created_by: string | number;
        created_at: string;
      }>;
      return {
        history: history.map((h) => ({
          ...h,
          action: h.action as 'create' | 'update' | 'publish' | 'delete' | 'rollback'
        })),
        pagination: {
          current: page,
          pageSize: limit,
          total: parseInt(String(totalCount[0].count)),
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      };
    } catch (error) {
      logger.error('[CmsFeatureService] Get feature history failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '获取功能历史失败');
    }
  }

  async batchUpdateFeatures(
    ids: string[],
    updateData: UpdateFeatureData,
    userId: string
  ): Promise<BatchUpdateResult> {
    try {
      const results: BatchUpdateResult = { success: [], failed: [] };
      for (const id of ids) {
        try {
          const updated = await this.updateFeature(id, updateData, userId);
          results.success.push(updated);
        } catch (error) {
          results.failed.push({
            id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      logger.info(
        `[CmsFeatureService] Batch update completed: ${results.success.length} success, ${results.failed.length} failed`
      );
      return results;
    } catch (error) {
      logger.error('[CmsFeatureService] Batch update failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '批量更新功能失败');
    }
  }
}

export default new CmsFeatureService();
