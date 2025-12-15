/**
 * 案例展示路由
 */

import { Router } from 'express';
import showcasesController from '../controllers/showcases.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// ============ 管理端路由 ============

router.get(
  '/admin/showcases',
  authenticate,
  requireAdmin,
  showcasesController.listShowcases.bind(showcasesController)
);
router.post(
  '/admin/showcases',
  authenticate,
  requireAdmin,
  showcasesController.createShowcase.bind(showcasesController)
);
router.get(
  '/admin/showcases/:id',
  authenticate,
  requireAdmin,
  showcasesController.getShowcase.bind(showcasesController)
);
router.put(
  '/admin/showcases/:id',
  authenticate,
  requireAdmin,
  showcasesController.updateShowcase.bind(showcasesController)
);
router.delete(
  '/admin/showcases/:id',
  authenticate,
  requireAdmin,
  showcasesController.deleteShowcase.bind(showcasesController)
);

// AI功能
router.post(
  '/admin/showcases/ai-description',
  authenticate,
  requireAdmin,
  showcasesController.aiGenerateDescription.bind(showcasesController)
);
router.post(
  '/admin/showcases/ai-highlights',
  authenticate,
  requireAdmin,
  showcasesController.aiExtractHighlights.bind(showcasesController)
);

// ============ 前台路由 ============

router.get('/showcases', showcasesController.getPublishedShowcases.bind(showcasesController));
router.get(
  '/showcases/featured',
  showcasesController.getFeaturedShowcases.bind(showcasesController)
);
router.get('/showcases/:slug', showcasesController.getShowcaseBySlug.bind(showcasesController));
router.post('/showcases/:id/like', showcasesController.likeShowcase.bind(showcasesController));

export default router;
