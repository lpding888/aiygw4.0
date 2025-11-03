const cmsProviderService = require('../services/cmsProvider.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * CMS供应商控制器
 */
class CmsProviderController {
  /**
   * 获取供应商列表
   */
  async getProviders(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        status,
        enabled,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const result = await cmsProviderService.getProviders({
        page: parseInt(page),
        limit: parseInt(limit),
        type,
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
      logger.error('[CmsProviderController] Get providers failed:', error);
      next(error);
    }
  }

  /**
   * 获取供应商详情
   */
  async getProviderById(req, res, next) {
    try {
      const { id } = req.params;
      const provider = await cmsProviderService.getProviderById(id);

      res.json({
        success: true,
        data: provider,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsProviderController] Get provider by ID failed:', error);
      next(error);
    }
  }

  /**
   * 创建供应商
   */
  async createProvider(req, res, next) {
    try {
      const userId = req.user.id;
      const providerData = {
        ...req.body,
        created_by: userId
      };

      const provider = await cmsProviderService.createProvider(providerData, userId);

      res.status(201).json({
        success: true,
        data: provider,
        message: '供应商创建成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsProviderController] Create provider failed:', error);
      next(error);
    }
  }

  /**
   * 更新供应商
   */
  async updateProvider(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = {
        ...req.body,
        updated_by: userId
      };

      const provider = await cmsProviderService.updateProvider(id, updateData, userId);

      res.json({
        success: true,
        data: provider,
        message: '供应商更新成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsProviderController] Update provider failed:', error);
      next(error);
    }
  }

  /**
   * 删除供应商
   */
  async deleteProvider(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await cmsProviderService.deleteProvider(id, userId);

      res.json({
        success: true,
        message: '供应商删除成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsProviderController] Delete provider failed:', error);
      next(error);
    }
  }

  /**
   * 测试供应商连接
   */
  async testProvider(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const testResult = await cmsProviderService.testProvider(id, userId);

      res.json({
        success: true,
        data: testResult,
        message: testResult.success ? '连接测试成功' : '连接测试失败',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsProviderController] Test provider failed:', error);
      next(error);
    }
  }

  /**
   * 获取供应商统计
   */
  async getProviderStats(req, res, next) {
    try {
      const stats = await cmsProviderService.getProviderStats();

      res.json({
        success: true,
        data: stats,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsProviderController] Get provider stats failed:', error);
      next(error);
    }
  }

  /**
   * 批量测试所有供应商
   */
  async testAllProviders(req, res, next) {
    try {
      const userId = req.user.id;

      const results = await cmsProviderService.testAllProviders(userId);

      res.json({
        success: true,
        data: results,
        message: `批量测试完成: ${results.success} 成功, ${results.failed} 失败`,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsProviderController] Batch test providers failed:', error);
      next(error);
    }
  }

  /**
   * 获取供应商类型列表
   */
  async getProviderTypes(req, res, next) {
    try {
      const db = require('../config/database');
      const types = await db('provider_endpoints')
        .distinct('type')
        .select('type')
        .whereNotNull('type')
        .orderBy('type');

      res.json({
        success: true,
        data: types.map(t => t.type),
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsProviderController] Get provider types failed:', error);
      next(error);
    }
  }

  /**
   * 切换供应商启用状态
   */
  async toggleProvider(req, res, next) {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const userId = req.user.id;

      const provider = await cmsProviderService.updateProvider(id, { enabled }, userId);

      res.json({
        success: true,
        data: provider,
        message: `供应商已${enabled ? '启用' : '禁用'}`,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[CmsProviderController] Toggle provider failed:', error);
      next(error);
    }
  }
}

module.exports = new CmsProviderController();