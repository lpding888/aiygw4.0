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
  Spin
} from 'antd';
import {
  CrownOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const { Title, Text, Paragraph } = Typography;

interface MembershipStatus {
  isMember: boolean;
  quotaRemaining: number;
  quotaExpireAt: string | null;
  totalUsed: number;
}

export default function WorkspacePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  
  const [loading, setLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);

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
            quota_remaining: response.data.quotaRemaining,
            quota_expireAt: response.data.quotaExpireAt
          });
        }
      }
    } catch (error: any) {
      message.error('获取会员状态失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 检查登录状态
    if (!user) {
      router.push('/login');
      return;
    }
    
    fetchMembershipStatus();
  }, [user, router]);

  // 计算剩余天数
  const getRemainingDays = () => {
    if (!membershipStatus?.quotaExpireAt) return 0;
    const expireDate = new Date(membershipStatus.quotaExpireAt);
    const now = new Date();
    const diff = expireDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // 格式化到期时间
  const formatExpireDate = () => {
    if (!membershipStatus?.quotaExpireAt) return '-';
    const date = new Date(membershipStatus.quotaExpireAt);
    return date.toLocaleDateString('zh-CN');
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
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setUser(null);
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

      {/* 功能区域 */}
      <Card 
        title="AI处理功能"
        style={{ marginBottom: '24px' }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Card
              hoverable
              onClick={() => {
                if (!membershipStatus?.isMember) {
                  message.warning('请先开通会员');
                  return;
                }
                if ((membershipStatus?.quotaRemaining || 0) < 1) {
                  message.warning('配额不足,请先续费');
                  return;
                }
                router.push('/task/basic');
              }}
              style={{ textAlign: 'center', cursor: 'pointer' }}
            >
              <ThunderboltOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
              <Title level={4} style={{ marginTop: '16px' }}>基础修图</Title>
              <Paragraph type="secondary">
                商品抠图、白底处理、智能增强
                <br />
                <Text strong>消耗: 1次/张</Text>
              </Paragraph>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Card
              hoverable
              onClick={() => {
                if (!membershipStatus?.isMember) {
                  message.warning('请先开通会员');
                  return;
                }
                if ((membershipStatus?.quotaRemaining || 0) < 1) {
                  message.warning('配额不足,请先续费');
                  return;
                }
                router.push('/task/model');
              }}
              style={{ textAlign: 'center', cursor: 'pointer' }}
            >
              <CrownOutlined style={{ fontSize: '48px', color: '#faad14' }} />
              <Title level={4} style={{ marginTop: '16px' }}>AI模特上身</Title>
              <Paragraph type="secondary">
                12分镜场景、多种风格、专业模特
                <br />
                <Text strong>消耗: 1次/组</Text>
              </Paragraph>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Card
              hoverable
              onClick={() => router.push('/task/history')}
              style={{ textAlign: 'center', cursor: 'pointer' }}
            >
              <HistoryOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
              <Title level={4} style={{ marginTop: '16px' }}>历史记录</Title>
              <Paragraph type="secondary">
                查看所有处理记录和结果
                <br />
                <Text strong>累计使用: {membershipStatus?.totalUsed || 0}次</Text>
              </Paragraph>
            </Card>
          </Col>
        </Row>
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
  );
}
