/**
 * COS上传路由 - 直传STS临时密钥API
 * 艹，这个憨批路由负责给前端发STS临时密钥，让前端直传COS！
 *
 * 端点：
 * - POST /admin/uploads/sts - 获取STS临时密钥
 * - POST /admin/uploads/callback - 上传回调
 * - GET /admin/uploads/list - 获取用户文件列表
 */

import express, { Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import cosSTSService from '../../services/cos-sts.service.js';
import { authenticate as authenticateToken } from '../../middlewares/auth.middleware.js';
import logger from '../../utils/logger.js';

// 扩展Express Request类型以支持自定义属性
declare global {
  namespace Express {
    interface Request {
      id: string;
      user: {
        id: string;
      };
    }
  }
}

const router = express.Router();

/**
 * 验证中间件
 */
const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
      requestId: req.id
    });
  }
  next();
};

/**
 * 获取STS临时密钥
 *
 * POST /admin/uploads/sts
 *
 * Body:
 * - action: 'upload' | 'download' | 'all' (默认 'upload')
 * - prefix: 路径前缀（可选，默认 user-{userId}/）
 * - durationSeconds: 有效期（秒，可选，默认1800）
 */
router.post(
  '/sts',
  authenticateToken,
  [
    body('action')
      .optional()
      .isIn(['upload', 'download', 'all'])
      .withMessage('action must be upload, download or all'),
    body('prefix').optional().isString().trim().withMessage('prefix must be a string'),
    body('durationSeconds')
      .optional()
      .isInt({ min: 900, max: 7200 })
      .withMessage('durationSeconds must be between 900 and 7200')
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;
      const { action = 'upload', prefix, durationSeconds } = req.body;

      logger.info(`[UploadRoute] 获取STS临时密钥: userId=${userId} action=${action}`);

      // 生成STS临时密钥
      const credentials = await cosSTSService.getSTSCredentials(userId, {
        action,
        prefix,
        durationSeconds
      });

      res.json({
        success: true,
        data: credentials,
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[UploadRoute] 获取STS临时密钥失败:', err);
      next(err);
    }
  }
);

/**
 * 上传回调
 *
 * POST /admin/uploads/callback
 *
 * Body:
 * - key: 文件key
 * - size: 文件大小
 * - etag: 文件ETag
 * - metadata: 文件元数据（可选）
 */
router.post(
  '/callback',
  authenticateToken,
  [
    body('key').isString().trim().notEmpty().withMessage('key is required'),
    body('size').isInt({ min: 1 }).withMessage('size must be a positive integer'),
    body('etag').optional().isString().trim().withMessage('etag must be a string'),
    body('metadata').optional().isObject().withMessage('metadata must be an object')
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;
      const { key, size, etag, metadata = {} } = req.body;

      logger.info(`[UploadRoute] 上传回调: userId=${userId} key=${key} size=${size}`);

      // 记录上传信息（可以保存到数据库）
      const uploadRecord = {
        userId,
        key,
        size,
        etag,
        metadata,
        uploadTime: new Date().toISOString()
      };

      // 这里可以添加业务逻辑，例如：
      // - 保存到数据库
      // - 触发后续处理任务
      // - 发送通知

      res.json({
        success: true,
        data: {
          uploaded: true,
          record: uploadRecord
        },
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[UploadRoute] 上传回调失败:', err);
      next(err);
    }
  }
);

/**
 * 获取用户文件列表
 *
 * GET /admin/uploads/list
 *
 * Query:
 * - prefix: 路径前缀（可选）
 * - maxKeys: 最大返回数量（可选，默认100）
 * - marker: 分页标记（可选）
 */
router.get(
  '/list',
  authenticateToken,
  [
    query('prefix').optional().isString().trim().withMessage('prefix must be a string'),
    query('maxKeys')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('maxKeys must be between 1 and 1000'),
    query('marker').optional().isString().trim().withMessage('marker must be a string')
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;
      const { prefix = `user-${userId}/`, maxKeys = 100, marker = '' } = req.query;

      logger.info(`[UploadRoute] 获取文件列表: userId=${userId} prefix=${prefix}`);

      // 这里可以调用cos-storage.service获取文件列表
      // 简化实现，返回空列表
      type FileInfo = Record<string, unknown>;
      const files: FileInfo[] = [];
      const isTruncated = false;
      const nextMarker = '';

      res.json({
        success: true,
        data: {
          files,
          isTruncated,
          nextMarker,
          total: files.length
        },
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[UploadRoute] 获取文件列表失败:', err);
      next(err);
    }
  }
);

/**
 * 健康检查
 *
 * GET /admin/uploads/health
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stsHealth = await cosSTSService.healthCheck();

    res.json({
      success: true,
      data: {
        service: 'uploads',
        sts: stsHealth,
        timestamp: new Date().toISOString()
      },
      requestId: req.id
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[UploadRoute] 健康检查失败:', err);
    next(err);
  }
});

/**
 * 生成上传签名URL（备用方案）
 *
 * POST /admin/uploads/sign-url
 *
 * Body:
 * - key: 文件key
 * - type: 'upload' | 'download'
 * - expires: 过期时间（秒，可选，默认3600）
 */
router.post(
  '/sign-url',
  authenticateToken,
  [
    body('key').isString().trim().notEmpty().withMessage('key is required'),
    body('type').isIn(['upload', 'download']).withMessage('type must be upload or download'),
    body('expires')
      .optional()
      .isInt({ min: 300, max: 7200 })
      .withMessage('expires must be between 300 and 7200')
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;
      const { key, type, expires = 3600 } = req.body;

      logger.info(`[UploadRoute] 生成签名URL: userId=${userId} key=${key} type=${type}`);

      // 生成签名URL
      const signedUrl =
        type === 'upload'
          ? cosSTSService.generateUploadUrl(key, expires)
          : cosSTSService.generateDownloadUrl(key, expires);

      res.json({
        success: true,
        data: {
          url: signedUrl,
          expires,
          expiresAt: new Date(Date.now() + expires * 1000).toISOString()
        },
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[UploadRoute] 生成签名URL失败:', err);
      next(err);
    }
  }
);

export default router;
