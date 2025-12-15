/**
 * SEO管理路由
 */
import { Router } from 'express';
import seoConfigsController from '../controllers/seoConfigs.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 管理端
router.get(
  '/admin/seo-configs',
  authenticate,
  requireAdmin,
  seoConfigsController.listConfigs.bind(seoConfigsController)
);
router.post(
  '/admin/seo-configs',
  authenticate,
  requireAdmin,
  seoConfigsController.createConfig.bind(seoConfigsController)
);
router.get(
  '/admin/seo-configs/:id',
  authenticate,
  requireAdmin,
  seoConfigsController.getConfig.bind(seoConfigsController)
);
router.put(
  '/admin/seo-configs/:id',
  authenticate,
  requireAdmin,
  seoConfigsController.updateConfig.bind(seoConfigsController)
);
router.delete(
  '/admin/seo-configs/:id',
  authenticate,
  requireAdmin,
  seoConfigsController.deleteConfig.bind(seoConfigsController)
);

// 前台
router.get('/seo', seoConfigsController.getByPath.bind(seoConfigsController));
router.get('/sitemap.json', seoConfigsController.getSitemap.bind(seoConfigsController));
router.get('/sitemap.xml', seoConfigsController.getSitemapXml.bind(seoConfigsController));

export default router;
