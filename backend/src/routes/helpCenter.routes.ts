/**
 * 帮助中心路由
 */

import { Router } from 'express';
import helpCenterController from '../controllers/helpCenter.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// ============ 管理端路由 ============

// 分类管理
router.get(
  '/admin/help/categories',
  authenticate,
  requireAdmin,
  helpCenterController.listCategories.bind(helpCenterController)
);
router.post(
  '/admin/help/categories',
  authenticate,
  requireAdmin,
  helpCenterController.createCategory.bind(helpCenterController)
);
router.put(
  '/admin/help/categories/:id',
  authenticate,
  requireAdmin,
  helpCenterController.updateCategory.bind(helpCenterController)
);
router.delete(
  '/admin/help/categories/:id',
  authenticate,
  requireAdmin,
  helpCenterController.deleteCategory.bind(helpCenterController)
);

// 文章管理
router.get(
  '/admin/help/articles',
  authenticate,
  requireAdmin,
  helpCenterController.listArticles.bind(helpCenterController)
);
router.post(
  '/admin/help/articles',
  authenticate,
  requireAdmin,
  helpCenterController.createArticle.bind(helpCenterController)
);
router.get(
  '/admin/help/articles/:id',
  authenticate,
  requireAdmin,
  helpCenterController.getArticle.bind(helpCenterController)
);
router.put(
  '/admin/help/articles/:id',
  authenticate,
  requireAdmin,
  helpCenterController.updateArticle.bind(helpCenterController)
);
router.delete(
  '/admin/help/articles/:id',
  authenticate,
  requireAdmin,
  helpCenterController.deleteArticle.bind(helpCenterController)
);

// AI功能
router.post(
  '/admin/help/ai-generate-faq',
  authenticate,
  requireAdmin,
  helpCenterController.aiGenerateFaq.bind(helpCenterController)
);

// ============ 前台路由 ============

router.get(
  '/help/categories',
  helpCenterController.getPublishedCategories.bind(helpCenterController)
);
router.get('/help/articles', helpCenterController.getPublishedArticles.bind(helpCenterController));
router.get('/help/articles/search', helpCenterController.searchArticles.bind(helpCenterController));
router.get(
  '/help/articles/:slug',
  helpCenterController.getArticleBySlug.bind(helpCenterController)
);
router.post(
  '/help/articles/:id/helpful',
  helpCenterController.markArticleHelpful.bind(helpCenterController)
);

export default router;
