/**
 * 工作台页面
 * 艹！使用新的GPT5架构：FeatureGrid + useWorkbench！
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Typography,
  Space,
  Badge,
  Divider,
  message,
  Spin,
} from 'antd';
import {
  CrownOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { MembershipStatus } from '@/types';
import { useWorkbench } from '@/features/workbench';
import { FeatureGrid } from '@/features/workbench/ui/FeatureGrid';
import ErrorBoundary from '@/components/ErrorBoundary';

const { Title, Text, Paragraph } = Typography;

export default function WorkspacePage() {
  console.log('[Workspace] Rendering WorkspacePage...');
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [loading, setLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);

  /**
   * 艹！使用新的 useWorkbench Hook！
   * 自动处理功能列表、权限过滤、分类！
   */
  const { features, config } = useWorkbench();
  console.log('[Workspace] features:', features?.length, 'config:', config);

  /**
   * 获取会员状态
   */
  const fetchMembershipStatus = async () => {
    try {
      setLoading(true);
      const response: any = await api.membership.status();

      if (response.data.success && response.data.data) {
        setMembershipStatus(response.data.data);
        // 同步更新用户信息
        if (user) {
          updateUser({
            ...user,
            isMember: response.data.data.isMember,
            quota_remaining: response.data.data.quotaRemaining || response.data.data.quota_remaining,
            quota_expireAt: response.data.data.quotaExpireAt || response.data.data.quota_expireAt,
          });
        }
      }
    } catch (error: any) {
      console.error('获取会员状态失败:', error);
      // 不阻断页面渲染，只提示
      // message.error('获取会员状态失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 检查登录状态
    if (!user?.id) {
      router.replace('/login');
      return;
    }

    fetchMembershipStatus();
  }, [user, router]);

  /**
   * 计算剩余天数
   */
  const getRemainingDays = () => {
    const expireAt =
      (membershipStatus as any)?.quotaExpireAt ||
      (membershipStatus as any)?.quota_expireAt;
    if (!expireAt) return 0;
    const expireDate = new Date(expireAt);
    const now = new Date();
    const diff = expireDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  /**
   * 格式化到期时间
   */
  const formatExpireDate = () => {
    const expireAt =
      (membershipStatus as any)?.quotaExpireAt ||
      (membershipStatus as any)?.quota_expireAt;
    if (!expireAt) return '-';
    const date = new Date(expireAt);
    return date.toLocaleDateString('zh-CN');
  };

  if (loading && !user) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div
        style={{
          padding: '24px',
          minHeight: '100vh',
          background: '#F9FAFB',
        }}
      >
        {/* 顶部导航 */}
        <div
          style={{
            background: '#FFFFFF',
            padding: '16px 24px',
            marginBottom: '24px',
            borderRadius: '12px',
            border: '1px solid var(--border-primary)',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Title level={3} style={{ margin: 0 }}>
              AI服装处理平台
            </Title>
            <Space>
              <Text>
                欢迎, <strong>{user?.phone || user?.email || '用户'}</strong>
              </Text>
              {user?.role === 'admin' && (
                <Button
                  type="primary"
                  danger
                  onClick={() => router.push('/admin')}
                >
                  管理后台
                </Button>
              )}
              <Button
                onClick={() => {
                  const clearAuth = useAuthStore.getState().clearAuth;
                  clearAuth();
                  router.push('/login');
                }}
              >
                退出登录
              </Button>
            </Space>
          </div>
        </div>

        {/* 会员状态卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={24} md={8}>
            <Card>
              <Statistic
                title={
                  <Space>
                    <CrownOutlined />
                    <span>会员状态</span>
                  </Space>
                }
                value={membershipStatus?.isMember ? '会员用户' : '普通用户'}
                valueStyle={{
                  color: membershipStatus?.isMember ? '#faad14' : '#999',
                  fontSize: '20px',
                }}
                prefix={membershipStatus?.isMember && <Badge status="success" />}
              />
              {!membershipStatus?.isMember && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{ marginTop: '16px' }}
                  onClick={() => router.push('/membership')}
                  block
                >
                  立即开通会员
                </Button>
              )}
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title={
                  <Space>
                    <ThunderboltOutlined />
                    <span>剩余次数</span>
                  </Space>
                }
                value={membershipStatus?.quotaRemaining || 0}
                suffix="次"
                valueStyle={{
                  color:
                    (membershipStatus?.quotaRemaining || 0) > 10 ? '#3f8600' : '#cf1322',
                }}
              />
              {membershipStatus?.isMember && (membershipStatus?.quotaRemaining || 0) < 10 && (
                <Text
                  type="warning"
                  style={{ fontSize: '12px', marginTop: '8px', display: 'block' }}
                >
                  配额即将用完,建议及时续费
                </Text>
              )}
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Card>
              <Statistic
                title={
                  <Space>
                    <ClockCircleOutlined />
                    <span>到期时间</span>
                  </Space>
                }
                value={membershipStatus?.isMember ? getRemainingDays() : 0}
                suffix="天"
                valueStyle={{
                  color: getRemainingDays() > 7 ? '#3f8600' : '#cf1322',
                }}
              />
              <Text
                type="secondary"
                style={{ fontSize: '12px', marginTop: '8px', display: 'block' }}
              >
                {formatExpireDate()}
              </Text>
            </Card>
          </Col>
        </Row>

        {/* 分销中心入口 */}
        <div
          onClick={() => router.push('/distribution/dashboard')}
          style={{
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            border: '2px solid #FCD34D',
            borderRadius: '16px',
            padding: '24px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(135deg, #FDE68A 0%, #FCD34D 100%)';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <Title
                level={3}
                style={{ margin: 0, marginBottom: '8px', color: '#92400E', fontWeight: 600 }}
              >
                💰 分销中心
              </Title>
              <Text style={{ color: '#78350F', fontSize: '14px' }}>
                成为分销员，推广赚佣金 · 每推荐1位用户购买会员，赚取15%佣金
              </Text>
            </div>
            <Button
              type="primary"
              size="large"
              style={{
                background: '#92400E',
                border: 'none',
                fontWeight: 600,
                borderRadius: '24px',
              }}
            >
              立即进入
            </Button>
          </div>
        </div>

        {/* 艹！使用新的 FeatureGrid 组件！自动分组、自动渲染！ */}
        <Card title="功能中心" style={{ marginBottom: '24px' }}>
          <FeatureGrid
            features={features}
            groupByCategory={true}
            columns={4}
            gutter={[16, 16]}
            emptyText="暂无可用功能"
          />
        </Card>

        {/* 会员说明 */}
        {!membershipStatus?.isMember && (
          <Card title="会员权益说明">
            <Paragraph>
              <Text strong>单月会员 ¥99/月:</Text>
            </Paragraph>
            <ul>
              <li>100次AI处理配额(基础修图 + AI模特上身)</li>
              <li>无限次数查看和下载历史记录</li>
              <li>优先处理队列,更快出图</li>
              <li>专属客服支持</li>
            </ul>
            <Divider />
            <Button
              type="primary"
              size="large"
              icon={<CrownOutlined />}
              onClick={() => router.push('/membership')}
            >
              立即开通会员 ¥99/月
            </Button>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
}
