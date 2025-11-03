const configCacheService = require('../cache/config-cache');
const { knex } = require('../db/connection');
const logger = require('../utils/logger');
const { hasPermission } = require('../utils/rbac');
const crypto = require('crypto');

/**
 * Feature Catalog服务
 *
 * 功能目录管理，支持版本控制、发布、回滚和审计
 */

interface FeatureConfig {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  config: Record<string, any>;
  enabled: boolean;
  menuPath: string;
  icon?: string;
  color?: string;
  quotaCost: number;
  accessScope: 'all' | 'plan' | 'whitelist';
  allowedAccounts?: string[];
  outputType: string;
  saveToAssetLibrary: boolean;
  version: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FeatureSnapshot {
  id: string;
  featureId: string;
  version: string;
  config: FeatureConfig;
  action: 'create' | 'update' | 'delete' | 'publish' | 'rollback';
  description: string;
  createdBy: string;
  createdAt: Date;
}

class FeatureCatalogService {
  private readonly CACHE_SCOPE = 'features';
  private readonly DEFAULT_VERSION = '1.0.0';

  /**
   * 创建功能配置
   */
  async createFeature(featureData: Partial<FeatureConfig>, createdBy: string): Promise<FeatureConfig> {
    const feature: FeatureConfig = {
      id: this.generateId(),
      key: featureData.key!,
      name: featureData.name!,
      description: featureData.description || '',
      category: featureData.category || 'image',
      config: featureData.config || {},
      enabled: featureData.enabled !== false,
      menuPath: featureData.menuPath || `/admin/${featureData.key}`,
      icon: featureData.icon,
      color: featureData.color,
      quotaCost: featureData.quotaCost || 1,
      accessScope: featureData.accessScope || 'all',
      allowedAccounts: featureData.allowedAccounts,
      outputType: featureData.outputType || 'singleImage',
      saveToAssetLibrary: featureData.saveToAssetLibrary !== false,
      version: '1.0.0',
      status: 'draft',
      createdBy,
      updatedBy: createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      await knex.transaction(async (trx) => {
        // 插入功能配置
        await trx('features').insert({
          id: feature.id,
          key: feature.key,
          name: feature.name,
          description: feature.description,
          category: feature.category,
          config: JSON.stringify(feature.config),
          enabled: feature.enabled,
          menu_path: feature.menuPath,
          icon: feature.icon,
          color: feature.color,
          quota_cost: feature.quotaCost,
          access_scope: feature.accessScope,
          allowed_accounts: JSON.stringify(feature.allowedAccounts),
          output_type: feature.outputType,
          save_to_asset_library: feature.saveToAssetLibrary,
          version: feature.version,
          status: feature.status,
          created_by: feature.createdBy,
          updated_by: feature.updatedBy,
          created_at: feature.createdAt,
          updated_at: feature.updatedAt
        });

        // 创建快照
        await this.createSnapshot(trx, feature, 'create', '创建功能配置', createdBy);
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('功能配置已创建', { featureId: feature.id, key: feature.key, createdBy });
      return feature;
    } catch (error) {
      logger.error('创建功能配置失败:', error);
      throw error;
    }
  }

  /**
   * 更新功能配置
   */
  async updateFeature(featureId: string, updateData: Partial<FeatureConfig>, updatedBy: string): Promise<FeatureConfig> {
    const existingFeature = await this.getFeature(featureId);
    if (!existingFeature) {
      throw new Error('功能配置不存在');
    }

    try {
      await knex.transaction(async (trx) => {
        // 更新版本号
        const newVersion = this.incrementVersion(existingFeature.version);

        // 更新功能配置
        await trx('features')
          .where('id', featureId)
          .update({
            ...updateData,
            version: newVersion,
            updated_by: updatedBy,
            updated_at: new Date(),
            // 如果有字段变更，设置为草稿状态
            status: 'draft'
          });

        // 创建快照
        const updatedFeature = { ...existingFeature, ...updateData, version: newVersion, updatedBy };
        await this.createSnapshot(trx, updatedFeature, 'update', '更新功能配置', updatedBy);
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('功能配置已更新', { featureId, updatedBy });
      return await this.getFeature(featureId);
    } catch (error) {
      logger.error('更新功能配置失败:', error);
      throw error;
    }
  }

  /**
   * 发布功能配置
   */
  async publishFeature(featureId: string, publishedBy: string): Promise<boolean> {
    const feature = await this.getFeature(featureId);
    if (!feature) {
      throw new Error('功能配置不存在');
    }

    if (feature.status === 'published') {
      logger.warn('功能配置已经是发布状态', { featureId });
      return true;
    }

    try {
      await knex.transaction(async (trx) => {
        // 更新为发布状态
        await trx('features')
          .where('id', featureId)
          .update({
            status: 'published',
            published_at: new Date(),
            updated_by: publishedBy,
            updated_at: new Date()
          });

        // 创建发布快照
        const publishedFeature = { ...feature, status: 'published', publishedBy, publishedAt: new Date() };
        await this.createSnapshot(trx, publishedFeature, 'publish', '发布功能配置', publishedBy);
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('功能配置已发布', { featureId, key: feature.key, publishedBy });
      return true;
    } catch (error) {
      logger.error('发布功能配置失败:', error);
      throw error;
    }
  }

  /**
   * 回滚功能配置
   */
  async rollbackFeature(featureId: string, targetVersion: string, rolledBy: string, reason?: string): Promise<boolean> {
    const feature = await this.getFeature(featureId);
    if (!feature) {
      throw new Error('功能配置不存在');
    }

    // 获取目标版本的快照
    const snapshot = await knex('feature_snapshots')
      .where('feature_id', featureId)
      .where('version', targetVersion)
      .where('action', 'in', ['create', 'update', 'publish'])
      .orderBy('created_at', 'desc')
      .first();

    if (!snapshot) {
      throw new Error(`版本 ${targetVersion} 的快照不存在`);
    }

    try {
      await knex.transaction(async (trx) => {
        // 恢复功能配置
        const rollbackConfig = JSON.parse(snapshot.config);

        await trx('features')
          .where('id', featureId)
          .update({
            name: rollbackConfig.name,
            description: rollbackConfig.description,
            category: rollbackConfig.category,
            config: rollbackConfig.config,
            enabled: rollbackConfig.enabled,
            menu_path: rollbackConfig.menuPath,
            icon: rollbackConfig.icon,
            color: rollbackConfig.color,
            quota_cost: rollbackConfig.quotaCost,
            access_scope: rollbackConfig.accessScope,
            allowed_accounts: JSON.stringify(rollbackConfig.allowedAccounts),
            output_type: rollbackConfig.outputType,
            save_to_asset_library: rollbackConfig.saveToAssetLibrary,
            version: this.incrementVersion(targetVersion),
            status: 'published',
            updated_by: rolledBy,
            updated_at: new Date()
          });

        // 创建回滚快照
        const rolledBackFeature = { ...rollbackConfig, id: featureId, version: this.incrementVersion(targetVersion) };
        await this.createSnapshot(trx, rolledBackFeature, 'rollback', `回滚到版本 ${targetVersion}: ${reason || ''}`, rolledBy);
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('功能配置已回滚', { featureId, targetVersion, rolledBy, reason });
      return true;
    } catch (error) {
      logger.error('回滚功能配置失败:', error);
      throw error;
    }
  }

  /**
   * 删除功能配置
   */
  async deleteFeature(featureId: string, deletedBy: string): Promise<boolean> {
    const feature = await this.getFeature(featureId);
    if (!feature) {
      throw new Error('功能配置不存在');
    }

    if (feature.status === 'published') {
      throw new Error('已发布的功能配置不能直接删除，请先回滚或归档');
    }

    try {
      await knex.transaction(async (trx) => {
        // 创建删除快照
        await this.createSnapshot(trx, feature, 'delete', '删除功能配置', deletedBy);

        // 软删除功能配置
        await trx('features')
          .where('id', featureId)
          .update({
            status: 'archived',
            updated_by: deletedBy,
            updated_at: new Date()
          });
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('功能配置已删除', { featureId, deletedBy });
      return true;
    } catch (error) {
      logger.error('删除功能配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取功能配置
   */
  async getFeature(featureId: string): Promise<FeatureConfig | null> {
    try {
      const cacheKey = `feature:${featureId}`;

      return await configCacheService.getOrSet(
        {
          scope: this.CACHE_SCOPE,
          key: cacheKey,
          version: this.DEFAULT_VERSION
        },
        async () => {
          const feature = await knex('features')
            .where('id', featureId)
            .first();

          if (feature) {
            return this.mapDbRowToFeature(feature);
          }

          return null;
        }
      );
    } catch (error) {
      logger.error(`获取功能配置失败: ${featureId}`, error);
      return null;
    }
  }

  /**
   * 根据key获取功能配置
   */
  async getFeatureByKey(key: string): Promise<FeatureConfig | null> {
    try {
      const feature = await knex('features')
        .where('key', key)
        .first();

      return feature ? this.mapDbRowToFeature(feature) : null;
    } catch (error) {
      logger.error(`根据key获取功能配置失败: ${key}`, error);
      return null;
    }
  }

  /**
   * 获取功能列表
   */
  async getFeatures(filters: {
    status?: string;
    category?: string;
    enabled?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<{ features: FeatureConfig[]; total: number }> {
    const {
      status,
      category,
      enabled,
      page = 1,
      limit = 20
    } = filters;

    try {
      let query = knex('features').select('*');

      // 应用过滤条件
      if (status) {
        query = query.where('status', status);
      }
      if (category) {
        query = query.where('category', category);
      }
      if (enabled !== undefined) {
        query = query.where('enabled', enabled);
      }

      // 获取总数
      const totalQuery = query.clone().clearSelect().count('* as count');
      const [{ count }] = await totalQuery;
      const total = parseInt(count);

      // 分页查询
      const offset = (page - 1) * limit;
      const features = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      const mappedFeatures = features.map(feature => this.mapDbRowToFeature(feature));

      return { features: mappedFeatures, total };
    } catch (error) {
      logger.error('获取功能列表失败:', error);
      return { features: [], total: 0 };
    }
  }

  /**
   * 获取用户可见的功能列表
   */
  async getVisibleFeatures(userId: string, userRole: string = 'viewer'): Promise<FeatureConfig[]> {
    try {
      const cacheKey = `visible_features:${userRole}`;

      return await configCacheService.getOrSet(
        {
          scope: this.CACHE_SCOPE,
          key: cacheKey,
          version: this.DEFAULT_VERSION
        },
        async () => {
          let query = knex('features')
            .where('enabled', true)
            .where('status', 'published')
            .orderBy('menu_path', 'asc');

          // 根据用户角色过滤
          if (userRole === 'viewer') {
            // viewer只能看到基础功能
            query = query.where('category', 'in', ['image', 'text']);
          }

          const features = await query;
          return features
            .map(feature => this.mapDbRowToFeature(feature))
            .filter(feature => this.canAccessFeature(feature, userId, userRole));
        }
      );
    } catch (error) {
      logger.error('获取可见功能列表失败:', error);
      return [];
    }
  }

  /**
   * 获取功能快照历史
   */
  async getFeatureHistory(featureId: string): Promise<FeatureSnapshot[]> {
    try {
      const snapshots = await knex('feature_snapshots')
        .where('feature_id', featureId)
        .orderBy('created_at', 'desc');

      return snapshots.map(snapshot => ({
        id: snapshot.id,
        featureId: snapshot.feature_id,
        version: snapshot.version,
        config: JSON.parse(snapshot.config),
        action: snapshot.action,
        description: snapshot.description,
        createdBy: snapshot.created_by,
        createdAt: snapshot.created_at
      }));
    } catch (error) {
      logger.error(`获取功能历史失败: ${featureId}`, error);
      return [];
    }
  }

  /**
   * 获取功能统计信息
   */
  async getStats(): Promise<any> {
    try {
      const [statusStats, categoryStats, totalFeatures] = await Promise.all([
        knex('features')
          .select('status')
          .count('* as count')
          .groupBy('status'),
        knex('features')
          .select('category')
          .count('* as count')
          .groupBy('category'),
        knex('features').count('* as total').first()
      ]);

      return {
        total: totalFeatures.total || 0,
        byStatus: statusStats.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        byCategory: categoryStats.reduce((acc, row) => {
          acc[row.category] = parseInt(row.count);
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('获取功能统计失败:', error);
      return {
        total: 0,
        byStatus: {},
        byCategory: {}
      };
    }
  }

  /**
   * 创建快照
   */
  private async createSnapshot(trx: any, feature: FeatureConfig, action: string, description: string, createdBy: string): Promise<void> {
    await trx('feature_snapshots').insert({
      id: this.generateId(),
      feature_id: feature.id,
      version: feature.version,
      config: JSON.stringify(feature),
      action,
      description,
      created_by: createdBy,
      created_at: new Date()
    });
  }

  /**
   * 检查用户是否可以访问功能
   */
  private canAccessFeature(feature: FeatureConfig, userId: string, userRole: string): boolean {
    // 管理员可以访问所有功能
    if (userRole === 'admin') {
      return true;
    }

    // 检查访问范围
    switch (feature.accessScope) {
      case 'all':
        return true;
      case 'plan':
        // 检查用户是否有会员资格
        // 这里需要查询用户表，暂时返回true
        return true;
      case 'whitelist':
        // 检查用户是否在白名单中
        return feature.allowedAccounts?.includes(userId) || false;
      default:
        return false;
    }
  }

  /**
   * 将数据库行映射为FeatureConfig对象
   */
  private mapDbRowToFeature(row: any): FeatureConfig {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      category: row.category,
      config: JSON.parse(row.config || '{}'),
      enabled: Boolean(row.enabled),
      menuPath: row.menu_path,
      icon: row.icon,
      color: row.color,
      quotaCost: row.quota_cost,
      accessScope: row.access_scope,
      allowedAccounts: row.allowed_accounts ? JSON.parse(row.allowed_accounts) : undefined,
      outputType: row.output_type,
      saveToAssetLibrary: Boolean(row.save_to_asset_library),
      version: row.version,
      status: row.status,
      publishedAt: row.published_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 递增版本号
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `feature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 失效缓存
   */
  private async invalidateCache(): Promise<void> {
    await configCacheService.invalidate(this.CACHE_SCOPE);
  }
}

const featureCatalogService = new FeatureCatalogService();
module.exports = featureCatalogService;