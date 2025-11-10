/**
 * Payment 类型定义
 * 艹！这个SB文件定义支付管理的所有类型，消除any！
 *
 * @author 老王
 */

/**
 * 支付方式
 */
export type PaymentMethod = 'alipay' | 'wechat' | 'balance';

/**
 * 订单状态
 */
export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded' | 'failed';

/**
 * 退款状态
 */
export type RefundStatus = 'pending' | 'success' | 'failed' | 'rejected';

/**
 * 产品类型
 */
export type ProductType = 'quota' | 'membership' | 'feature' | 'other';

/**
 * 创建支付订单请求
 */
export interface CreatePaymentOrderRequest {
  productType: ProductType;
  productId?: string;
  productName: string;
  productDescription?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  returnUrl?: string;
  notifyUrl?: string;
}

/**
 * 支付订单数据库模型
 */
export interface PaymentOrder {
  id: string;
  order_no: string;
  user_id: string;
  product_type: ProductType;
  product_id?: string;
  product_name: string;
  product_description?: string;
  amount: number;
  payment_method: PaymentMethod;
  status: OrderStatus;
  paid_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * 创建支付订单响应
 */
export interface CreatePaymentOrderResponse {
  orderId: string;
  orderNo: string;
  paymentUrl?: string;
  qrCode?: string;
  amount: number;
  expiresAt?: string;
}

/**
 * 创建退款请求
 */
export interface CreateRefundRequest {
  orderId: string;
  refundAmount?: number;
  refundReason: string;
}

/**
 * 退款记录数据库模型
 */
export interface RefundRecord {
  id: string;
  order_id: string;
  user_id: string;
  refund_no: string;
  refund_amount: number;
  refund_reason: string;
  status: RefundStatus;
  refunded_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * 创建退款响应
 */
export interface CreateRefundResponse {
  refundId: string;
  refundNo: string;
  status: RefundStatus;
  refundAmount: number;
}

/**
 * 订单状态响应
 */
export interface OrderStatusResponse {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  amount: number;
  productName: string;
  paymentMethod: PaymentMethod;
  paidAt?: string | null;
  createdAt: string;
}

/**
 * 支付记录查询参数
 */
export interface PaymentRecordsQuery {
  page?: string;
  limit?: string;
  status?: OrderStatus;
  paymentMethod?: PaymentMethod;
}

/**
 * 退款记录查询参数
 */
export interface RefundRecordsQuery {
  page?: string;
  limit?: string;
  status?: RefundStatus;
}

/**
 * 分页响应
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/**
 * 支付记录列表响应
 */
export interface PaymentRecordsResponse {
  orders: PaymentOrder[];
  pagination: PaginationInfo;
}

/**
 * 退款记录列表响应
 */
export interface RefundRecordsResponse {
  refunds: RefundRecord[];
  pagination: PaginationInfo;
}

/**
 * 支付统计响应
 */
export interface PaymentStatsResponse {
  totalOrders: number;
  paidOrders: number;
  totalAmount: number;
  totalRefunds: number;
  refundAmount: number;
}

/**
 * Express Request扩展(包含用户信息)
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role?: string;
    [key: string]: unknown;
  };
  id?: string;
}

/**
 * 支付服务接口（用于controller调用）
 */
export interface PaymentService {
  createPaymentOrder(userId: string, data: CreatePaymentOrderRequest): Promise<CreatePaymentOrderResponse>;
  handleAlipayCallback(data: Record<string, unknown>): Promise<{ success: boolean }>;
  handleWechatCallback(data: Record<string, unknown>): Promise<{ success: boolean; message?: string }>;
  createRefund(
    orderId: string,
    userId: string,
    data: { refundAmount?: number; refundReason: string }
  ): Promise<CreateRefundResponse>;
  getOrderStatus(orderId: string, userId?: string): Promise<OrderStatusResponse>;
}

/**
 * 数据库查询结果类型
 */
export interface CountResult {
  count: number;
}

export interface SumResult {
  total: number;
}
