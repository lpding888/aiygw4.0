const express = require('express');
const router = express.Router();
const mcpEndpointController = require('../controllers/mcpEndpoint.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const RequirePermissionMiddleware = require('../middlewares/requirePermission.middleware');
const rbacService = require('../services/rbac.service');

/**
 * MCP Endpoints 路由
 * 所有路由都需要认证
 */
router.use(authenticate);

/**
 * 获取端点列表 - viewer权限
 */
router.get('/',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.READ),
  mcpEndpointController.getEndpoints
);

/**
 * 获取端点统计 - viewer权限
 */
router.get('/stats',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.READ),
  mcpEndpointController.getEndpointStats
);

/**
 * 获取服务器类型列表 - viewer权限
 */
router.get('/server-types',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.READ),
  mcpEndpointController.getServerTypes
);

/**
 * 获取模板配置 - viewer权限
 */
router.get('/templates',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.READ),
  mcpEndpointController.getTemplates
);

/**
 * 批量测试端点 - editor权限
 */
router.post('/batch-test',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.TEST),
  mcpEndpointController.batchTestEndpoints
);

/**
 * 健康检查 - viewer权限
 */
router.get('/health',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.READ),
  mcpEndpointController.healthCheck
);

/**
 * 获取端点详情 - viewer权限
 */
router.get('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.READ),
  mcpEndpointController.getEndpointById
);

/**
 * 测试端点连接 - editor权限
 */
router.post('/:id/test',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.TEST),
  mcpEndpointController.testEndpoint
);

/**
 * 连接端点 - editor权限
 */
router.post('/:id/connect',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.UPDATE),
  mcpEndpointController.connectEndpoint
);

/**
 * 断开端点连接 - editor权限
 */
router.post('/:id/disconnect',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.UPDATE),
  mcpEndpointController.disconnectEndpoint
);

/**
 * 发现工具 - editor权限
 */
router.post('/:id/discover-tools',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.TEST),
  mcpEndpointController.discoverTools
);

/**
 * 执行工具 - editor权限
 */
router.post('/:id/execute',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.UPDATE),
  mcpEndpointController.executeTool
);

/**
 * 创建端点 - editor权限
 */
router.post('/',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.CREATE),
  mcpEndpointController.createEndpoint
);

/**
 * 更新端点 - editor权限
 */
router.put('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.UPDATE),
  mcpEndpointController.updateEndpoint
);

/**
 * 删除端点 - admin权限
 */
router.delete('/:id',
  RequirePermissionMiddleware.require(rbacService.RESOURCES.MCP_ENDPOINTS, rbacService.ACTIONS.DELETE),
  mcpEndpointController.deleteEndpoint
);

module.exports = router;