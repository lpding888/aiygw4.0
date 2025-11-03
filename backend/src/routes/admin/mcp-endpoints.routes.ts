const express = require('express');
const rateLimit = require('express-rate-limit');
const mcpEndpointsService = require('../../services/mcp-endpoints.service');
const { authenticateToken, requireAdmin } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/require-permission.middleware');
const { body, param, query } = require('express-validator');
const validate = require('../../middlewares/validate.middleware');
const logger = require('../../utils/logger');

const router = express.Router();

// 频率限制
const mcpRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 50, // 最多50次请求
  message: {
    success: false,
    error: {
      code: 4290,
      message: '请求过于频繁，请稍后再试'
    }
  }
});

// 验证规则
const createEndpointValidation = [
  body('name')
    .notEmpty()
    .withMessage('端点名称不能为空')
    .isLength({ max: 100 })
    .withMessage('端点名称最多100个字符'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('描述最多500个字符'),
  body('endpointUrl')
    .notEmpty()
    .withMessage('端点URL不能为空')
    .isURL()
    .withMessage('端点URL格式无效'),
  body('apiKey')
    .notEmpty()
    .withMessage('API密钥不能为空'),
  body('protocolVersion')
    .optional()
    .isIn(['2024-11-05', '2024-10-07'])
    .withMessage('无效的协议版本'),
  body('capabilities')
    .optional()
    .isArray()
    .withMessage('能力列表必须是数组'),
  body('timeoutMs')
    .optional()
    .isInt({ min: 1000, max: 300000 })
    .withMessage('超时时间必须是1000-300000毫秒之间'),
  body('maxRetries')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('最大重试次数必须是0-10之间'),
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('enabled必须是布尔值')
];

const updateEndpointValidation = [
  param('id')
    .notEmpty()
    .withMessage('端点ID不能为空'),
  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('端点名称最多100个字符'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('描述最多500个字符'),
  body('endpointUrl')
    .optional()
    .isURL()
    .withMessage('端点URL格式无效'),
  body('protocolVersion')
    .optional()
    .isIn(['2024-11-05', '2024-10-07'])
    .withMessage('无效的协议版本'),
  body('capabilities')
    .optional()
    .isArray()
    .withMessage('能力列表必须是数组'),
  body('timeoutMs')
    .optional()
    .isInt({ min: 1000, max: 300000 })
    .withMessage('超时时间必须是1000-300000毫秒之间'),
  body('maxRetries')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('最大重试次数必须是0-10之间'),
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('enabled必须是布尔值')
];

const testEndpointValidation = [
  param('id')
    .notEmpty()
    .withMessage('端点ID不能为空')
];

const executeToolValidation = [
  param('id')
    .notEmpty()
    .withMessage('端点ID不能为空'),
  param('toolName')
    .notEmpty()
    .withMessage('工具名称不能为空'),
  body('parameters')
    .optional()
    .isObject()
    .withMessage('参数必须是对象')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('页码必须是1-1000之间的整数'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('每页数量必须是1-100之间的整数'),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'error'])
    .withMessage('无效的状态值'),
  query('enabled')
    .optional()
    .isBoolean()
    .withMessage('enabled必须是布尔值'),
  query('healthy')
    .optional()
    .isBoolean()
    .withMessage('healthy必须是布尔值')
];

/**
 * MCP端点管理路由
 *
 * 管理MCP（Model Context Protocol）连接，支持CRUD、工具发现和测试
 */

// 应用认证中间件
router.use(authenticateToken);
router.use(mcpRateLimit);

// 应用权限中间件
router.use(requirePermission({
  resource: 'mcp_endpoints',
  actions: ['read']
}));

/**
 * 获取MCP端点列表
 * GET /api/admin/mcp-endpoints
 */
router.get('/',
  queryValidation,
  validate,
  async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        enabled,
        healthy
      } = req.query;

      const result = await mcpEndpointsService.getEndpoints({
        status,
        enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
        healthy: healthy === 'true' ? true : healthy === 'false' ? false : undefined,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error('获取MCP端点列表失败:', error);
      next(error);
    }
  }
);

/**
 * 获取MCP端点详情
 * GET /api/admin/mcp-endpoints/:id
 */
router.get('/:id',
  param('id')
    .notEmpty()
    .withMessage('端点ID不能为空'),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const endpoint = await mcpEndpointsService.getEndpoint(id);

      if (!endpoint) {
        return res.status(404).json({
          success: false,
          error: {
            code: 4040,
            message: 'MCP端点不存在'
          },
          requestId: req.id
        });
      }

      res.json({
        success: true,
        data: endpoint,
        requestId: req.id
      });
    } catch (error) {
      logger.error(`获取MCP端点详情失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 获取MCP端点统计信息
 * GET /api/admin/mcp-endpoints/stats
 */
router.get('/stats',
  async (req, res, next) => {
    try {
      const stats = await mcpEndpointsService.getStats();

      res.json({
        success: true,
        data: stats,
        requestId: req.id
      });
    } catch (error) {
      logger.error('获取MCP端点统计失败:', error);
      next(error);
    }
  }
);

// ============ 需要编辑权限的路由 ============
router.use(requirePermission({
  resource: 'mcp_endpoints',
  actions: ['create', 'update', 'delete', 'test', 'execute']
}));

/**
 * 创建MCP端点
 * POST /api/admin/mcp-endpoints
 */
router.post('/',
  requirePermission({
    resource: 'mcp_endpoints',
    actions: ['create']
  }),
  createEndpointValidation,
  validate,
  async (req, res, next) => {
    try {
      const {
        name,
        description,
        endpointUrl,
        apiKey,
        protocolVersion,
        capabilities,
        timeoutMs,
        maxRetries,
        enabled
      } = req.body;

      const endpoint = await mcpEndpointsService.createEndpoint({
        name,
        description,
        endpointUrl,
        protocolVersion,
        capabilities,
        timeoutMs,
        maxRetries,
        enabled
      }, {
        apiKey
      }, req.user.id);

      logger.info('MCP端点已创建', {
        endpointId: endpoint.id,
        name: endpoint.name,
        createdBy: req.user.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        data: endpoint,
        message: 'MCP端点创建成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('创建MCP端点失败:', error);
      next(error);
    }
  }
);

/**
 * 更新MCP端点
 * PUT /api/admin/mcp-endpoints/:id
 */
router.put('/:id',
  requirePermission({
    resource: 'mcp_endpoints',
    actions: ['update']
  }),
  updateEndpointValidation,
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const endpoint = await mcpEndpointsService.updateEndpoint(id, updateData, req.user.id);

      logger.info('MCP端点已更新', {
        endpointId: id,
        updatedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: endpoint,
        message: 'MCP端点更新成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error(`更新MCP端点失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 测试MCP端点连接
 * POST /api/admin/mcp-endpoints/:id/test
 */
router.post('/:id/test',
  requirePermission({
    resource: 'mcp_endpoints',
    actions: ['test']
  }),
  testEndpointValidation,
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await mcpEndpointsService.testEndpoint(id);

      logger.info('MCP端点测试完成', {
        endpointId: id,
        success: result.success,
        latency: result.latency,
        toolsCount: result.toolsCount,
        testedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error(`测试MCP端点失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 批量测试所有MCP端点
 * POST /api/admin/mcp-endpoints/test-all
 */
router.post('/test-all',
  requirePermission({
    resource: 'mcp_endpoints',
    actions: ['test']
  }),
  async (req, res, next) => {
    try {
      const result = await mcpEndpointsService.testAllEndpoints();

      logger.info('批量MCP端点测试完成', {
        total: result.summary.total,
        success: result.summary.success,
        failed: result.summary.failed,
        testedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error('批量测试MCP端点失败:', error);
      next(error);
    }
  }
);

/**
 * 同步所有端点的工具
 * POST /api/admin/mcp-endpoints/sync
 */
router.post('/sync',
  requirePermission({
    resource: 'mcp_endpoints',
    actions: ['update']
  }),
  async (req, res, next) => {
    try {
      const result = await mcpEndpointsService.syncAllEndpoints();

      logger.info('MCP端点同步完成', {
        updated: result.updated,
        errors: result.errors.length,
        syncedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: result,
        message: `已同步 ${result.updated} 个端点`,
        requestId: req.id
      });
    } catch (error) {
      logger.error('同步MCP端点失败:', error);
      next(error);
    }
  }
);

/**
 * 执行MCP工具
 * POST /api/admin/mcp-endpoints/:id/tools/:toolName/execute
 */
router.post('/:id/tools/:toolName/execute',
  requirePermission({
    resource: 'mcp_endpoints',
    actions: ['execute']
  }),
  executeToolValidation,
  validate,
  async (req, res, next) => {
    try {
      const { id, toolName } = req.params;
      const { parameters = {} } = req.body;

      const result = await mcpEndpointsService.executeTool(id, toolName, parameters, req.user.id);

      logger.info('MCP工具执行成功', {
        endpointId: id,
        toolName,
        userId: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error(`执行MCP工具失败: ${req.params.id}/${req.params.toolName}`, error);
      next(error);
    }
  }
);

/**
 * 删除MCP端点
 * DELETE /api/admin/mcp-endpoints/:id
 */
router.delete('/:id',
  requirePermission({
    resource: 'mcp_endpoints',
    actions: ['delete']
  }),
  param('id')
    .notEmpty()
    .withMessage('端点ID不能为空'),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      await mcpEndpointsService.deleteEndpoint(id, req.user.id);

      logger.info('MCP端点已删除', {
        endpointId: id,
        deletedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'MCP端点删除成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error(`删除MCP端点失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

module.exports = router;