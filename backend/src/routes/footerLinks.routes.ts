/**
 * 页脚链接路由
 */

import { Router } from 'express';
import footerLinksController from '../controllers/footerLinks.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 管理端
router.get(
  '/admin/footer-links',
  authenticate,
  requireAdmin,
  footerLinksController.listFooterLinks.bind(footerLinksController)
);
router.post(
  '/admin/footer-links',
  authenticate,
  requireAdmin,
  footerLinksController.createFooterLink.bind(footerLinksController)
);
router.put(
  '/admin/footer-links/:id',
  authenticate,
  requireAdmin,
  footerLinksController.updateFooterLink.bind(footerLinksController)
);
router.delete(
  '/admin/footer-links/:id',
  authenticate,
  requireAdmin,
  footerLinksController.deleteFooterLink.bind(footerLinksController)
);
router.post(
  '/admin/footer-links/sort',
  authenticate,
  requireAdmin,
  footerLinksController.batchUpdateSortOrder.bind(footerLinksController)
);

// 前台
router.get(
  '/footer-links',
  footerLinksController.getGroupedFooterLinks.bind(footerLinksController)
);

export default router;
