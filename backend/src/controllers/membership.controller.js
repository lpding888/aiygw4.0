const membershipService = require('../services/membership.service');
const logger = require('../utils/logger');

/**
 * 会员控制器
 */
class MembershipController {
  /**
   * 购买会员
   * POST /api/membership/purchase
   */
  async purchase(req, res, next) {
    try {
      const userId = req.userId;
      const { channel } = req.body;

      // 参数验证
      if (!channel || !['wx', 'alipay'].includes(channel)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 5003,
            message: '支付渠道参数错误'
          }
        });
      }

      const result = await membershipService.purchase(userId, channel);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 支付回调
   * POST /api/membership/payment-callback
   */
  async paymentCallback(req, res, next) {
    try {
      // 支付回调数据格式根据不同渠道而定
      const callbackData = req.body;

      await membershipService.handlePaymentCallback(callbackData);

      // 返回支付平台要求的格式
      res.json({ success: true });
    } catch (error) {
      logger.error('支付回调处理失败:', error);
      next(error);
    }
  }

  /**
   * 获取会员状态
   * GET /api/membership/status
   */
  async getStatus(req, res, next) {
    try {
      const userId = req.userId;
      const status = await membershipService.getStatus(userId);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MembershipController();
