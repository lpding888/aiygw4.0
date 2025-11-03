const express = require('express');
const router = express.Router();
const cmsFeatureController = require('../controllers/cmsFeature.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const RequirePermissionMiddleware = require('../middlewares/requirePermission.middleware');
const rbacService = require('../services/rbac.service');

/**
 * CMS功能路由
 * 所有路由都需要认证
 */
router.use(authenticate);

/**
 * 获取功能列表 - viewer权限
 */
router.get('/',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.FEATURES, rbacService.ACTIONS.READ),
  cmsFeatureController.getFeatures
);

/**
 * 获取功能分类列表 - viewer权限
 */
router.get('/categories',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.FEATURES, rbacService.ACTIONS.READ),
  cmsFeatureController.getFeatureCategories
);

/**
 * 获取功能详情 - viewer权限
 */
router.get('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.FEATURES, rbacService.ACTIONS.READ),
  cmsFeatureController.getFeatureById
);

/**
 * 获取功能历史 - viewer权限
 */
router.get('/:id/history',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.FEATURES, rbacService.ACTIONS.READ),
  cmsFeatureController.getFeatureHistory
);

/**
 * 创建功能 - editor权限
 */
router.post('/',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.FEATURES, rbacService.ACTIONS.CREATE),
  cmsFeatureController.createFeature
);

/**
 * 更新功能 - editor权限
 */
router.put('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.FEATURES, rbacService.ACTIONS.UPDATE),
  cmsFeatureController.updateFeature
);

/**
 * 切换功能启用状态 - editor权限
 */
router.patch('/:id/toggle',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.FEATURES, rbacService.ACTIONS.UPDATE),
  cmsFeatureController.toggleFeature
);

/**
 * 批量更新功能 - editor权限
 */
router.patch('/batch',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.FEATURES, rbacService.ACTIONS.UPDATE),
  cmsFeatureController.batchUpdateFeatures
);

/**
 * 删除功能 - admin权限
 */
router.delete('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.FEATURES, rbacService.ACTIONS.DELETE),
  cmsFeatureController.deleteFeature
);

/**
 * 发布功能 - admin权限
 */
router.post('/:id/publish',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.FEATURES, rbacService.ACTIONS.PUBLISH),
  cmsFeatureController.publishFeature
);

/**
 * 回滚功能 - admin权限
 */
router.post('/:id/rollback',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.FEATURES, rbacService.ACTIONS.ROLLBACK),
  cmsFeatureController.rollbackFeature
);

module.exports = router;