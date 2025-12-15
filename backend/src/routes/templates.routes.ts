/**
 * 模板库路由
 */

import { Router } from 'express';
import templatesController from '../controllers/templates.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 管理端
router.get(
  '/admin/templates',
  authenticate,
  requireAdmin,
  templatesController.listTemplates.bind(templatesController)
);
router.post(
  '/admin/templates',
  authenticate,
  requireAdmin,
  templatesController.createTemplate.bind(templatesController)
);
router.get(
  '/admin/templates/:id',
  authenticate,
  requireAdmin,
  templatesController.getTemplate.bind(templatesController)
);
router.put(
  '/admin/templates/:id',
  authenticate,
  requireAdmin,
  templatesController.updateTemplate.bind(templatesController)
);
router.delete(
  '/admin/templates/:id',
  authenticate,
  requireAdmin,
  templatesController.deleteTemplate.bind(templatesController)
);

// 前台
router.get('/templates', templatesController.getPublishedTemplates.bind(templatesController));
router.get('/templates/:slug', templatesController.getTemplateBySlug.bind(templatesController));
router.post(
  '/templates/:id/use',
  authenticate,
  templatesController.useTemplate.bind(templatesController)
);

export default router;
