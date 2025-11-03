const express = require('express');
const router = express.Router();
const pipelineExecutionController = require('../controllers/pipelineExecution.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const RequirePermissionMiddleware = require('../middlewares/requirePermission.middleware');
const rbacService = require('../services/rbac.service');

/**
 * Pipeline 执行路由
 * 所有路由都需要认证
 */
router.use(authenticate);

/**
 * 获取执行列表 - viewer权限
 */
router.get('/',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINES, rbacService.ACTIONS.READ),
  pipelineExecutionController.getExecutions
);

/**
 * 获取执行统计 - viewer权限
 */
router.get('/stats',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINES, rbacService.ACTIONS.READ),
  pipelineExecutionController.getExecutionStats
);

/**
 * 健康检查 - viewer权限
 */
router.get('/health',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINES, rbacService.ACTIONS.READ),
  pipelineExecutionController.healthCheck
);

/**
 * 批量操作执行 - editor权限
 */
router.post('/batch-operate',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINES, rbacService.ACTIONS.UPDATE),
  pipelineExecutionController.batchOperateExecutions
);

/**
 * 清理过期执行 - admin权限
 */
router.post('/cleanup',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINES, rbacService.ACTIONS.DELETE),
  pipelineExecutionController.cleanupExecutions
);

/**
 * 创建执行任务 - editor权限
 */
router.post('/',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINES, rbacService.ACTIONS.CREATE),
  pipelineExecutionController.createExecution
);

/**
 * 创建并立即启动执行 - editor权限
 */
router.post('/start',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINES, rbacService.ACTIONS.CREATE),
  pipelineExecutionController.createAndStartExecution
);

/**
 * 获取执行详情 - viewer权限
 */
router.get('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINES, rbacService.ACTIONS.READ),
  pipelineExecutionController.getExecution
);

/**
 * 启动执行 - editor权限
 */
router.post('/:id/start',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINES, rbacService.ACTIONS.UPDATE),
  pipelineExecutionController.startExecution
);

/**
 * 取消执行 - editor权限
 */
router.post('/:id/cancel',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINES, rbacService.ACTIONS.UPDATE),
  pipelineExecutionController.cancelExecution
);

/**
 * SSE 实时执行状态 - viewer权限
 */
router.get('/:id/events',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.PIPELINES, rbacService.ACTIONS.READ),
  pipelineExecutionController.getExecutionEvents
);

module.exports = router;