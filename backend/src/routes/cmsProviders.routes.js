const express = require('express');
const router = express.Router();
const cmsProviderController = require('../controllers/cmsProvider.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const RequirePermissionMiddleware = require('../middlewares/requirePermission.middleware');
const rbacService = require('../services/rbac.service');

/**
 * CMS供应商路由
 * 所有路由都需要认证
 */
router.use(authenticate);

/**
 * 获取供应商列表 - viewer权限
 */
router.get('/',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROVIDERS, rbacService.ACTIONS.READ),
  cmsProviderController.getProviders
);

/**
 * 获取供应商统计 - viewer权限
 */
router.get('/stats',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROVIDERS, rbacService.ACTIONS.READ),
  cmsProviderController.getProviderStats
);

/**
 * 获取供应商类型列表 - viewer权限
 */
router.get('/types',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROVIDERS, rbacService.ACTIONS.READ),
  cmsProviderController.getProviderTypes
);

/**
 * 获取供应商详情 - viewer权限
 */
router.get('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROVIDERS, rbacService.ACTIONS.READ),
  cmsProviderController.getProviderById
);

/**
 * 测试供应商连接 - viewer权限
 */
router.post('/:id/test',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROVIDERS, rbacService.ACTIONS.TEST),
  cmsProviderController.testProvider
);

/**
 * 创建供应商 - editor权限
 */
router.post('/',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROVIDERS, rbacService.ACTIONS.CREATE),
  cmsProviderController.createProvider
);

/**
 * 更新供应商 - editor权限
 */
router.put('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROVIDERS, rbacService.ACTIONS.UPDATE),
  cmsProviderController.updateProvider
);

/**
 * 切换供应商启用状态 - editor权限
 */
router.patch('/:id/toggle',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROVIDERS, rbacService.ACTIONS.UPDATE),
  cmsProviderController.toggleProvider
);

/**
 * 批量测试所有供应商 - editor权限
 */
router.post('/test-all',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROVIDERS, rbacService.ACTIONS.TEST),
  cmsProviderController.testAllProviders
);

/**
 * 删除供应商 - admin权限
 */
router.delete('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROVIDERS, rbacService.ACTIONS.DELETE),
  cmsProviderController.deleteProvider
);

module.exports = router;