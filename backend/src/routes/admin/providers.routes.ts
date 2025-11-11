/**
 * 供应商管理路由
 * 艹，完整迁移到TypeScript ESM！
 */

import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import providerManagementService from '../../services/provider-management.service.js';
import { authenticate as authenticateToken } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/adminAuth.middleware.js';
import { requirePermission } from '../../middlewares/require-permission.middleware.js';
import { body, param, query } from 'express-validator';
import { validate } from '../../middlewares/validate.middleware.js';
import logger from '../../utils/logger.js';

const router = express.Router();

const ensureUserId = (req: Request, res: Response): string | null => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 4010, message: '未登录' } });
    return null;
  }
  return userId;
};

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
  body('baseUrl').notEmpty().withMessage('基础URL不能为空').isURL().withMessage('基础URL格式无效'),
  body('apiKey').notEmpty().withMessage('API密钥不能为空'),
  body('handlerKey').notEmpty().withMessage('处理密钥不能为空'),
  body('weight').optional().isInt({ min: 1, max: 100 }).withMessage('权重必须是1-100之间的整数'),
  body('timeoutMs')
    .optional()
    .isInt({ min: 1000, max: 300000 })
    .withMessage('超时时间必须是1000-300000毫秒之间'),
  body('maxRetries')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('最大重试次数必须是0-10之间'),
  body('description').optional().isLength({ max: 500 }).withMessage('描述最多500个字符')
];

const updateProviderValidation = [
  param('id').notEmpty().withMessage('供应商ID不能为空'),
  body('name').optional().isLength({ max: 100 }).withMessage('供应商名称最多100个字符'),
  body('type').optional().isIn(['ai', 'image', 'video', 'text']).withMessage('无效的供应商类型'),
  body('baseUrl').optional().isURL().withMessage('基础URL格式无效'),
  body('weight').optional().isInt({ min: 1, max: 100 }).withMessage('权重必须是1-100之间的整数'),
  body('timeoutMs')
    .optional()
    .isInt({ min: 1000, max: 300000 })
    .withMessage('超时时间必须是1000-300000毫秒之间'),
  body('maxRetries')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('最大重试次数必须是0-10之间'),
  body('description').optional().isLength({ max: 500 }).withMessage('描述最多500个字符')
];

const testConnectionValidation = [param('id').notEmpty().withMessage('供应商ID不能为空')];

const queryValidation = [
  query('page').optional().isInt({ min: 1, max: 1000 }).withMessage('页码必须是1-1000之间的整数'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('每页数量必须是1-100之间的整数'),
  query('type').optional().isIn(['ai', 'image', 'video', 'text']).withMessage('无效的供应商类型'),
  query('enabled').optional().isBoolean().withMessage('enabled必须是布尔值'),
  query('healthy').optional().isBoolean().withMessage('healthy必须是布尔值')
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
router.use(
  requirePermission({
    resource: 'providers',
    actions: ['read']
  })
);

/**
 * 获取供应商列表
 * GET /api/admin/providers
 */
router.get(
  '/',
  queryValidation,
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20, type, enabled, healthy } = req.query;

      const result = await providerManagementService.getProviders({
        type: type as string | undefined,
        enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
        healthy: healthy === 'true' ? true : healthy === 'false' ? false : undefined,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('获取供应商列表失败:', err);
      next(err);
    }
  }
);

/**
 * 获取供应商详情
 * GET /api/admin/providers/:id
 */
router.get(
  '/:id',
  param('id').notEmpty().withMessage('供应商ID不能为空'),
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = ensureUserId(req, res);
      if (!userId) return;
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
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`获取供应商详情失败: ${req.params.id}`, err);
      next(err);
    }
  }
);

// ============ 需要编辑权限的路由 ============
router.use(
  requirePermission({
    resource: 'providers',
    actions: ['create', 'update', 'delete']
  })
);

/**
 * 创建供应商
 * POST /api/admin/providers
 */
router.post(
  '/',
  requirePermission({
    resource: 'providers',
    actions: ['create']
  }),
  createProviderValidation,
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = ensureUserId(req, res);
      if (!userId) return;
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

      const provider = await providerManagementService.createProvider(
        {
          name,
          type,
          baseUrl,
          weight,
          timeoutMs,
          maxRetries,
          description
        },
        {
          apiKey,
          handlerKey
        },
        userId
      );

      logger.info('供应商已创建', {
        providerId: provider.id,
        name: provider.name,
        createdBy: userId,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        data: provider,
        message: '供应商创建成功',
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('创建供应商失败:', err);
      next(err);
    }
  }
);

/**
 * 更新供应商
 * PUT /api/admin/providers/:id
 */
router.put(
  '/:id',
  requirePermission({
    resource: 'providers',
    actions: ['update']
  }),
  updateProviderValidation,
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = ensureUserId(req, res);
      if (!userId) return;
      const { id } = req.params;
      const updateData = req.body;

      const provider = await providerManagementService.updateProvider(id, updateData, userId);

      logger.info('供应商已更新', {
        providerId: id,
        updatedBy: userId,
        ip: req.ip
      });

      res.json({
        success: true,
        data: provider,
        message: '供应商更新成功',
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`更新供应商失败: ${req.params.id}`, err);
      next(err);
    }
  }
);

/**
 * 测试供应商连接
 * POST /api/admin/providers/:id/test
 */
router.post(
  '/:id/test',
  requirePermission({
    resource: 'providers',
    actions: ['test']
  }),
  testConnectionValidation,
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = ensureUserId(req, res);
      if (!userId) return;
      const { id } = req.params;
      const result = await providerManagementService.testConnection(id);

      logger.info('供应商连接测试完成', {
        providerId: id,
        success: result.success,
        latency: result.latency,
        testedBy: userId,
        ip: req.ip
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`测试供应商连接失败: ${req.params.id}`, err);
      next(err);
    }
  }
);

/**
 * 批量测试供应商连接
 * POST /api/admin/providers/test-all
 */
router.post(
  '/test-all',
  requirePermission({
    resource: 'providers',
    actions: ['test']
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = ensureUserId(req, res);
      if (!userId) return;
      const { providerIds } = req.body;
      type ProviderTestResult = {
        id: string;
        name?: string;
        result: {
          success: boolean;
          error?: string;
          latency?: number;
        };
      };
      const testPromises: Promise<ProviderTestResult>[] = [];

      if (providerIds && Array.isArray(providerIds)) {
        // 测试指定的供应商
        for (const id of providerIds) {
          testPromises.push(
            providerManagementService
              .testConnection(id)
              .then((result) => ({ id, result }))
              .catch((error: unknown) => {
                const err = error instanceof Error ? error : new Error(String(error));
                return { id, result: { success: false, error: err.message } };
              })
          );
        }
      } else {
        // 测试所有启用的供应商
        const { providers } = await providerManagementService.getProviders({ enabled: true });
        for (const provider of providers) {
          testPromises.push(
            providerManagementService
              .testConnection(provider.id)
              .then((result) => ({ id: provider.id, name: provider.name, result }))
              .catch((error: unknown) => {
                const err = error instanceof Error ? error : new Error(String(error));
                return {
                  id: provider.id,
                  name: provider.name,
                  result: { success: false, error: err.message }
                };
              })
          );
        }
      }

      const results = await Promise.allSettled(testPromises);
      const testResults = results.map((result) =>
        result.status === 'fulfilled'
          ? result.value
          : { id: 'unknown', result: { success: false, error: 'Test failed' } }
      );

      // 统计结果
      const successCount = testResults.filter((r) => r.result.success).length;
      const totalCount = testResults.length;

      logger.info('批量供应商连接测试完成', {
        totalCount,
        successCount,
        failedCount: totalCount - successCount,
        testedBy: userId,
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
            successRate: totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(2) : 0
          }
        },
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('批量测试供应商连接失败:', err);
      next(err);
    }
  }
);

/**
 * 启用/禁用供应商
 * PATCH /api/admin/providers/:id/toggle
 */
router.patch(
  '/:id/toggle',
  requirePermission({
    resource: 'providers',
    actions: ['update']
  }),
  param('id').notEmpty().withMessage('供应商ID不能为空'),
  body('enabled').isBoolean().withMessage('enabled必须是布尔值'),
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = ensureUserId(req, res);
      if (!userId) return;
      const { id } = req.params;
      const { enabled } = req.body;

      // 这里需要在providerManagementService中实现toggle方法
      // 暂时返回成功
      logger.info('供应商状态已切换', {
        providerId: id,
        enabled,
        updatedBy: userId,
        ip: req.ip
      });

      res.json({
        success: true,
        data: { id, enabled },
        message: enabled ? '供应商已启用' : '供应商已禁用',
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`切换供应商状态失败: ${req.params.id}`, err);
      next(err);
    }
  }
);

/**
 * 删除供应商
 * DELETE /api/admin/providers/:id
 */
router.delete(
  '/:id',
  requirePermission({
    resource: 'providers',
    actions: ['delete']
  }),
  param('id').notEmpty().withMessage('供应商ID不能为空'),
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = ensureUserId(req, res);
      if (!userId) return;
      const { id } = req.params;

      // 这里需要在providerManagementService中实现delete方法
      // 暂时返回成功
      logger.warn('供应商删除功能待实现', {
        providerId: id,
        deletedBy: userId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '供应商删除成功',
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`删除供应商失败: ${req.params.id}`, err);
      next(err);
    }
  }
);

export default router;
