/**
 * 通知中心控制器
 */
import { Request, Response, NextFunction } from 'express';
import * as notificationsRepo from '../repositories/notifications.repo.js';

class NotificationsController {
  async listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { type, isRead, limit = 50, offset = 0 } = req.query;
      const notifications = await notificationsRepo.listNotifications({
        userId,
        type: type as string,
        isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      const unreadCount = userId ? await notificationsRepo.getUnreadCount(userId) : 0;
      res.json({ success: true, data: { items: notifications, unreadCount } });
    } catch (error) {
      next(error);
    }
  }

  async createNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notification = await notificationsRepo.createNotification({
        ...req.body,
        created_by: req.user?.id
      });
      res.status(201).json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  }

  async sendBulkNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userIds, ...data } = req.body;
      const count = await notificationsRepo.createBulkNotifications(userIds, {
        ...data,
        created_by: req.user?.id
      });
      res.json({ success: true, data: { sent: count } });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationsRepo.markAsRead(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { message: '未登录' } });
        return;
      }
      const count = await notificationsRepo.markAllAsRead(userId);
      res.json({ success: true, data: { marked: count } });
    } catch (error) {
      next(error);
    }
  }

  async deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationsRepo.deleteNotification(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { message: '未登录' } });
        return;
      }
      const count = await notificationsRepo.getUnreadCount(userId);
      res.json({ success: true, data: { count } });
    } catch (error) {
      next(error);
    }
  }
}

export default new NotificationsController();
