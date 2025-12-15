/**
 * 表单生成器路由
 */
import { Router } from 'express';
import formsController from '../controllers/forms.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 管理端
router.get(
  '/admin/forms',
  authenticate,
  requireAdmin,
  formsController.listForms.bind(formsController)
);
router.post(
  '/admin/forms',
  authenticate,
  requireAdmin,
  formsController.createForm.bind(formsController)
);
router.get(
  '/admin/forms/:id',
  authenticate,
  requireAdmin,
  formsController.getForm.bind(formsController)
);
router.put(
  '/admin/forms/:id',
  authenticate,
  requireAdmin,
  formsController.updateForm.bind(formsController)
);
router.delete(
  '/admin/forms/:id',
  authenticate,
  requireAdmin,
  formsController.deleteForm.bind(formsController)
);
router.post(
  '/admin/forms/:formId/fields',
  authenticate,
  requireAdmin,
  formsController.createField.bind(formsController)
);
router.put(
  '/admin/forms/fields/:id',
  authenticate,
  requireAdmin,
  formsController.updateField.bind(formsController)
);
router.delete(
  '/admin/forms/fields/:id',
  authenticate,
  requireAdmin,
  formsController.deleteField.bind(formsController)
);
router.get(
  '/admin/forms/:formId/submissions',
  authenticate,
  requireAdmin,
  formsController.listSubmissions.bind(formsController)
);

// 前台
router.post('/forms/:slug/submit', formsController.submitForm.bind(formsController));

export default router;
