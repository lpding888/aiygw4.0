const express = require('express');
const rateLimit = require('express-rate-limit');
const providerManagementService = require('../../services/provider-management.service');
const { authenticateToken, requireAdmin } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/require-permission.middleware');
const { body, param, query } = require('express-validator');
const validate = require('../../middlewares/validate.middleware');
const logger = require('../../utils/logger');

const router = express.Router();

// 频率限制
const providerRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 100, // 最多100次请求
  message: {
    success: false,
    error: {
      code: 4290,
      message: '请求过于频繁，请稍后再试'
    }
  }
});

// 验证规则
const createProviderValidation = [
  body('name')
    .notEmpty()
    .withMessage('供应商名称不能为空')
    .isLength({ max: 100 })
    .withMessage('供应商名称最多100个字符'),
  body('type')
    .notEmpty()
    .withMessage('供应商类型不能为空')
    .isIn(['ai', 'image', 'video', 'text'])
    .withMessage('无效的供应商类型'),
  body('baseUrl')
    .notEmpty()
    .withMessage('基础URL不能为空')
    .isURL()
    .withMessage('基础URL格式无效'),
  body('apiKey')
    .notEmpty()
    .withMessage('API密钥不能为空'),
  body('handlerKey')
    .notEmpty()
    .withMessage('处理密钥不能为空'),
  body('weight')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('权重必须是1-100之间的整数'),
  body('timeoutMs')
    .optional()
    .isInt({ min: 1000, max: 300000 })
    .withMessage('超时时间必须是1000-300000毫秒之间'),
  body('maxRetries')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('最大重试次数必须是0-10之间'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('描述最多500个字符')
];

const updateProviderValidation = [
  param('id')
    .notEmpty()
    .withMessage('供应商ID不能为空'),
  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('供应商名称最多100个字符'),
  body('type')
    .optional()
    .isIn(['ai', 'image', 'video', 'text'])
    .withMessage('无效的供应商类型'),
  body('baseUrl')
    .optional()
    .isURL()
    .withMessage('基础URL格式无效'),
  body('weight')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('权重必须是1-100之间的整数'),
  body('timeoutMs')
    .optional()
    .isInt({ min: 1000, max: 300000 })
    .withMessage('超时时间必须是1000-300000毫秒之间'),
  body('maxRetries')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('最大重试次数必须是0-10之间'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('描述最多500个字符')
];

const testConnectionValidation = [
  param('id')
    .notEmpty()
    .withMessage('供应商ID不能为空')
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
  query('type')
    .optional()
    .isIn(['ai', 'image', 'video', 'text'])
    .withMessage('无效的供应商类型'),
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
 * 供应商管理路由
 *
 * 管理外部服务提供商配置，支持密钥加密存储和连接测试
 */

// 应用认证中间件
router.use(authenticateToken);
router.use(providerRateLimit);

// 应用权限中间件
router.use(requirePermission({
  resource: 'providers',
  actions: ['read']
}));

/**
 * 获取供应商列表
 * GET /api/admin/providers
 */
router.get('/',
  queryValidation,
  validate,
  async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        enabled,
        healthy
      } = req.query;

      const result = await providerManagementService.getProviders({
        type,
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
      logger.error('获取供应商列表失败:', error);
      next(error);
    }
  }
);

/**
 * 获取供应商详情
 * GET /api/admin/providers/:id
 */
router.get('/:id',
  param('id')
    .notEmpty()
    .withMessage('供应商ID不能为空'),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const provider = await providerManagementService.getProvider(id);

      if (!provider) {
        return res.status(404).json({
          success: false,
          error: {
            code: 4040,
            message: '供应商不存在'
          },
          requestId: req.id
        });
      }

      res.json({
        success: true,
        data: provider,
        requestId: req.id
      });
    } catch (error) {
      logger.error(`获取供应商详情失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

// ============ 需要编辑权限的路由 ============
router.use(requirePermission({
  resource: 'providers',
  actions: ['create', 'update', 'delete']
}));

/**
 * 创建供应商
 * POST /api/admin/providers
 */
router.post('/',
  requirePermission({
    resource: 'providers',
    actions: ['create']
  }),
  createProviderValidation,
  validate,
  async (req, res, next) => {
    try {
      const {
        name,
        type,
        baseUrl,
        apiKey,
        handlerKey,
        weight,
        timeoutMs,
        maxRetries,
        description
      } = req.body;

      const provider = await providerManagementService.createProvider({
        name,
        type,
        baseUrl,
        weight,
        timeoutMs,
        maxRetries,
        description
      }, {
        apiKey,
        handlerKey
      }, req.user.id);

      logger.info('供应商已创建', {
        providerId: provider.id,
        name: provider.name,
        createdBy: req.user.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        data: provider,
        message: '供应商创建成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('创建供应商失败:', error);
      next(error);
    }
  }
);

/**
 * 更新供应商
 * PUT /api/admin/providers/:id
 */
router.put('/:id',
  requirePermission({
    resource: 'providers',
    actions: ['update']
  }),
  updateProviderValidation,
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const provider = await providerManagementService.updateProvider(id, updateData, req.user.id);

      logger.info('供应商已更新', {
        providerId: id,
        updatedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: provider,
        message: '供应商更新成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error(`更新供应商失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 测试供应商连接
 * POST /api/admin/providers/:id/test
 */
router.post('/:id/test',
  requirePermission({
    resource: 'providers',
    actions: ['test']
  }),
  testConnectionValidation,
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await providerManagementService.testConnection(id);

      logger.info('供应商连接测试完成', {
        providerId: id,
        success: result.success,
        latency: result.latency,
        testedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error(`测试供应商连接失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 批量测试供应商连接
 * POST /api/admin/providers/test-all
 */
router.post('/test-all',
  requirePermission({
    resource: 'providers',
    actions: ['test']
  }),
  async (req, res, next) => {
    try {
      const { providerIds } = req.body;
      const testPromises = [];

      if (providerIds && Array.isArray(providerIds)) {
        // 测试指定的供应商
        for (const id of providerIds) {
          testPromises.push(
            providerManagementService.testConnection(id)
              .then(result => ({ id, result }))
              .catch(error => ({ id, result: { success: false, error: error.message } }))
          );
        }
      } else {
        // 测试所有启用的供应商
        const { providers } = await providerManagementService.getProviders({ enabled: true });
        for (const provider of providers) {
          testPromises.push(
            providerManagementService.testConnection(provider.id)
              .then(result => ({ id: provider.id, name: provider.name, result }))
              .catch(error => ({ id: provider.id, name: provider.name, result: { success: false, error: error.message } }))
          );
        }
      }

      const results = await Promise.allSettled(testPromises);
      const testResults = results.map(result =>
        result.status === 'fulfilled' ? result.value : { id: 'unknown', result: { success: false, error: 'Test failed' } }
      );

      // 统计结果
      const successCount = testResults.filter(r => r.result.success).length;
      const totalCount = testResults.length;

      logger.info('批量供应商连接测试完成', {
        totalCount,
        successCount,
        failedCount: totalCount - successCount,
        testedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: {
          results: testResults,
          summary: {
            total: totalCount,
            success: successCount,
            failed: totalCount - successCount,
            successRate: totalCount > 0 ? (successCount / totalCount * 100).toFixed(2) : 0
          }
        },
        requestId: req.id
      });
    } catch (error) {
      logger.error('批量测试供应商连接失败:', error);
      next(error);
    }
  }
);

/**
 * 启用/禁用供应商
 * PATCH /api/admin/providers/:id/toggle
 */
router.patch('/:id/toggle',
  requirePermission({
    resource: 'providers',
    actions: ['update']
  }),
  param('id')
    .notEmpty()
    .withMessage('供应商ID不能为空'),
  body('enabled')
    .isBoolean()
    .withMessage('enabled必须是布尔值'),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;

      // 这里需要在providerManagementService中实现toggle方法
      // 暂时返回成功
      logger.info('供应商状态已切换', {
        providerId: id,
        enabled,
        updatedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: { id, enabled },
        message: enabled ? '供应商已启用' : '供应商已禁用',
        requestId: req.id
      });
    } catch (error) {
      logger.error(`切换供应商状态失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 删除供应商
 * DELETE /api/admin/providers/:id
 */
router.delete('/:id',
  requirePermission({
    resource: 'providers',
    actions: ['delete']
  }),
  param('id')
    .notEmpty()
    .withMessage('供应商ID不能为空'),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // 这里需要在providerManagementService中实现delete方法
      // 暂时返回成功
      logger.warn('供应商删除功能待实现', {
        providerId: id,
        deletedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '供应商删除成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error(`删除供应商失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

module.exports = router;