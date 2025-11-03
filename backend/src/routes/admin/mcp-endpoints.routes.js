const express = require('express');
const router = express.Router();
const mcpEndpointsController = require('../../controllers/admin/mcp-endpoints.controller');
const { authenticateToken } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/require-permission.middleware');
const { validateMcpEndpoint } = require('../../middlewares/validate.middleware');

// 所有路由都需要认证
router.use(authenticateToken);

// 获取MCP终端列表 - viewer权限
router.get('/', requirePermission('mcp_endpoints', 'read'), mcpEndpointsController.getEndpoints);

// 获取单个MCP终端详情 - viewer权限
router.get('/:id', requirePermission('mcp_endpoints', 'read'), mcpEndpointsController.getEndpointById);

// 创建MCP终端 - editor权限
router.post('/',
  requirePermission('mcp_endpoints', 'create'),
  validateMcpEndpoint,
  mcpEndpointsController.createEndpoint
);

// 更新MCP终端 - editor权限
router.put('/:id',
  requirePermission('mcp_endpoints', 'update'),
  validateMcpEndpoint,
  mcpEndpointsController.updateEndpoint
);

// 删除MCP终端 - admin权限
router.delete('/:id', requirePermission('mcp_endpoints', 'delete'), mcpEndpointsController.deleteEndpoint);

// 测试MCP终端连接 - editor权限
router.post('/:id/test', requirePermission('mcp_endpoints', 'test'), mcpEndpointsController.testEndpoint);

// 发现MCP终端工具 - viewer权限
router.get('/:id/tools', requirePermission('mcp_endpoints', 'read'), mcpEndpointsController.discoverTools);

// 执行MCP工具 - editor权限
router.post('/:id/tools/:toolName/execute',
  requirePermission('mcp_endpoints', 'test'),
  mcpEndpointsController.executeTool
);

// 获取测试记录 - viewer权限
router.get('/:id/test-logs', requirePermission('mcp_endpoints', 'read'), mcpEndpointsController.getTestLogs);

// 启用/禁用MCP终端 - editor权限
router.patch('/:id/toggle', requirePermission('mcp_endpoints', 'update'), mcpEndpointsController.toggleEndpoint);

module.exports = router;