const express = require('express');
const router = express.Router();
const uiSchemaController = require('../controllers/uiSchema.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const RequirePermissionMiddleware = require('../middlewares/requirePermission.middleware');
const rbacService = require('../services/rbac.service');

/**
 * UI Schema路由
 * 提供动态菜单、表单模板、页面配置等API
 */

// 获取菜单和UI配置可以不需要认证（用于前端初始化）
// 但需要通过权限控制来过滤可见内容

/**
 * 获取用户菜单配置 - viewer权限
 */
router.get('/menus',
  RequirePermissionMiddleware.checkRoute({ skipAuth: false }),
  uiSchemaController.getMenus
);

/**
 * 获取UI Schema配置 - viewer权限
 */
router.get('/schema',
  RequirePermissionMiddleware.checkRoute({ skipAuth: false }),
  uiSchemaController.getUiSchema
);

/**
 * 获取特定功能的UI配置 - viewer权限
 */
router.get('/schema/:featureKey',
  RequirePermissionMiddleware.checkRoute({ skipAuth: false }),
  uiSchemaController.getFeatureUiConfig
);

/**
 * 获取用户角色信息
 */
router.get('/role',
  authenticate,
  uiSchemaController.getUserRole
);

/**
 * 失效UI缓存 - editor权限
 */
router.post('/invalidate',
  authenticate,
  RequirePermissionMiddleware.require(rbacService.RESOURCES.SYSTEM, rbacService.ACTIONS.UPDATE),
  uiSchemaController.invalidateCache
);

/**
 * 健康检查
 */
router.get('/health',
  uiSchemaController.healthCheck
);

module.exports = router;