/**
 * 支付服务
 *
 * 支持支付宝和微信支付
 * 包含支付、退款、查询等功能
 */

const crypto = require('crypto');
const axios = require('axios');
const { knex } = require('../db/connection');
const logger = require('../utils/logger');

interface PaymentOrder {
  id: string;
  userId: string;
  type: 'alipay' | 'wechat';
  amount: number;
  subject: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  tradeNo?: string;
  outTradeNo: string;
  createdAt: Date;
  paidAt?: Date;
}

interface PaymentConfig {
  alipay: {
    appId: string;
    privateKey: string;
    publicKey: string;
    gateway: string;
  };
  wechat: {
    appId: string;
    mchId: string;
    apiKey: string;
    certPath: string;
    keyPath: string;
  };
}

export class PaymentService {
  private config: PaymentConfig;

  constructor() {
    this.config = {
      alipay: {
        appId: process.env.ALIPAY_APP_ID || '',
        privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
        publicKey: process.env.ALIPAY_PUBLIC_KEY || '',
        gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do'
      },
      wechat: {
        appId: process.env.WECHAT_APP_ID || '',
        mchId: process.env.WECHAT_MCH_ID || '',
        apiKey: process.env.WECHAT_API_KEY || '',
        certPath: process.env.WECHAT_CERT_PATH || '',
        keyPath: process.env.WECHAT_KEY_PATH || ''
      }
    };
  }

  /**
   * 创建支付订单
   */
  async createOrder(userId: string, type: 'alipay' | 'wechat', amount: number, subject: string): Promise<PaymentOrder> {
    const orderId = this.generateOrderId();

    const order: PaymentOrder = {
      id: this.generateId(),
      userId,
      type,
      amount,
      subject,
      status: 'pending',
      outTradeNo: orderId,
      createdAt: new Date()
    };

    // 保存到数据库
    await knex('payment_orders').insert({
      id: order.id,
      user_id: userId,
      type,
      amount,
      subject,
      status: 'pending',
      out_trade_no: orderId,
      created_at: order.createdAt
    });

    logger.info('支付订单已创建', { orderId, userId, type, amount });
    return order;
  }

  /**
   * 支付宝支付
   */
  async alipayPay(orderId: string, returnUrl?: string, notifyUrl?: string): Promise<string> {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error('订单不存在');

    const params = {
      app_id: this.config.alipay.appId,
      method: 'alipay.trade.page.pay',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.formatDate(new Date()),
      version: '1.0',
      notify_url: notifyUrl || `${process.env.API_DOMAIN}/api/payment/notify/alipay`,
      return_url: returnUrl || `${process.env.API_DOMAIN}/payment/success`,
      biz_content: JSON.stringify({
        out_trade_no: order.outTradeNo,
        product_code: 'FAST_INSTANT_TRADE_PAY',
        total_amount: order.amount.toFixed(2),
        subject: order.subject
      })
    };

    // 生成签名
    const sign = this.generateAlipaySign(params);
    params.sign = sign;

    // 构建支付URL
    const queryString = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');

    const paymentUrl = `${this.config.alipay.gateway}?${queryString}`;

    logger.info('支付宝支付链接已生成', { orderId, paymentUrl });
    return paymentUrl;
  }

  /**
   * 微信支付
   */
  async wechatPay(orderId: string, tradeType: 'JSAPI' | 'NATIVE' | 'APP' = 'JSAPI'): Promise<any> {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error('订单不存在');

    const params = {
      appid: this.config.wechat.appId,
      mch_id: this.config.wechat.mchId,
      nonce_str: this.generateNonceStr(),
      body: order.subject,
      out_trade_no: order.outTradeNo,
      total_fee: Math.round(order.amount * 100), // 转换为分
      spbill_create_ip: '127.0.0.1',
      notify_url: `${process.env.API_DOMAIN}/api/payment/notify/wechat`,
      trade_type: tradeType
    };

    // 生成签名
    const sign = this.generateWechatSign(params);
    params.sign = sign;

    const xmlData = this.buildXml(params);

    try {
      const response = await axios.post('https://api.mch.weixin.qq.com/pay/unifiedorder', xmlData, {
        headers: { 'Content-Type': 'application/xml' }
      });

      const result = this.parseXml(response.data);

      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        logger.info('微信支付预订单已创建', { orderId, prepayId: result.prepay_id });

        if (tradeType === 'JSAPI') {
          // 返回JSAPI支付参数
          const payParams = {
            appId: this.config.wechat.appId,
            timeStamp: Math.floor(Date.now() / 1000).toString(),
            nonceStr: this.generateNonceStr(),
            package: `prepay_id=${result.prepay_id}`,
            signType: 'MD5'
          };

          payParams.paySign = this.generateWechatSign(payParams);
          return payParams;
        }

        return result;
      } else {
        throw new Error(`微信支付失败: ${result.return_msg || result.err_code_des}`);
      }
    } catch (error) {
      logger.error('微信支付请求失败', { orderId, error: error.message });
      throw error;
    }
  }

  /**
   * 支付宝回调处理
   */
  async handleAlipayNotify(params: any): Promise<boolean> {
    try {
      // 验证签名
      if (!this.verifyAlipaySign(params)) {
        logger.warn('支付宝回调签名验证失败', { params });
        return false;
      }

      const outTradeNo = params.out_trade_no;
      const tradeStatus = params.trade_status;
      const tradeNo = params.trade_no;

      const order = await knex('payment_orders')
        .where('out_trade_no', outTradeNo)
        .first();

      if (!order) {
        logger.warn('支付宝回调订单不存在', { outTradeNo });
        return false;
      }

      // 更新订单状态
      if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
        await knex('payment_orders')
          .where('id', order.id)
          .update({
            status: 'paid',
            trade_no: tradeNo,
            paid_at: new Date(),
            updated_at: new Date()
          });

        // 触发支付成功事件
        await this.handlePaymentSuccess(order);

        logger.info('支付宝支付成功', { orderId: order.id, tradeNo });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('处理支付宝回调失败', { error: error.message });
      return false;
    }
  }

  /**
   * 微信回调处理
   */
  async handleWechatNotify(xmlData: string): Promise<boolean> {
    try {
      const params = this.parseXml(xmlData);

      // 验证签名
      if (!this.verifyWechatSign(params)) {
        logger.warn('微信回调签名验证失败', { params });
        return false;
      }

      const outTradeNo = params.out_trade_no;
      const resultCode = params.result_code;
      const transactionId = params.transaction_id;

      const order = await knex('payment_orders')
        .where('out_trade_no', outTradeNo)
        .first();

      if (!order) {
        logger.warn('微信回调订单不存在', { outTradeNo });
        return false;
      }

      // 更新订单状态
      if (resultCode === 'SUCCESS') {
        await knex('payment_orders')
          .where('id', order.id)
          .update({
            status: 'paid',
            trade_no: transactionId,
            paid_at: new Date(),
            updated_at: new Date()
          });

        // 触发支付成功事件
        await this.handlePaymentSuccess(order);

        logger.info('微信支付成功', { orderId: order.id, transactionId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('处理微信回调失败', { error: error.message });
      return false;
    }
  }

  /**
   * 查询订单状态
   */
  async queryOrder(orderId: string): Promise<PaymentOrder | null> {
    const order = await knex('payment_orders')
      .where('id', orderId)
      .first();

    if (!order) return null;

    // 如果订单仍是pending状态，主动查询支付平台
    if (order.status === 'pending') {
      await this.queryPaymentStatus(order);
    }

    return order;
  }

  /**
   * 退款
   */
  async refund(orderId: string, refundAmount?: number, reason?: string): Promise<boolean> {
    const order = await this.getOrder(orderId);
    if (!order || order.status !== 'paid') {
      throw new Error('订单状态不支持退款');
    }

    const actualRefundAmount = refundAmount || order.amount;
    const refundId = this.generateRefundId();

    try {
      let refundResult;

      if (order.type === 'alipay') {
        refundResult = await this.alipayRefund(order, actualRefundAmount, refundId, reason);
      } else {
        refundResult = await this.wechatRefund(order, actualRefundAmount, refundId, reason);
      }

      if (refundResult) {
        // 更新订单状态
        await knex('payment_orders')
          .where('id', order.id)
          .update({
            status: 'refunded',
            updated_at: new Date()
          });

        // 记录退款
        await knex('payment_refunds').insert({
          id: this.generateId(),
          order_id: order.id,
          refund_id: refundId,
          amount: actualRefundAmount,
          reason: reason || '用户退款',
          status: 'success',
          created_at: new Date()
        });

        logger.info('退款成功', { orderId, refundId, amount: actualRefundAmount });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('退款失败', { orderId, error: error.message });

      // 记录退款失败
      await knex('payment_refunds').insert({
        id: this.generateId(),
        order_id: order.id,
        refund_id: refundId,
        amount: actualRefundAmount,
        reason: reason || '用户退款',
        status: 'failed',
        error_message: error.message,
        created_at: new Date()
      });

      return false;
    }
  }

  /**
   * 支付宝退款
   */
  private async alipayRefund(order: PaymentOrder, amount: number, refundId: string, reason?: string): Promise<boolean> {
    const params = {
      app_id: this.config.alipay.appId,
      method: 'alipay.trade.refund',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.formatDate(new Date()),
      version: '1.0',
      biz_content: JSON.stringify({
        out_trade_no: order.outTradeNo,
        refund_amount: amount.toFixed(2),
        refund_reason: reason || '用户退款',
        out_request_no: refundId
      })
    };

    const sign = this.generateAlipaySign(params);
    params.sign = sign;

    try {
      const response = await axios.post(this.config.alipay.gateway, null, { params });
      const result = response.data;

      if (result.alipay_trade_refund_response.code === '10000') {
        return true;
      } else {
        throw new Error(`支付宝退款失败: ${result.alipay_trade_refund_response.msg}`);
      }
    } catch (error) {
      logger.error('支付宝退款请求失败', { orderId: order.id, error: error.message });
      return false;
    }
  }

  /**
   * 微信退款
   */
  private async wechatRefund(order: PaymentOrder, amount: number, refundId: string, reason?: string): Promise<boolean> {
    const params = {
      appid: this.config.wechat.appId,
      mch_id: this.config.wechat.mchId,
      nonce_str: this.generateNonceStr(),
      out_trade_no: order.outTradeNo,
      out_refund_no: refundId,
      total_fee: Math.round(order.amount * 100),
      refund_fee: Math.round(amount * 100),
      refund_desc: reason || '用户退款'
    };

    const sign = this.generateWechatSign(params);
    params.sign = sign;

    const xmlData = this.buildXml(params);

    try {
      const response = await axios.post('https://api.mch.weixin.qq.com/secapi/pay/refund', xmlData, {
        headers: { 'Content-Type': 'application/xml' }
      });

      const result = this.parseXml(response.data);

      if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
        return true;
      } else {
        throw new Error(`微信退款失败: ${result.err_code_des}`);
      }
    } catch (error) {
      logger.error('微信退款请求失败', { orderId: order.id, error: error.message });
      return false;
    }
  }

  /**
   * 处理支付成功
   */
  private async handlePaymentSuccess(order: PaymentOrder): Promise<void> {
    // 更新用户会员状态
    await knex.transaction(async (trx) => {
      const user = await trx('users').where('id', order.userId).first();

      if (user) {
        // 延长会员时间或增加配额
        const newExpireAt = user.quota_expireAt
          ? new Date(new Date(user.quota_expireAt).getTime() + 30 * 24 * 60 * 60 * 1000) // 30天
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await trx('users')
          .where('id', order.userId)
          .update({
            is_member: true,
            quota_remaining: trx.raw('quota_remaining + ?', [100]), // 增加100次配额
            quota_expireAt: newExpireAt,
            updated_at: new Date()
          });
      }
    });

    // 发送支付成功通知（可以通过WebSocket、邮件等）
    logger.info('支付后续处理完成', { orderId: order.id, userId: order.userId });
  }

  /**
   * 查询支付状态
   */
  private async queryPaymentStatus(order: PaymentOrder): Promise<void> {
    // 这里可以调用支付宝或微信的查询接口
    // 为了简化，暂时跳过主动查询
  }

  /**
   * 获取订单
   */
  private async getOrder(orderId: string): Promise<PaymentOrder | null> {
    const order = await knex('payment_orders')
      .where('id', orderId)
      .first();

    return order || null;
  }

  /**
   * 生成支付宝签名
   */
  private generateAlipaySign(params: any): string {
    const sortedParams = Object.keys(params)
      .filter(key => params[key] && key !== 'sign')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const sign = crypto
      .createSign('RSA-SHA256')
      .update(sortedParams, 'utf8')
      .sign(this.config.alipay.privateKey, 'base64');

    return sign;
  }

  /**
   * 验证支付宝签名
   */
  private verifyAlipaySign(params: any): boolean {
    const sign = params.sign;
    const sortedParams = Object.keys(params)
      .filter(key => params[key] && key !== 'sign' && key !== 'sign_type')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    try {
      return crypto
        .createVerify('RSA-SHA256')
        .update(sortedParams, 'utf8')
        .verify(this.config.alipay.publicKey, sign, 'base64');
    } catch (error) {
      return false;
    }
  }

  /**
   * 生成微信签名
   */
  private generateWechatSign(params: any): string {
    const sortedParams = Object.keys(params)
      .filter(key => params[key] && key !== 'sign')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    sortedParams += `&key=${this.config.wechat.apiKey}`;

    return crypto.createHash('md5').update(sortedParams, 'utf8').digest('hex').toUpperCase();
  }

  /**
   * 验证微信签名
   */
  private verifyWechatSign(params: any): boolean {
    const sign = params.sign;
    const calculatedSign = this.generateWechatSign(params);
    return sign === calculatedSign;
  }

  /**
   * 构建XML
   */
  private buildXml(params: any): string {
    let xml = '<xml>';
    for (const key in params) {
      xml += `<${key}><![CDATA[${params[key]}]]></${key}>`;
    }
    xml += '</xml>';
    return xml;
  }

  /**
   * 解析XML
   */
  private parseXml(xmlData: string): any {
    const xml2js = require('xml2js');
    let result = {};

    xml2js.parseString(xmlData, { explicitArray: false }, (err, data) => {
      if (!err && data.xml) {
        result = data.xml;
      }
    });

    return result;
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date): string {
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z/, '');
  }

  /**
   * 生成订单ID
   */
  private generateOrderId(): string {
    return `ORDER${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  /**
   * 生成退款ID
   */
  private generateRefundId(): string {
    return `REFUND${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  /**
   * 生成随机字符串
   */
  private generateNonceStr(): string {
    return Math.random().toString(36).substr(2, 32);
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 单例实例
const paymentService = new PaymentService();
module.exports = paymentService;