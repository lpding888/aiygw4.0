/**
 * KB知识库路由 - 管理和检索API
 * 艹，这个憨批路由提供知识库管理和检索功能！
 */

import express, { Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { addIngestJob, getQueueStats } from '../../rag/ingest/worker.js';
import { db } from '../../db/index.js';
import logger from '../../utils/logger.js';

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
 * 创建知识库文档
 * POST /admin/kb/documents
 */
router.post(
  '/documents',
  authenticate,
  [
    body('kbId').isString().notEmpty().withMessage('kbId is required'),
    body('title').isString().notEmpty().withMessage('title is required'),
    body('content').isString().notEmpty().withMessage('content is required'),
    body('format')
      .isIn(['markdown', 'html', 'pdf'])
      .withMessage('format must be markdown, html or pdf')
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: 4010, message: '未登录' } });
        return;
      }
      const { kbId, title, content, format, sourceUrl } = req.body;

      logger.info(`[KBRoute] 创建文档: userId=${userId} kbId=${kbId} title=${title}`);

      // 创建文档记录
      const [documentId] = await db('kb_documents').insert({
        user_id: userId,
        kb_id: kbId,
        title,
        content,
        format,
        file_size: Buffer.byteLength(content, 'utf8'),
        source_url: sourceUrl,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      });

      // 添加到摄取队列
      await addIngestJob({
        documentId: documentId.toString(),
        userId,
        kbId,
        content,
        format
      });

      res.json({
        success: true,
        data: { documentId, status: 'pending' },
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[KBRoute] 创建文档失败:', err);
      next(err);
    }
  }
);

/**
 * 获取文档列表
 * GET /admin/kb/documents
 */
router.get(
  '/documents',
  authenticate,
  [
    query('kbId').optional().isString(),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: 4010, message: '未登录' } });
        return;
      }
      const { kbId, status, page = 1, limit = 20 } = req.query;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      let query = db('kb_documents').where('user_id', userId);

      if (kbId) {
        query = query.where('kb_id', kbId as string);
      }

      if (status) {
        query = query.where('status', status as string);
      }

      const [documents, totalRow] = await Promise.all([
        query.clone()
          .select('*')
          .orderBy('created_at', 'desc')
          .limit(parseInt(limit as string))
          .offset(offset),
        query.clone().count<{ total: number }>('id as total').first()
      ]);

      const total = totalRow?.total ?? 0;

      res.json({
        success: true,
        data: {
          items: documents,
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string)
        },
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[KBRoute] 获取文档列表失败:', err);
      next(err);
    }
  }
);

/**
 * 检索知识库
 * POST /admin/kb/query
 */
router.post(
  '/query',
  authenticate,
  [
    body('query').isString().notEmpty().withMessage('query is required'),
    body('kbId').optional().isString(),
    body('topK').optional().isInt({ min: 1, max: 20 }),
    body('filters').optional().isObject()
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: 4010, message: '未登录' } });
        return;
      }
      const { query: searchQuery, kbId, topK = 5, filters = {} } = req.body;

      logger.info(`[KBRoute] 检索知识库: userId=${userId} query=${searchQuery}`);

      // 简化实现：基于文本匹配（实际应使用向量检索）
      let dbQuery = db('kb_chunks')
        .join('kb_documents', 'kb_chunks.document_id', 'kb_documents.id')
        .where('kb_documents.user_id', userId)
        .where('kb_documents.status', 'completed');

      if (kbId) {
        dbQuery = dbQuery.where('kb_documents.kb_id', kbId);
      }

      // 文本相似度匹配（简化版）
      dbQuery = dbQuery.where('kb_chunks.text', 'like', `%${searchQuery}%`);

      const results = await dbQuery
        .select(
          'kb_chunks.id',
          'kb_chunks.text',
          'kb_chunks.metadata',
          'kb_documents.title',
          'kb_documents.kb_id'
        )
        .limit(topK);

      res.json({
        success: true,
        data: {
          query: searchQuery,
          results,
          count: results.length
        },
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[KBRoute] 检索失败:', err);
      next(err);
    }
  }
);

/**
 * 获取队列统计
 * GET /admin/kb/queue-stats
 */
/**
 * 获取知识库统计
 * GET /admin/kb/stats
 */
router.get(
  '/stats',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: 4010, message: '未登录' } });
        return;
      }

      // 1. 文档总数
      const totalDocsResult = await db('kb_documents')
        .where('user_id', userId)
        .count<{ count: number }>('* as count')
        .first();
      const totalDocuments = Number(totalDocsResult?.count || 0);

      // 2. 切片总数 (关联查询)
      const totalChunksResult = await db('kb_chunks')
        .join('kb_documents', 'kb_chunks.document_id', 'kb_documents.id')
        .where('kb_documents.user_id', userId)
        .count<{ count: number }>('* as count')
        .first();
      const totalChunks = Number(totalChunksResult?.count || 0);

      // 3. 存储空间 (Sum file_size)
      const storageResult = await db('kb_documents')
        .where('user_id', userId)
        .sum<{ totalSize: number }>('file_size as totalSize')
        .first();
      const storageSize = Number(storageResult?.totalSize || 0);

      // 4. 状态分布
      const statusDistribution = await db('kb_documents')
        .where('user_id', userId)
        .select('status')
        .count<{ count: number }>('* as count')
        .groupBy('status');

      const distribution = (statusDistribution as unknown as any[]).reduce((acc: Record<string, number>, curr) => {
        acc[curr.status as string] = Number(curr.count);
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        data: {
          totalDocuments,
          totalChunks,
          storageSize, // in bytes
          documentStats: distribution
        },
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[KBRoute] 获取统计失败:', err);
      next(err);
    }
  }
);

/**
 * 获取队列统计
 * GET /admin/kb/queue-stats
 */
router.get(
  '/queue-stats',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await getQueueStats();

      res.json({
        success: true,
        data: stats,
        requestId: req.id
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[KBRoute] 获取队列统计失败:', err);
      next(err);
    }
  }
);

export default router;
