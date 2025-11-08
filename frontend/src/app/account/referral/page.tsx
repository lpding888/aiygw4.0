'use client';

/**
 * 邀请/分销管理页面
 * 艹！这个页面管理邀请链接、佣金记录和提现申请！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Input,
  message,
  Space,
  Table,
  Tag,
  Tabs,
  Typography,
  Divider,
  Alert,
  Spin,
} from 'antd';
import {
  CopyOutlined,
  ShareAltOutlined,
  DollarOutlined,
  UserAddOutlined,
  TrophyOutlined,
  WalletOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnType } from 'antd/es/table';
import dayjs from 'dayjs';
import { WithdrawalModal } from '@/components/referral/WithdrawalModal';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

/**
 * 邀请统计数据
 */
interface ReferralStats {
  total_invites: number; // 总邀请数
  successful_invites: number; // 成功邀请数（已注册）
  total_commission: number; // 总佣金（元）
  available_balance: number; // 可提现余额（元）
  pending_commission: number; // 待结算佣金（元）
  withdrawn_amount: number; // 已提现金额（元）
}

/**
 * 佣金记录
 */
export interface CommissionRecord {
  id: string;
  invited_user_email: string; // 被邀请用户邮箱
  order_id: string; // 订单ID
  order_amount: number; // 订单金额
  commission_amount: number; // 佣金金额
  commission_rate: number; // 佣金比例（%）
  status: 'pending' | 'settled' | 'withdrawn'; // 佣金状态
  created_at: string; // 创建时间
  settled_at?: string; // 结算时间
}

/**
 * 提现记录
 */
export interface WithdrawalRecord {
  id: string;
  amount: number; // 提现金额
  status: 'pending' | 'processing' | 'completed' | 'rejected'; // 提现状态
  payment_method: string; // 提现方式
  payment_account: string; // 提现账号
  created_at: string; // 申请时间
  processed_at?: string; // 处理时间
  reject_reason?: string; // 拒绝原因
}

/**
 * 提现状态配置
 */
const WITHDRAWAL_STATUS_CONFIG: Record<
  WithdrawalRecord['status'],
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: '待处理',
    color: 'orange',
    icon: <ClockCircleOutlined />,
  },
  processing: {
    label: '处理中',
    color: 'blue',
    icon: <ClockCircleOutlined />,
  },
  completed: {
    label: '已完成',
    color: 'green',
    icon: <CheckCircleOutlined />,
  },
  rejected: {
    label: '已拒绝',
    color: 'red',
    icon: <CloseCircleOutlined />,
  },
};

/**
 * 邀请/分销管理页面
 */
export default function ReferralPage() {
  // 邀请统计
  const [stats, setStats] = useState<ReferralStats>({
    total_invites: 0,
    successful_invites: 0,
    total_commission: 0,
    available_balance: 0,
    pending_commission: 0,
    withdrawn_amount: 0,
  });

  // 邀请链接
  const [referralLink, setReferralLink] = useState('');
  const [referralCode, setReferralCode] = useState('');

  // 佣金记录
  const [commissionRecords, setCommissionRecords] = useState<CommissionRecord[]>([]);
  const [commissionLoading, setCommissionLoading] = useState(false);

  // 提现记录
  const [withdrawalRecords, setWithdrawalRecords] = useState<WithdrawalRecord[]>([]);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);

  // 提现Modal
  const [withdrawalModalVisible, setWithdrawalModalVisible] = useState(false);

  // 加载状态
  const [loading, setLoading] = useState(false);

  /**
   * 加载邀请统计
   */
  const loadStats = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/referral/stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`获取统计数据失败: ${response.status}`);
      }

      const data = await response.json();

      setStats(data.stats);
      setReferralLink(data.referral_link);
      setReferralCode(data.referral_code);
    } catch (error: any) {
      console.error('[邀请管理] 获取统计数据失败:', error);
      message.error(error.message || '获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载佣金记录
   */
  const loadCommissionRecords = async () => {
    setCommissionLoading(true);

    try {
      const response = await fetch('/api/referral/commissions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`获取佣金记录失败: ${response.status}`);
      }

      const data = await response.json();
      setCommissionRecords(data.records || []);
    } catch (error: any) {
      console.error('[邀请管理] 获取佣金记录失败:', error);
      message.error(error.message || '获取佣金记录失败');
    } finally {
      setCommissionLoading(false);
    }
  };

  /**
   * 加载提现记录
   */
  const loadWithdrawalRecords = async () => {
    setWithdrawalLoading(true);

    try {
      const response = await fetch('/api/referral/withdrawals', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`获取提现记录失败: ${response.status}`);
      }

      const data = await response.json();
      setWithdrawalRecords(data.records || []);
    } catch (error: any) {
      console.error('[邀请管理] 获取提现记录失败:', error);
      message.error(error.message || '获取提现记录失败');
    } finally {
      setWithdrawalLoading(false);
    }
  };

  /**
   * 复制邀请链接
   */
  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    message.success('邀请链接已复制到剪贴板');
  };

  /**
   * 分享邀请链接
   */
  const handleShareLink = () => {
    // TODO: 实现分享功能（可以集成微信、QQ等分享）
    message.info('分享功能开发中');
  };

  /**
   * 申请提现
   */
  const handleWithdrawal = () => {
    if (stats.available_balance <= 0) {
      message.warning('可提现余额不足');
      return;
    }

    if (stats.available_balance < 100) {
      message.warning('提现金额不能低于100元');
      return;
    }

    setWithdrawalModalVisible(true);
  };

  /**
   * 初始化
   */
  useEffect(() => {
    loadStats();
    loadCommissionRecords();
    loadWithdrawalRecords();
  }, []);

  /**
   * 佣金记录表格列
   */
  const commissionColumns: ColumnType<CommissionRecord>[] = [
    {
      title: '被邀请用户',
      dataIndex: 'invited_user_email',
      key: 'invited_user_email',
      width: 200,
    },
    {
      title: '订单金额',
      dataIndex: 'order_amount',
      key: 'order_amount',
      width: 120,
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '佣金比例',
      dataIndex: 'commission_rate',
      key: 'commission_rate',
      width: 100,
      render: (rate: number) => `${rate}%`,
    },
    {
      title: '佣金金额',
      dataIndex: 'commission_amount',
      key: 'commission_amount',
      width: 120,
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
      width: 100,
      render: (status: CommissionRecord['status']) => {
        const config: Record<typeof status, { label: string; color: string }> = {
          pending: { label: '待结算', color: 'orange' },
          settled: { label: '已结算', color: 'green' },
          withdrawn: { label: '已提现', color: 'blue' },
        };
        return <Tag color={config[status].color}>{config[status].label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  /**
   * 提现记录表格列
   */
  const withdrawalColumns: ColumnType<WithdrawalRecord>[] = [
    {
      title: '提现金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount: number) => (
        <Text strong style={{ color: '#ff4d4f', fontSize: 16 }}>
          ¥{amount.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '提现方式',
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 120,
    },
    {
      title: '提现账号',
      dataIndex: 'payment_account',
      key: 'payment_account',
      width: 200,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: WithdrawalRecord['status']) => {
        const config = WITHDRAWAL_STATUS_CONFIG[status];
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '处理时间',
      dataIndex: 'processed_at',
      key: 'processed_at',
      width: 180,
      render: (date?: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ShareAltOutlined style={{ marginRight: 8 }} />
          邀请/分销管理
        </Title>
      </div>

      <Spin spinning={loading}>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="总邀请数"
                value={stats.total_invites}
                prefix={<UserAddOutlined />}
                valueStyle={{ color: '#1890ff' }}
                suffix={`/ ${stats.successful_invites} 成功`}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="总佣金"
                value={stats.total_commission}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title="可提现余额"
                value={stats.available_balance}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 邀请链接卡片 */}
        <Card title="我的邀请链接" style={{ marginBottom: 24 }}>
          <Alert
            message="邀请好友注册并购买套餐，您将获得订单金额10%的佣金奖励！"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>邀请码：</Text>
              <Text copyable code style={{ fontSize: 16 }}>
                {referralCode}
              </Text>
            </div>

            <div>
              <Text strong>邀请链接：</Text>
              <Input.Search
                value={referralLink}
                readOnly
                enterButton={
                  <Button type="primary" icon={<CopyOutlined />}>
                    复制链接
                  </Button>
                }
                size="large"
                onSearch={handleCopyLink}
              />
            </div>

            <div>
              <Space>
                <Button type="primary" icon={<ShareAltOutlined />} onClick={handleShareLink}>
                  分享链接
                </Button>
                <Button
                  type="default"
                  icon={<WalletOutlined />}
                  onClick={handleWithdrawal}
                  disabled={stats.available_balance < 100}
                >
                  申请提现 (最低100元)
                </Button>
              </Space>
            </div>
          </Space>

          <Divider />

          {/* 提现说明 */}
          <div>
            <Title level={5}>提现规则</Title>
            <ul style={{ paddingLeft: 20, color: '#666' }}>
              <li>最低提现金额：100元</li>
              <li>佣金结算周期：订单支付成功后7天自动结算</li>
              <li>提现审核时间：1-3个工作日</li>
              <li>支持提现方式：微信、支付宝、银行卡</li>
            </ul>
          </div>
        </Card>

        {/* 数据详情Tabs */}
        <Tabs defaultActiveKey="commission">
          {/* 佣金记录 */}
          <TabPane tab="佣金记录" key="commission">
            <Card>
              <Table
                columns={commissionColumns}
                dataSource={commissionRecords}
                rowKey="id"
                loading={commissionLoading}
                pagination={{
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条记录`,
                  defaultPageSize: 10,
                }}
              />
            </Card>
          </TabPane>

          {/* 提现记录 */}
          <TabPane tab="提现记录" key="withdrawal">
            <Card>
              <Table
                columns={withdrawalColumns}
                dataSource={withdrawalRecords}
                rowKey="id"
                loading={withdrawalLoading}
                pagination={{
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条记录`,
                  defaultPageSize: 10,
                }}
              />
            </Card>
          </TabPane>
        </Tabs>
      </Spin>

      {/* 提现申请Modal */}
      <WithdrawalModal
        open={withdrawalModalVisible}
        onClose={() => setWithdrawalModalVisible(false)}
        onSuccess={() => {
          loadStats();
          loadWithdrawalRecords();
        }}
        availableBalance={stats.available_balance}
      />
    </div>
  );
}
