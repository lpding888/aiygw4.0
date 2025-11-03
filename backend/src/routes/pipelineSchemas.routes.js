const express = require('express');
const router = express.Router();
const pipelineSchemaController = require('../controllers/pipelineSchema.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const RequirePermissionMiddleware = require('../middlewares/requirePermission.middleware');
const rbacService = require('../services/rbac.service');

/**
 * Pipeline Schema 路由
 * 所有路由都需要认证
 */
router.use(authenticate);

/**
 * 获取Schema列表 - viewer权限
 */
router.get('/',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINE_SCHEMAS, rbacService.ACTIONS.READ),
  pipelineSchemaController.getSchemas
);

/**
 * 获取Schema分类列表 - viewer权限
 */
router.get('/categories',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINE_SCHEMAS, rbacService.ACTIONS.READ),
  pipelineSchemaController.getSchemaCategories
);

/**
 * 获取Schema统计 - viewer权限
 */
router.get('/stats',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINE_SCHEMAS, rbacService.ACTIONS.READ),
  pipelineSchemaController.getSchemaStats
);

/**
 * 批量校验Schema - editor权限
 */
router.post('/batch-validate',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINE_SCHEMAS, rbacService.ACTIONS.VALIDATE),
  pipelineSchemaController.batchValidateSchemas
);

/**
 * 获取Schema详情 - viewer权限
 */
router.get('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINE_SCHEMAS, rbacService.ACTIONS.READ),
  pipelineSchemaController.getSchemaById
);

/**
 * 校验Schema - editor权限
 */
router.post('/:id/validate',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINE_SCHEMAS, rbacService.ACTIONS.VALIDATE),
  pipelineSchemaController.validateSchema
);

/**
 * 获取校验历史 - viewer权限
 */
router.get('/:id/validations',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINE_SCHEMAS, rbacService.ACTIONS.READ),
  pipelineSchemaController.getValidationHistory
);

/**
 * 克隆Schema - editor权限
 */
router.post('/:id/clone',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINE_SCHEMAS, rbacService.ACTIONS.CREATE),
  pipelineSchemaController.cloneSchema
);

/**
 * 创建Schema - editor权限
 */
router.post('/',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINE_SCHEMAS, rbacService.ACTIONS.CREATE),
  pipelineSchemaController.createSchema
);

/**
 * 更新Schema - editor权限
 */
router.put('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINE_SCHEMAS, rbacService.ACTIONS.UPDATE),
  pipelineSchemaController.updateSchema
);

/**
 * 删除Schema - admin权限
 */
router.delete('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINE_SCHEMAS, rbacService.ACTIONS.DELETE),
  pipelineSchemaController.deleteSchema
);

module.exports = router;