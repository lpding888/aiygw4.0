import type { Request, Response, NextFunction } from 'express';
import membershipService, {
  type PaymentCallbackData,
  type PaymentChannel
} from '../services/membership.service.js';
import logger from '../utils/logger.js';
import { verifyMembershipWebhookSignature } from '../utils/webhookSignature.js';
import systemConfigService from '../services/systemConfig.service.js';

const getUserIdOrRespond = (req: Request, res: Response): string | null => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
    return null;
  }
  return userId;
};

const isValidCallbackData = (payload: unknown): payload is PaymentCallbackData => {
  if (!payload || typeof payload !== 'object') return false;
  const data = payload as Record<string, unknown>;
  return (
    typeof data.orderId === 'string' &&
    typeof data.transactionId === 'string' &&
    (data.channel === 'wx' || data.channel === 'alipay')
  );
};

class MembershipController {
  async purchase(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserIdOrRespond(req, res);
      if (!userId) return;
      const { channel } = req.body as { channel?: string };
      if (channel !== 'wx' && channel !== 'alipay') {
        res
          .status(400)
          .json({ success: false, error: { code: 5003, message: '支付渠道参数错误' } });
        return;
      }
      const result = await membershipService.purchase(userId, channel as PaymentChannel);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      next(error);
    }
  }

  async paymentCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const secretFromConfig = (await systemConfigService.get<string>(
        'membership_webhook_secret'
      )) as string | null;
      const webhookSecret = secretFromConfig?.trim() ?? null;
      if (!webhookSecret) {
        logger.error('[MembershipController] 未配置 membership_webhook_secret，拒绝处理');
        res.status(500).json({
          success: false,
          error: { code: 'CONFIG_MISSING', message: '会员回调密钥未配置' }
        });
        return;
      }

      const verification = verifyMembershipWebhookSignature(req, webhookSecret);
      if (!verification.ok) {
        logger.warn('[MembershipController] Webhook验签失败', { reason: verification.reason });
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_SIGNATURE', message: '回调验签失败' }
        });
        return;
      }

      const callbackData = req.body;
      if (!isValidCallbackData(callbackData)) {
        res
          .status(400)
          .json({ success: false, error: { code: 'VALIDATION_ERROR', message: '回调参数无效' } });
        return;
      }
      await membershipService.handlePaymentCallback(callbackData);
      res.json({ success: true });
    } catch (error: unknown) {
      logger.error('支付回调处理失败:', error);
      next(error);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserIdOrRespond(req, res);
      if (!userId) return;
      const status = await membershipService.getStatus(userId);
      res.json({ success: true, data: status });
    } catch (error: unknown) {
      next(error);
    }
  }
}

export default new MembershipController();
