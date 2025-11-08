import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import paymentService from '../services/payment.service.js';
import { db } from '../config/database.js';

class PaymentController {
  async createPaymentOrder(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
        return;
      }

      const {
        productType,
        productId,
        productName,
        productDescription,
        amount,
        paymentMethod,
        returnUrl,
        notifyUrl
      } = req.body as any;
      const userId = req.user?.id as string;

      const result = await (paymentService as any).createPaymentOrder(userId, {
        productType,
        productId,
        productName,
        productDescription,
        amount,
        paymentMethod,
        returnUrl,
        notifyUrl
      });

      res.json({
        success: true,
        data: result,
        message: '支付订单创建成功',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('[PaymentController] 创建支付订单失败:', error);
      res.status(500).json({
        success: false,
        error: { code: 'CREATE_ORDER_ERROR', message: error?.message || '创建支付订单失败' },
        timestamp: new Date().toISOString()
      });
    }
  }

  async handleAlipayNotify(req: Request, res: Response) {
    try {
      logger.info('[PaymentController] 收到支付宝回调:', req.body);
      const result = await (paymentService as any).handleAlipayCallback(req.body);
      res.send(result?.success ? 'success' : 'fail');
    } catch (error) {
      logger.error('[PaymentController] 处理支付宝回调失败:', error as any);
      res.send('fail');
    }
  }

  async handleWechatNotify(req: Request, res: Response) {
    try {
      logger.info('[PaymentController] 收到微信回调:', req.body);
      const result = await (paymentService as any).handleWechatCallback(req.body);
      if (result?.success) res.json({ code: 'SUCCESS', message: 'success' });
      else res.json({ code: 'FAIL', message: (result as any)?.message });
    } catch (error: any) {
      logger.error('[PaymentController] 处理微信回调失败:', error);
      res.json({ code: 'FAIL', message: error?.message });
    }
  }

  async createRefund(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
        return;
      }

      const { orderId, refundAmount, refundReason } = req.body as any;
      const userId = req.user?.id as string;
      const result = await (paymentService as any).createRefund(orderId, userId, {
        refundAmount,
        refundReason
      });
      res.json({
        success: true,
        data: result,
        message: '退款申请提交成功',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('[PaymentController] 创建退款失败:', error);
      res.status(500).json({
        success: false,
        error: { code: 'CREATE_REFUND_ERROR', message: error?.message || '创建退款失败' },
        timestamp: new Date().toISOString()
      });
    }
  }

  async getOrderStatus(req: Request, res: Response) {
    try {
      const { orderId } = req.params as { orderId: string };
      const userId = req.user?.id as string;
      const order = await (paymentService as any).getOrderStatus(orderId, userId);
      res.json({ success: true, data: order, timestamp: new Date().toISOString() });
    } catch (error: any) {
      logger.error('[PaymentController] 查询订单状态失败:', error);
      res.status(404).json({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: error?.message || '订单不存在' },
        timestamp: new Date().toISOString()
      });
    }
  }

  async getUserPaymentRecords(req: Request, res: Response) {
    try {
      const userId = req.user?.id as string;
      const {
        page = '1',
        limit = '20',
        status,
        paymentMethod
      } = req.query as Record<string, string>;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      let query = db('payment_orders')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(parseInt(limit, 10))
        .offset(offset);
      if (status) query = query.where('status', status);
      if (paymentMethod) query = query.where('payment_method', paymentMethod);
      const orders = await query;
      let countQuery = db('payment_orders').where('user_id', userId);
      if (status) countQuery = countQuery.where('status', status);
      const total = (await countQuery.count('* as total').first()) as any;
      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total: parseInt(String(total?.total ?? 0), 10),
            pages: Math.ceil(parseInt(String(total?.total ?? 0), 10) / parseInt(limit, 10))
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('[PaymentController] 获取支付记录失败:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_RECORDS_ERROR', message: '获取支付记录失败' }
      });
    }
  }

  async getUserRefundRecords(req: Request, res: Response) {
    try {
      const userId = req.user?.id as string;
      const { page = '1', limit = '20', status } = req.query as Record<string, string>;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      let query = db('refund_records')
        .leftJoin('payment_orders', 'refund_records.order_id', 'payment_orders.id')
        .select(
          'refund_records.*',
          'payment_orders.product_name',
          'payment_orders.order_no as original_order_no'
        )
        .where('refund_records.user_id', userId)
        .orderBy('refund_records.created_at', 'desc')
        .limit(parseInt(limit, 10))
        .offset(offset);
      if (status) query = query.where('refund_records.status', status);
      const refunds = await query;
      let countQuery = db('refund_records').where('user_id', userId);
      if (status) countQuery = countQuery.where('status', status);
      const total = (await countQuery.count('* as total').first()) as any;
      res.json({
        success: true,
        data: {
          refunds,
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total: parseInt(String(total?.total ?? 0), 10),
            pages: Math.ceil(parseInt(String(total?.total ?? 0), 10) / parseInt(limit, 10))
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('[PaymentController] 获取退款记录失败:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_REFUNDS_ERROR', message: '获取退款记录失败' }
      });
    }
  }

  async paymentSuccess(req: Request, res: Response) {
    try {
      const { orderId, out_trade_no } = req.query as Record<string, string>;
      let order: any = null;
      if (orderId) {
        order = await (paymentService as any).getOrderStatus(orderId);
      } else if (out_trade_no) {
        const orderRecord = await db('payment_orders').where('order_no', out_trade_no).first();
        if (orderRecord)
          order = await (paymentService as any).getOrderStatus((orderRecord as any).id);
      }
      if (!order) {
        res
          .status(404)
          .json({ success: false, error: { code: 'ORDER_NOT_FOUND', message: '订单不存在' } });
        return;
      }
      res.json({
        success: true,
        data: order,
        message: '支付成功',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('[PaymentController] 支付成功页面处理失败:', error);
      res.status(500).json({
        success: false,
        error: { code: 'PAYMENT_SUCCESS_ERROR', message: '处理支付成功页面失败' }
      });
    }
  }

  async paymentCancel(req: Request, res: Response) {
    try {
      const { orderId, out_trade_no } = req.query as Record<string, string>;
      let order: any = null;
      if (orderId) order = await (paymentService as any).getOrderStatus(orderId);
      else if (out_trade_no) {
        const orderRecord = await db('payment_orders').where('order_no', out_trade_no).first();
        if (orderRecord)
          order = await (paymentService as any).getOrderStatus((orderRecord as any).id);
      }
      if (order && order.status === 'pending') {
        await db('payment_orders')
          .where('id', order.orderId)
          .update({ status: 'cancelled', updated_at: new Date() });
        order.status = 'cancelled';
      }
      res.json({
        success: true,
        data: order,
        message: '支付已取消',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('[PaymentController] 支付取消页面处理失败:', error);
      res.status(500).json({
        success: false,
        error: { code: 'PAYMENT_CANCEL_ERROR', message: '处理支付取消页面失败' }
      });
    }
  }

  async getPaymentStats(req: Request, res: Response) {
    try {
      const userId = req.user?.id as string;
      const [totalOrders, paidOrders, totalAmount, totalRefunds, refundAmount] = await Promise.all([
        db('payment_orders').where('user_id', userId).count('* as count').first(),
        db('payment_orders').where({ user_id: userId, status: 'paid' }).count('* as count').first(),
        db('payment_orders')
          .where({ user_id: userId, status: 'paid' })
          .sum('amount as total')
          .first(),
        db('refund_records')
          .where({ user_id: userId, status: 'success' })
          .count('* as count')
          .first(),
        db('refund_records')
          .where({ user_id: userId, status: 'success' })
          .sum('refund_amount as total')
          .first()
      ]);
      res.json({
        success: true,
        data: {
          totalOrders: parseInt(String((totalOrders as any)?.count ?? 0), 10),
          paidOrders: parseInt(String((paidOrders as any)?.count ?? 0), 10),
          totalAmount: parseFloat(String((totalAmount as any)?.total ?? 0)) || 0,
          totalRefunds: parseInt(String((totalRefunds as any)?.count ?? 0), 10),
          refundAmount: parseFloat(String((refundAmount as any)?.total ?? 0)) || 0
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error('[PaymentController] 获取支付统计失败:', error);
      res
        .status(500)
        .json({ success: false, error: { code: 'GET_STATS_ERROR', message: '获取支付统计失败' } });
    }
  }
}

export default new PaymentController();
