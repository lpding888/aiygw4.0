/**
 * 通知中心路由
 */
import { Router } from 'express';
import notificationsController from '../controllers/notifications.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 管理端
router.post(
  '/admin/notifications',
  authenticate,
  requireAdmin,
  notificationsController.createNotification.bind(notificationsController)
);
router.post(
  '/admin/notifications/bulk',
  authenticate,
  requireAdmin,
  notificationsController.sendBulkNotification.bind(notificationsController)
);

// 用户端
router.get(
  '/notifications',
  authenticate,
  notificationsController.listNotifications.bind(notificationsController)
);
router.get(
  '/notifications/unread-count',
  authenticate,
  notificationsController.getUnreadCount.bind(notificationsController)
);
router.patch(
  '/notifications/:id/read',
  authenticate,
  notificationsController.markAsRead.bind(notificationsController)
);
router.post(
  '/notifications/mark-all-read',
  authenticate,
  notificationsController.markAllAsRead.bind(notificationsController)
);
router.delete(
  '/notifications/:id',
  authenticate,
  notificationsController.deleteNotification.bind(notificationsController)
);

export default router;
