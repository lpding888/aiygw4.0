/**
 * 系统管理路由（限流配置、缓存管理、数据仪表盘）
 */
import { Router } from 'express';
import systemController from '../controllers/system.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// API限流配置
router.get(
  '/admin/rate-limits',
  authenticate,
  requireAdmin,
  systemController.listRateLimitConfigs.bind(systemController)
);
router.post(
  '/admin/rate-limits',
  authenticate,
  requireAdmin,
  systemController.createRateLimitConfig.bind(systemController)
);
router.put(
  '/admin/rate-limits/:id',
  authenticate,
  requireAdmin,
  systemController.updateRateLimitConfig.bind(systemController)
);
router.delete(
  '/admin/rate-limits/:id',
  authenticate,
  requireAdmin,
  systemController.deleteRateLimitConfig.bind(systemController)
);

// 缓存管理
router.get(
  '/admin/cache/stats',
  authenticate,
  requireAdmin,
  systemController.getCacheStats.bind(systemController)
);
router.get(
  '/admin/cache/keys',
  authenticate,
  requireAdmin,
  systemController.listCacheKeys.bind(systemController)
);
router.get(
  '/admin/cache/keys/:key',
  authenticate,
  requireAdmin,
  systemController.getCacheValue.bind(systemController)
);
router.delete(
  '/admin/cache/keys/:key',
  authenticate,
  requireAdmin,
  systemController.deleteCacheKey.bind(systemController)
);
router.post(
  '/admin/cache/clear',
  authenticate,
  requireAdmin,
  systemController.clearCachePattern.bind(systemController)
);

// 数据仪表盘
router.get(
  '/admin/dashboard/stats',
  authenticate,
  requireAdmin,
  systemController.getDashboardStats.bind(systemController)
);
router.get(
  '/admin/dashboard/cms-stats',
  authenticate,
  requireAdmin,
  systemController.getCmsContentStats.bind(systemController)
);

export default router;
