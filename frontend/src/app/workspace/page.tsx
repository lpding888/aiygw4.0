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
  Empty
} from 'antd';
import {
  CrownOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { MembershipStatus, Feature } from '@/types';
import FeatureCard from '@/components/FeatureCard';

const { Title, Text, Paragraph } = Typography;

export default function WorkspacePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [loading, setLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(true);

  // 获取会员状态
  const fetchMembershipStatus = async () => {
    try {
      setLoading(true);
      const response: any = await api.membership.status();

      if (response.success && response.data) {
        setMembershipStatus(response.data);
        // 同步更新用户信息
        if (user) {
          setUser({
            ...user,
            isMember: response.data.isMember,
            quota_remaining: response.data.quotaRemaining || response.data.quota_remaining,
            quota_expireAt: response.data.quotaExpireAt || response.data.quota_expireAt
          });
        }
      }
    } catch (error: any) {
      message.error('获取会员状态失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取功能卡片列表（艹，必须调用动态接口！）
  const fetchFeatures = async () => {
    try {
      setFeaturesLoading(true);
      const response: any = await api.features.getAll({ enabled: true });

      if (response.success && response.features) {
        setFeatures(response.features);
      }
    } catch (error: any) {
      message.error('获取功能列表失败');
      console.error('获取功能列表失败:', error);
    } finally {
      setFeaturesLoading(false);
    }
  };

  useEffect(() => {
    // 检查登录状态
    if (!user) {
      router.push('/login');
      return;
    }

    fetchMembershipStatus();
    fetchFeatures(); // 艹，同时获取功能列表
  }, [user, router]);

  // 计算剩余天数
  const getRemainingDays = () => {
    const expireAt = (membershipStatus as any)?.quotaExpireAt || (membershipStatus as any)?.quota_expireAt;
    if (!expireAt) return 0;
    const expireDate = new Date(expireAt);
    const now = new Date();
    const diff = expireDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // 格式化到期时间
  const formatExpireDate = () => {
    const expireAt = (membershipStatus as any)?.quotaExpireAt || (membershipStatus as any)?.quota_expireAt;
    if (!expireAt) return '-';
    const date = new Date(expireAt);
    return date.toLocaleDateString('zh-CN');
  };

  // 按 category 分组功能卡片
  const groupFeaturesByCategory = () => {
    const grouped: Record<string, Feature[]> = {};
    features.forEach((feature) => {
      if (!grouped[feature.category]) {
        grouped[feature.category] = [];
      }
      grouped[feature.category].push(feature);
    });
    return grouped;
  };

  // 判断功能是否禁用（套餐不满足）
  const isFeatureDisabled = (feature: Feature): boolean => {
    // 如果不是会员，所有需要会员的功能都禁用
    if (!membershipStatus?.isMember && feature.plan_required !== 'free') {
      return true;
    }
    // 配额不足也禁用
    if ((membershipStatus?.quotaRemaining || 0) < feature.quota_cost) {
      return true;
    }
    return false;
  };

  // 处理升级会员
  const handleUpgrade = () => {
    router.push('/membership');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  const groupedFeatures = groupFeaturesByCategory();

  return (
    <div style={{ 
      padding: '24px', 
      minHeight: '100vh',
      background: '#f0f2f5'
    }}>
      {/* 顶部导航 */}
      <div style={{ 
        background: '#fff', 
        padding: '16px 24px',
        marginBottom: '24px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <Title level={3} style={{ margin: 0 }}>
            AI服装处理平台
          </Title>
          <Space>
            <Text>
              欢迎, <strong>{user?.phone}</strong>
            </Text>
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
                fontSize: '20px'
              }}
              prefix={
                membershipStatus?.isMember && (
                  <Badge status="success" />
                )
              }
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
                color: (membershipStatus?.quotaRemaining || 0) > 10 ? '#3f8600' : '#cf1322' 
              }}
            />
            {membershipStatus?.isMember && (membershipStatus?.quotaRemaining || 0) < 10 && (
              <Text type="warning" style={{ fontSize: '12px', marginTop: '8px', display: 'block' }}>
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
                color: getRemainingDays() > 7 ? '#3f8600' : '#cf1322' 
              }}
            />
            <Text type="secondary" style={{ fontSize: '12px', marginTop: '8px', display: 'block' }}>
              {formatExpireDate()}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 功能区域 - 动态渲染功能卡片（艹，不再硬编码！）*/}
      {featuresLoading ? (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" tip="加载功能列表..." />
          </div>
        </Card>
      ) : features.length === 0 ? (
        <Card style={{ marginBottom: '24px' }}>
          <Empty description="暂无可用功能" />
        </Card>
      ) : (
        Object.keys(groupedFeatures).map((category) => (
          <Card
            key={category}
            title={category}
            style={{ marginBottom: '24px' }}
          >
            <Row gutter={[16, 16]}>
              {groupedFeatures[category].map((feature) => (
                <Col key={feature.feature_id} xs={24} sm={12} lg={12} xl={6}>
                  <FeatureCard
                    feature={feature}
                    disabled={isFeatureDisabled(feature)}
                    onUpgrade={handleUpgrade}
                  />
                </Col>
              ))}
            </Row>
          </Card>
        ))
      )}

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
  );
}
