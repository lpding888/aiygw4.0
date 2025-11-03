const cmsFeatureService = require('../services/cmsFeature.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * CMS功能控制器
 */
class CmsFeatureController {
  /**
   * 获取功能列表
   */
  async getFeatures(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        status,
        enabled,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const result = await cmsFeatureService.getFeatures({
        page: parseInt(page),
        limit: parseInt(limit),
        category,
        status,
        enabled: enabled !== undefined ? enabled === 'true' : undefined,
        search,
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsFeatureController] Get features failed:', error);
      next(error);
    }
  }

  /**
   * 获取功能详情
   */
  async getFeatureById(req, res, next) {
    try {
      const { id } = req.params;
      const feature = await cmsFeatureService.getFeatureById(id);

      res.json({
        success: true,
        data: feature,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsFeatureController] Get feature by ID failed:', error);
      next(error);
    }
  }

  /**
   * 创建功能
   */
  async createFeature(req, res, next) {
    try {
      const userId = req.user.id;
      const featureData = {
        ...req.body,
        created_by: userId
      };

      const feature = await cmsFeatureService.createFeature(featureData, userId);

      res.status(201).json({
        success: true,
        data: feature,
        message: '功能创建成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsFeatureController] Create feature failed:', error);
      next(error);
    }
  }

  /**
   * 更新功能
   */
  async updateFeature(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = {
        ...req.body,
        updated_by: userId
      };

      const feature = await cmsFeatureService.updateFeature(id, updateData, userId);

      res.json({
        success: true,
        data: feature,
        message: '功能更新成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsFeatureController] Update feature failed:', error);
      next(error);
    }
  }

  /**
   * 删除功能
   */
  async deleteFeature(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await cmsFeatureService.deleteFeature(id, userId);

      res.json({
        success: true,
        message: '功能删除成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsFeatureController] Delete feature failed:', error);
      next(error);
    }
  }

  /**
   * 发布功能
   */
  async publishFeature(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const feature = await cmsFeatureService.publishFeature(id, userId);

      res.json({
        success: true,
        data: feature,
        message: '功能发布成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsFeatureController] Publish feature failed:', error);
      next(error);
    }
  }

  /**
   * 回滚功能
   */
  async rollbackFeature(req, res, next) {
    try {
      const { id } = req.params;
      const { version } = req.body;
      const userId = req.user.id;

      if (!version) {
        throw new AppError('版本号不能为空', 400, 'VERSION_REQUIRED');
      }

      const feature = await cmsFeatureService.rollbackFeature(id, version, userId);

      res.json({
        success: true,
        data: feature,
        message: `功能已回滚到版本 ${version}`,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsFeatureController] Rollback feature failed:', error);
      next(error);
    }
  }

  /**
   * 获取功能历史
   */
  async getFeatureHistory(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await cmsFeatureService.getFeatureHistory(id, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsFeatureController] Get feature history failed:', error);
      next(error);
    }
  }

  /**
   * 批量更新功能状态
   */
  async batchUpdateFeatures(req, res, next) {
    try {
      const { ids, updates } = req.body;
      const userId = req.user.id;

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new AppError('功能ID列表不能为空', 400, 'IDS_REQUIRED');
      }

      const result = await cmsFeatureService.batchUpdateFeatures(ids, updates, userId);

      res.json({
        success: true,
        data: result,
        message: `批量更新完成: ${result.success.length} 成功, ${result.failed.length} 失败`,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsFeatureController] Batch update features failed:', error);
      next(error);
    }
  }

  /**
   * 切换功能启用状态
   */
  async toggleFeature(req, res, next) {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const userId = req.user.id;

      const feature = await cmsFeatureService.updateFeature(id, { enabled }, userId);

      res.json({
        success: true,
        data: feature,
        message: `功能已${enabled ? '启用' : '禁用'}`,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsFeatureController] Toggle feature failed:', error);
      next(error);
    }
  }

  /**
   * 获取功能分类列表
   */
  async getFeatureCategories(req, res, next) {
    try {
      const db = require('../config/database');
      const categories = await db('cms_features')
        .distinct('category')
        .select('category')
        .whereNotNull('category')
        .orderBy('category');

      res.json({
        success: true,
        data: categories.map(c => c.category),
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsFeatureController] Get feature categories failed:', error);
      next(error);
    }
  }
}

module.exports = new CmsFeatureController();