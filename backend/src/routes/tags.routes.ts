/**
 * 标签系统路由
 */

import { Router } from 'express';
import tagsController from '../controllers/tags.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 管理端
router.get('/admin/tags', authenticate, requireAdmin, tagsController.listTags.bind(tagsController));
router.post(
  '/admin/tags',
  authenticate,
  requireAdmin,
  tagsController.createTag.bind(tagsController)
);
router.put(
  '/admin/tags/:id',
  authenticate,
  requireAdmin,
  tagsController.updateTag.bind(tagsController)
);
router.delete(
  '/admin/tags/:id',
  authenticate,
  requireAdmin,
  tagsController.deleteTag.bind(tagsController)
);
router.post(
  '/admin/tags/attach',
  authenticate,
  requireAdmin,
  tagsController.attachTags.bind(tagsController)
);

// 前台
router.get('/tags', tagsController.listTags.bind(tagsController));
router.get('/tags/popular', tagsController.getPopularTags.bind(tagsController));
router.get('/tags/:type/:id', tagsController.getEntityTags.bind(tagsController));
router.get('/tags/:type/by-tag/:slug', tagsController.getEntitiesByTag.bind(tagsController));

export default router;
