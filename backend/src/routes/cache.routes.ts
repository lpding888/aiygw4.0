import { Router } from 'express';
import cacheService from '../services/cache.service.js';
import cacheSubscriberService, {
  type CachePreloadPriority
} from '../services/cache-subscriber.service.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import logger from '../utils/logger.js';

const router = Router();

// 获取缓存统计
router.get('/stats', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    const stats = cacheService.getStats();
    const subscriberStatus = cacheSubscriberService.getStatus();
    res.json({
      success: true,
      data: { cache: stats, subscriber: subscriberStatus, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    logger.error('[CacheRoutes] 获取缓存统计失败', error as any);
    next(error);
  }
});

// 缓存健康检查
router.get('/health', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    const health = await cacheService.healthCheck();
    res.json({ success: true, data: health });
  } catch (error) {
    logger.error('[CacheRoutes] 缓存健康检查失败', error as any);
    next(error);
  }
});

// 手动失效缓存
router.post('/invalidate', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { namespace, pattern, reason } = (req.body ?? {}) as {
      namespace?: string;
      pattern?: string;
      reason?: string;
    };
    if (!namespace) {
      res.status(400).json({ success: false, error: { code: 4001, message: '缺少命名空间参数' } });
      return;
    }
    await cacheSubscriberService.invalidateCache(
      namespace,
      pattern || '*',
      reason || 'admin_manual'
    );
    res.json({
      success: true,
      message: '缓存失效请求已发送',
      data: { namespace, pattern: pattern || '*', reason: reason || 'admin_manual' }
    });
  } catch (error) {
    logger.error('[CacheRoutes] 缓存失效失败', error as any);
    next(error);
  }
});

// 版本更新
router.post('/version/update', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { namespace } = (req.body ?? {}) as { namespace?: string };
    if (!namespace) {
      res.status(400).json({ success: false, error: { code: 4001, message: '缺少命名空间参数' } });
      return;
    }
    const newVersion = await cacheSubscriberService.updateVersion(namespace);
    res.json({ success: true, message: '版本更新成功', data: { namespace, newVersion } });
  } catch (error) {
    logger.error('[CacheRoutes] 版本更新失败', error as any);
    next(error);
  }
});

// 缓存预热
router.post('/preload', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const {
      namespace,
      items,
      priority = 'normal'
    } = (req.body ?? {}) as {
      namespace?: string;
      items?: any[];
      priority?: string;
    };
    if (!namespace || !Array.isArray(items)) {
      res
        .status(400)
        .json({ success: false, error: { code: 4001, message: '缺少命名空间或预热项目参数' } });
      return;
    }
    const validItems = items.filter(
      (item) => item && item.key && item.value !== undefined && typeof item.ttl === 'number'
    );
    if (validItems.length === 0) {
      res
        .status(400)
        .json({ success: false, error: { code: 4001, message: '没有有效的预热项目' } });
      return;
    }
    const normalizedPriority: CachePreloadPriority =
      priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'normal';
    await cacheSubscriberService.triggerPreload(namespace, validItems, normalizedPriority);
    res.json({
      success: true,
      message: '缓存预热请求已发送',
      data: { namespace, itemCount: validItems.length, priority: normalizedPriority }
    });
  } catch (error) {
    logger.error('[CacheRoutes] 缓存预热失败', error as any);
    next(error);
  }
});

// 批量删除缓存
router.delete('/batch', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { pattern } = (req.body ?? {}) as { pattern?: string };
    if (!pattern) {
      res.status(400).json({ success: false, error: { code: 4001, message: '缺少模式参数' } });
      return;
    }
    const deleteCount = await cacheService.deletePattern(pattern);
    res.json({ success: true, message: '批量删除完成', data: { pattern, deleteCount } });
  } catch (error) {
    logger.error('[CacheRoutes] 批量删除缓存失败', error as any);
    next(error);
  }
});

// 重置缓存统计
router.post('/stats/reset', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    cacheService.resetStats();
    res.json({ success: true, message: '缓存统计已重置' });
  } catch (error) {
    logger.error('[CacheRoutes] 重置缓存统计失败', error as any);
    next(error);
  }
});

// 广播健康检查
router.post('/health/broadcast', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    await cacheSubscriberService.broadcastHealthCheck();
    res.json({ success: true, message: '健康检查广播已发送' });
  } catch (error) {
    logger.error('[CacheRoutes] 广播健康检查失败', error as any);
    next(error);
  }
});

// 获取订阅服务状态
router.get('/subscriber/status', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    const status = cacheSubscriberService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('[CacheRoutes] 获取订阅服务状态失败', error as any);
    next(error);
  }
});

// 重启订阅服务
router.post('/subscriber/restart', authenticate, requireRole('admin'), async (_req, res, next) => {
  try {
    await cacheSubscriberService.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await cacheSubscriberService.start();
    res.json({ success: true, message: '订阅服务重启成功' });
  } catch (error) {
    logger.error('[CacheRoutes] 重启订阅服务失败', error as any);
    next(error);
  }
});

// 公共缓存统计接口（无需认证）
router.get('/public/stats', async (_req, res, next) => {
  try {
    const stats = cacheService.getStats();
    const publicStats = {
      hitRate: stats.hitRate,
      memoryHitRate: stats.memoryHitRate,
      memoryCacheSize: stats.memoryCacheSize,
      uptime: stats.uptime
    };
    res.json({ success: true, data: publicStats });
  } catch (error) {
    logger.error('[CacheRoutes] 获取公共缓存统计失败', error as any);
    next(error);
  }
});

export default router;
