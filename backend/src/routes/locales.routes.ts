/**
 * 多语言管理路由
 */
import { Router } from 'express';
import localesController from '../controllers/locales.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 管理端
router.get(
  '/admin/locales',
  authenticate,
  requireAdmin,
  localesController.listLocales.bind(localesController)
);
router.post(
  '/admin/locales',
  authenticate,
  requireAdmin,
  localesController.createLocale.bind(localesController)
);
router.put(
  '/admin/locales/:id',
  authenticate,
  requireAdmin,
  localesController.updateLocale.bind(localesController)
);
router.delete(
  '/admin/locales/:id',
  authenticate,
  requireAdmin,
  localesController.deleteLocale.bind(localesController)
);
router.get(
  '/admin/locales/:code/translations',
  authenticate,
  requireAdmin,
  localesController.getTranslations.bind(localesController)
);
router.put(
  '/admin/locales/:code/translations',
  authenticate,
  requireAdmin,
  localesController.setTranslation.bind(localesController)
);
router.post(
  '/admin/locales/:code/translations/batch',
  authenticate,
  requireAdmin,
  localesController.batchSetTranslations.bind(localesController)
);
router.get(
  '/admin/locales/stats',
  authenticate,
  requireAdmin,
  localesController.getStats.bind(localesController)
);

// 前台
router.get('/locales', localesController.listLocales.bind(localesController));
router.get(
  '/locales/:code/translations',
  localesController.getTranslations.bind(localesController)
);

export default router;
