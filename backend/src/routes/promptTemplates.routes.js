const express = require('express');
const router = express.Router();
const promptTemplateController = require('../controllers/promptTemplate.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const RequirePermissionMiddleware = require('../middlewares/requirePermission.middleware');
const rbacService = require('../services/rbac.service');

/**
 * Prompt Templates 路由
 * 所有路由都需要认证
 */
router.use(authenticate);

/**
 * 获取模板列表 - viewer权限
 */
router.get('/',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.READ),
  promptTemplateController.getTemplates
);

/**
 * 获取模板统计 - viewer权限
 */
router.get('/stats',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.READ),
  promptTemplateController.getTemplateStats
);

/**
 * 获取模板类别列表 - viewer权限
 */
router.get('/categories',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.READ),
  promptTemplateController.getTemplateCategories
);

/**
 * 获取模板示例 - viewer权限
 */
router.get('/examples',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.READ),
  promptTemplateController.getTemplateExamples
);

/**
 * 批量预览模板 - editor权限
 */
router.post('/batch-preview',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.UPDATE),
  promptTemplateController.batchPreviewTemplates
);

/**
 * 健康检查 - viewer权限
 */
router.get('/health',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.READ),
  promptTemplateController.healthCheck
);

/**
 * 根据key获取模板 - viewer权限
 */
router.get('/key/:key',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.READ),
  promptTemplateController.getTemplateByKey
);

/**
 * 获取模板详情 - viewer权限
 */
router.get('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.READ),
  promptTemplateController.getTemplateById
);

/**
 * 获取模板版本历史 - viewer权限
 */
router.get('/:id/versions',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.READ),
  promptTemplateController.getTemplateVersions
);

/**
 * 预览模板 - editor权限
 */
router.post('/:id/preview',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.UPDATE),
  promptTemplateController.previewTemplate
);

/**
 * 验证模板 - editor权限
 */
router.post('/:id/validate',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.UPDATE),
  promptTemplateController.validateTemplate
);

/**
 * 发布模板 - editor权限
 */
router.post('/:id/publish',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.UPDATE),
  promptTemplateController.publishTemplate
);

/**
 * 归档模板 - editor权限
 */
router.post('/:id/archive',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.UPDATE),
  promptTemplateController.archiveTemplate
);

/**
 * 回滚到指定版本 - editor权限
 */
router.post('/:id/rollback',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.UPDATE),
  promptTemplateController.rollbackToVersion
);

/**
 * 复制模板 - editor权限
 */
router.post('/:id/duplicate',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.CREATE),
  promptTemplateController.duplicateTemplate
);

/**
 * 创建模板 - editor权限
 */
router.post('/',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.CREATE),
  promptTemplateController.createTemplate
);

/**
 * 更新模板 - editor权限
 */
router.put('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.UPDATE),
  promptTemplateController.updateTemplate
);

/**
 * 删除模板 - admin权限
 */
router.delete('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PROMPT_TEMPLATES, rbacService.ACTIONS.DELETE),
  promptTemplateController.deleteTemplate
);

module.exports = router;