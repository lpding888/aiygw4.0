import { Router } from 'express';
import swaggerService from '../services/swagger.service.js';
import logger from '../utils/logger.js';

const router = Router();

// 获取API文档JSON规范
router.get('/swagger.json', (_req, res) => {
  try {
    const spec = swaggerService.getSpec();
    if (!spec) {
      res
        .status(404)
        .json({ success: false, error: { code: 'DOCS_NOT_AVAILABLE', message: 'API文档不可用' } });
      return;
    }
    res.set('Content-Type', 'application/json');
    res.json(spec);
  } catch (error) {
    logger.error('[Docs] 获取API文档失败:', error as any);
    res
      .status(500)
      .json({ success: false, error: { code: 'DOCS_FETCH_ERROR', message: '获取API文档失败' } });
  }
});

// 获取API端点列表
router.get('/endpoints', (_req, res) => {
  try {
    const endpoints = swaggerService.getEndpoints();
    const groupedEndpoints = swaggerService.getEndpointsByTag();
    res.json({
      success: true,
      data: { endpoints, grouped: groupedEndpoints, total: endpoints.length },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[Docs] 获取端点列表失败:', error as any);
    res.status(500).json({
      success: false,
      error: { code: 'ENDPOINTS_FETCH_ERROR', message: '获取端点列表失败' }
    });
  }
});

// 获取API模型列表
router.get('/schemas', (_req, res) => {
  try {
    const schemas = swaggerService.getSchemas();
    res.json({
      success: true,
      data: { schemas, total: schemas.length },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[Docs] 获取模型列表失败:', error as any);
    res.status(500).json({
      success: false,
      error: { code: 'SCHEMAS_FETCH_ERROR', message: '获取模型列表失败' }
    });
  }
});

// 验证API文档
router.get('/validate', (_req, res) => {
  try {
    const validation = swaggerService.validateDocs();
    res.json({ success: true, data: validation, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('[Docs] 验证API文档失败:', error as any);
    res
      .status(500)
      .json({ success: false, error: { code: 'VALIDATION_ERROR', message: '验证API文档失败' } });
  }
});

// 重新生成API文档
router.post('/regenerate', (_req, res) => {
  try {
    swaggerService
      .regenerateDocs()
      .then((result) => {
        res.json({
          success: true,
          message: 'API文档重新生成成功',
          data: result?.stats,
          timestamp: new Date().toISOString()
        });
      })
      .catch((error: any) => {
        logger.error('[Docs] 重新生成文档失败:', error);
        res.status(500).json({
          success: false,
          error: { code: 'REGENERATE_ERROR', message: '重新生成API文档失败' }
        });
      });
  } catch (error) {
    logger.error('[Docs] 处理重新生成请求失败:', error as any);
    res
      .status(500)
      .json({ success: false, error: { code: 'REQUEST_ERROR', message: '处理请求失败' } });
  }
});

// 获取文档统计信息
router.get('/stats', (_req, res) => {
  try {
    const stats = swaggerService.getStats();
    res.json({ success: true, data: stats, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('[Docs] 获取统计信息失败:', error as any);
    res
      .status(500)
      .json({ success: false, error: { code: 'STATS_FETCH_ERROR', message: '获取统计信息失败' } });
  }
});

// 设置自动更新
router.post('/auto-update', (req, res) => {
  try {
    const { enabled } = (req.body ?? {}) as { enabled?: boolean };
    if (typeof enabled !== 'boolean') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMETER', message: 'enabled参数必须是布尔值' }
      });
      return;
    }
    swaggerService.setAutoUpdate(enabled);
    res.json({
      success: true,
      message: `自动更新已${enabled ? '启用' : '禁用'}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[Docs] 设置自动更新失败:', error as any);
    res
      .status(500)
      .json({ success: false, error: { code: 'AUTO_UPDATE_ERROR', message: '设置自动更新失败' } });
  }
});

// API文档主页（HTML）
router.get('/', (_req, res) => {
  res.send(
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>API文档 - AI照片处理后端</title></head><body><h1>API 文档</h1><p>请访问 <a href="/api/docs/swagger.json">/api/docs/swagger.json</a> 或 <a href="/api/docs/endpoints">/api/docs/endpoints</a></p><p><a href="/api/docs/stats" class="link">统计信息</a></p></body></html>`
  );
});

export default router;
