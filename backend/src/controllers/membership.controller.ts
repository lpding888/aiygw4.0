import type { Request, Response, NextFunction } from 'express';
import membershipService from '../services/membership.service.js';
import logger from '../utils/logger.js';

class MembershipController {
  async purchase(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId || req.user?.id;
      const { channel } = req.body as { channel?: string };
      if (!channel || !['wx', 'alipay'].includes(channel)) {
        res
          .status(400)
          .json({ success: false, error: { code: 5003, message: '支付渠道参数错误' } });
        return;
      }
      const result = await (membershipService as any).purchase(userId, channel);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async paymentCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const callbackData = req.body as any;
      await (membershipService as any).handlePaymentCallback(callbackData);
      res.json({ success: true });
    } catch (error) {
      logger.error('支付回调处理失败:', error as any);
      next(error);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId || req.user?.id;
      const status = await (membershipService as any).getStatus(userId);
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }
}

export default new MembershipController();
