const uiSchemaService = require('../services/uiSchema.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * UI Schema控制器
 * 提供动态菜单、表单模板、页面配置等API
 */
class UiSchemaController {
  /**
   * 获取用户菜单配置
   */
  async getMenus(req, res, next) {
    try {
      const userRole = req.userRole || 'viewer';
      const menus = await uiSchemaService.getMenus(userRole);

      res.json({
        success: true,
        data: menus,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[UiSchemaController] Get menus failed:', error);
      next(error);
    }
  }

  /**
   * 获取UI Schema配置
   */
  async getUiSchema(req, res, next) {
    try {
      const userRole = req.userRole || 'viewer';
      const schema = await uiSchemaService.getUiSchema(userRole);

      res.json({
        success: true,
        data: schema,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[UiSchemaController] Get UI schema failed:', error);
      next(error);
    }
  }

  /**
   * 获取特定功能的UI配置
   */
  async getFeatureUiConfig(req, res, next) {
    try {
      const { featureKey } = req.params;
      const userRole = req.userRole || 'viewer';

      const config = await uiSchemaService.getFeatureUiConfig(featureKey, userRole);

      res.json({
        success: true,
        data: config,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[UiSchemaController] Get feature UI config failed:', error);
      next(error);
    }
  }

  /**
   * 失效UI缓存
   */
  async invalidateCache(req, res, next) {
    try {
      await uiSchemaService.invalidateCache();

      res.json({
        success: true,
        message: 'UI缓存已失效',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[UiSchemaController] Invalidate cache failed:', error);
      next(error);
    }
  }

  /**
   * 获取用户角色信息
   */
  async getUserRole(req, res, next) {
    try {
      const userRole = req.userRole || 'viewer';

      res.json({
        success: true,
        data: {
          role: userRole,
          permissions: req.userPermissions || {}
        },
        requestId: req.id
      });

    } catch (error) {
      logger.error('[UiSchemaController] Get user role failed:', error);
      next(error);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(req, res, next) {
    try {
      const stats = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          uiSchema: 'ok',
          cache: 'ok',
          rbac: 'ok'
        }
      };

      res.json({
        success: true,
        data: stats,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[UiSchemaController] Health check failed:', error);
      next(error);
    }
  }
}

module.exports = new UiSchemaController();