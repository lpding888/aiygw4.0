import type { Knex } from 'knex';
import { db } from '../db/index.js';
import { generateOrderId } from '../utils/generator.js';
import logger from '../utils/logger.js';
import commissionService from './commission.service.js';
import type { OrderStatus } from '../types/payment.types.js';

type PaymentChannel = 'wx' | 'alipay';

interface OrderRecord {
  id: string;
  userId: string;
  status: OrderStatus;
  final_amount: number;
  channel: PaymentChannel;
  transactionId: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

interface UserMembershipData {
  isMember: boolean;
  quota_remaining: number;
  quota_expireAt: Date | string | null;
  updated_at: Date;
}

interface PaymentParams {
  [key: string]: string;
}

interface PaymentCallbackResponse {
  success: boolean;
  message?: string;
}

type PaymentCallbackData = {
  orderId: string;
  transactionId: string;
  channel: PaymentChannel;
};

class MembershipService {
  async purchase(
    userId: string,
    channel: PaymentChannel
  ): Promise<{ orderId: string; payParams: PaymentParams }> {
    const price = Number(process.env.MEMBERSHIP_PRICE) || 9900;

    const orderId = generateOrderId();
    await db('orders').insert({
      id: orderId,
      userId,
      status: 'pending',
      amount: price,
      final_amount: price,
      channel,
      transactionId: null,
      createdAt: new Date(),
      paidAt: null
    });

    logger.info(`订单创建: orderId=${orderId}, userId=${userId}, channel=${channel}`);

    const payParams = await this.getPaymentParams(orderId, price, channel);

    return {
      orderId,
      payParams
    };
  }

  private async getPaymentParams(
    orderId: string,
    amount: number,
    channel: PaymentChannel
  ): Promise<PaymentParams> {
    if (channel === 'wx') {
      return {
        appId: process.env.WECHAT_APPID ?? '',
        timeStamp: Math.floor(Date.now() / 1000).toString(),
        nonceStr: Math.random().toString(36).substring(2, 15),
        package: `prepay_id=mock_${orderId}`,
        signType: 'RSA',
        paySign: `MOCK_SIGN_${orderId}`,
        amount: amount.toString()
      };
    }

    if (channel === 'alipay') {
      return {
        orderString: `app_id=mock&method=alipay.trade.app.pay&out_trade_no=${orderId}`
      };
    }

    throw {
      statusCode: 400,
      errorCode: 5003,
      message: '不支持的支付渠道'
    };
  }

  async handlePaymentCallback(callbackData: PaymentCallbackData): Promise<PaymentCallbackResponse> {
    const { orderId, transactionId } = callbackData;

    const order = await db<OrderRecord>('orders').where('id', orderId).first();

    if (!order) {
      throw {
        statusCode: 404,
        errorCode: 5002,
        message: '订单不存在'
      };
    }

    if (order.status === 'paid') {
      logger.info(`订单已处理,跳过: orderId=${orderId}`);
      return { success: true, message: '订单已处理' };
    }

    await db.transaction<void>(async (trx: Knex.Transaction) => {
      await trx('orders').where('id', orderId).update({
        status: 'paid',
        transactionId,
        paidAt: new Date()
      });

      const quota = Number(process.env.PLAN_MONTHLY_QUOTA) || 100;
      const durationDays = Number(process.env.MEMBERSHIP_DURATION_DAYS) || 30;
      const expireAt = new Date(Date.now() + durationDays * 24 * 3600 * 1000);

      await trx('users').where('id', order.userId).update({
        isMember: true,
        quota_remaining: quota,
        quota_expireAt: expireAt,
        updated_at: new Date()
      });

      logger.info(`会员开通成功: userId=${order.userId}, quota=${quota}, expireAt=${expireAt}`);

      try {
        await commissionService.calculateAndCreateCommission(
          trx,
          order.userId,
          order.id,
          order.final_amount / 100
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(`佣金计算失败: orderId=${orderId}, error=${err.message}`);
      }
    });

    return { success: true };
  }

  async getStatus(userId: string): Promise<{
    isMember: boolean;
    quota_remaining: number;
    quota_expireAt: Date | string | null;
    expireDays: number;
    price: number;
  }> {
    const user = await db<UserMembershipData>('users').where('id', userId).first();

    if (!user) {
      throw {
        statusCode: 404,
        errorCode: 1004,
        message: '用户不存在'
      };
    }

    const now = new Date();
    let isMember = user.isMember;
    let quotaRemaining = user.quota_remaining;

    if (user.quota_expireAt && new Date(user.quota_expireAt) < now && isMember) {
      await db('users').where('id', userId).update({
        isMember: false,
        quota_remaining: 0,
        updated_at: now
      });

      isMember = false;
      quotaRemaining = 0;
      logger.info(`会员已到期,自动降级: userId=${userId}`);
    }

    let expireDays = 0;
    if (user.quota_expireAt) {
      const expireDate = new Date(user.quota_expireAt);
      expireDays = Math.max(
        0,
        Math.ceil((expireDate.getTime() - now.getTime()) / (24 * 3600 * 1000))
      );
    }

    return {
      isMember,
      quota_remaining: quotaRemaining,
      quota_expireAt: user.quota_expireAt,
      expireDays,
      price: Number(process.env.MEMBERSHIP_PRICE) || 9900
    };
  }
}

const membershipService = new MembershipService();
export default membershipService;
