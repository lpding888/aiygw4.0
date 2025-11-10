import type { Request, Response, NextFunction } from 'express';
import membershipService from '../services/membership.service.js';
import logger from '../utils/logger.js';

interface RequestWithUserId extends Request {
  userId?: string;
}

class MembershipController {
  async purchase(req: RequestWithUserId, res: Response, next: NextFunction) {
    try {
      const userId = req.userId || req.user?.id;
      const { channel } = req.body as { channel?: string };
      if (!channel || !['wx', 'alipay'].includes(channel)) {
        res
          .status(400)
          .json({ success: false, error: { code: 5003, message: '支付渠道参数错误' } });
        return;
      }
      const result = await membershipService.purchase(userId, channel);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      next(error);
    }
  }

  async paymentCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const callbackData = req.body as Record<string, unknown>;
      await membershipService.handlePaymentCallback(callbackData);
      res.json({ success: true });
    } catch (error: unknown) {
      logger.error('支付回调处理失败:', error);
      next(error);
    }
  }

  async getStatus(req: RequestWithUserId, res: Response, next: NextFunction) {
    try {
      const userId = req.userId || req.user?.id;
      const status = await membershipService.getStatus(userId);
      res.json({ success: true, data: status });
    } catch (error: unknown) {
      next(error);
    }
  }
}

export default new MembershipController();
