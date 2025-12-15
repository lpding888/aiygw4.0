/**
 * 弹窗管理路由
 */

import { Router } from 'express';
import popupsController from '../controllers/popups.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 管理端
router.get(
  '/admin/popups',
  authenticate,
  requireAdmin,
  popupsController.listPopups.bind(popupsController)
);
router.post(
  '/admin/popups',
  authenticate,
  requireAdmin,
  popupsController.createPopup.bind(popupsController)
);
router.get(
  '/admin/popups/:id',
  authenticate,
  requireAdmin,
  popupsController.getPopup.bind(popupsController)
);
router.put(
  '/admin/popups/:id',
  authenticate,
  requireAdmin,
  popupsController.updatePopup.bind(popupsController)
);
router.delete(
  '/admin/popups/:id',
  authenticate,
  requireAdmin,
  popupsController.deletePopup.bind(popupsController)
);

// 前台
router.get('/popups/active', popupsController.getActivePopups.bind(popupsController));
router.post('/popups/:id/impression', popupsController.recordImpression.bind(popupsController));
router.post('/popups/:id/click', popupsController.recordClick.bind(popupsController));
router.post('/popups/:id/close', popupsController.recordClose.bind(popupsController));

export default router;
