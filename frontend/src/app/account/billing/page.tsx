'use client';

/**
 * 订单与发票管理页面
 * 艹！这个页面展示用户的所有订单和发票信息！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  message,
  Spin,
  Card,
  Statistic,
  Row,
  Col,
  Select,
  DatePicker,
  Typography,
  Empty,
} from 'antd';
import {
  FileTextOutlined,
  DownloadOutlined,
  EyeOutlined,
  DollarOutlined,
  ShoppingOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { OrderDetailModal } from '@/components/billing/OrderDetailModal';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

/**
 * 订单状态类型
 */
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/**
 * 订单信息
 */
export interface Order {
  order_id: string; // 订单ID
  plan_type: 'free' | 'pro' | 'enterprise'; // 套餐类型
  plan_name: string; // 套餐名称
  amount: number; // 金额（元）
  status: OrderStatus; // 订单状态
  created_at: string; // 创建时间
  paid_at?: string; // 支付时间
  payment_method?: string; // 支付方式
  invoice_url?: string; // 发票URL
  has_invoice: boolean; // 是否有发票
}

/**
 * 订单统计
 */
interface OrderStats {
  total_orders: number; // 总订单数
  total_amount: number; // 总金额
  paid_orders: number; // 已支付订单数
  pending_orders: number; // 待支付订单数
}

/**
 * 订单状态配置
 */
const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: '待支付',
    color: 'orange',
    icon: <ClockCircleOutlined />,
  },
  paid: {
    label: '已支付',
    color: 'green',
    icon: <CheckCircleOutlined />,
  },
  failed: {
    label: '支付失败',
    color: 'red',
    icon: <CloseCircleOutlined />,
  },
  refunded: {
    label: '已退款',
    color: 'default',
    icon: <CloseCircleOutlined />,
  },
};

/**
 * 订单与发票管理页面
 */
export default function BillingPage() {
  // 订单列表
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  // 订单统计
  const [stats, setStats] = useState<OrderStats>({
    total_orders: 0,
    total_amount: 0,
    paid_orders: 0,
    pending_orders: 0,
  });

  // 筛选条件
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  // 下载发票加载状态
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);

  // 订单详情Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetailVisible, setOrderDetailVisible] = useState(false);

  /**
   * 加载订单列表
   */
  const loadOrders = async () => {
    setLoading(true);

    try {
      // 构建查询参数
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (dateRange) {
        params.append('start_date', dateRange[0].toISOString());
        params.append('end_date', dateRange[1].toISOString());
      }

      const response = await fetch(`/api/billing/orders?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`获取订单失败: ${response.status}`);
      }

      const data = await response.json();

      setOrders(data.orders || []);
      setStats(data.stats || stats);
    } catch (error: any) {
      console.error('[订单管理] 获取订单失败:', error);
      message.error(error.message || '获取订单失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 下载发票
   */
  const handleDownloadInvoice = async (orderId: string) => {
    setDownloadingInvoice(orderId);

    try {
      const response = await fetch(`/api/billing/invoice/${orderId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`下载发票失败: ${response.status}`);
      }

      // 获取文件Blob
      const blob = await response.blob();

      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `发票_${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      message.success('发票下载成功');
    } catch (error: any) {
      console.error('[订单管理] 下载发票失败:', error);
      message.error(error.message || '下载发票失败');
    } finally {
      setDownloadingInvoice(null);
    }
  };

  /**
   * 查看订单详情
   */
  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setOrderDetailVisible(true);
  };

  /**
   * 关闭订单详情Modal
   */
  const handleCloseOrderDetail = () => {
    setOrderDetailVisible(false);
    setSelectedOrder(null);
  };

  /**
   * 初始化
   */
  useEffect(() => {
    loadOrders();
  }, [statusFilter, dateRange]);

  /**
   * 订单表格列定义
   */
  const columns: ColumnType<Order>[] = [
    {
      title: '订单编号',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 200,
      render: (orderId: string) => (
        <Text copyable={{ text: orderId }} style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {orderId.substring(0, 20)}...
        </Text>
      ),
    },
    {
      title: '套餐',
      dataIndex: 'plan_name',
      key: 'plan_name',
      width: 120,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount: number) => (
        <Text strong style={{ color: '#ff4d4f', fontSize: 16 }}>
          ¥{amount.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: OrderStatus) => {
        const config = ORDER_STATUS_CONFIG[status];
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '支付时间',
      dataIndex: 'paid_at',
      key: 'paid_at',
      width: 180,
      render: (date?: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '支付方式',
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 120,
      render: (method?: string) => method || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_: any, record: Order) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewOrder(record)}
          >
            详情
          </Button>
          {record.has_invoice && (
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              loading={downloadingInvoice === record.order_id}
              onClick={() => handleDownloadInvoice(record.order_id)}
            >
              发票
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          订单与发票管理
        </Title>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总订单数"
              value={stats.total_orders}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总金额"
              value={stats.total_amount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已支付订单"
              value={stats.paid_orders}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待支付订单"
              value={stats.pending_orders}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <span>订单状态：</span>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            options={[
              { label: '全部', value: 'all' },
              { label: '待支付', value: 'pending' },
              { label: '已支付', value: 'paid' },
              { label: '支付失败', value: 'failed' },
              { label: '已退款', value: 'refunded' },
            ]}
          />
          <span>时间范围：</span>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
            format="YYYY-MM-DD"
            allowClear
          />
        </Space>
      </Card>

      {/* 订单列表 */}
      <Card>
        <Spin spinning={loading}>
          {orders.length > 0 ? (
            <Table
              columns={columns}
              dataSource={orders}
              rowKey="order_id"
              pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条订单`,
                defaultPageSize: 10,
                pageSizeOptions: ['10', '20', '50', '100'],
              }}
              scroll={{ x: 1200 }}
            />
          ) : (
            <Empty
              description="暂无订单记录"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '60px 0' }}
            />
          )}
        </Spin>
      </Card>

      {/* 订单详情Modal */}
      <OrderDetailModal
        order={selectedOrder}
        open={orderDetailVisible}
        onClose={handleCloseOrderDetail}
        onDownloadInvoice={handleDownloadInvoice}
        downloadingInvoice={downloadingInvoice === selectedOrder?.order_id}
      />
    </div>
  );
}
