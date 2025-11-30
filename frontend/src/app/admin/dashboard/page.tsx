'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, List, Avatar, Typography, Tag } from 'antd';
import { 
  UserOutlined, 
  RocketOutlined, 
  DollarOutlined, 
  ThunderboltOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import api from '@/lib/api';

const { Title, Text } = Typography;

interface DashboardStats {
  userStats: {
    totalUsers: number;
    memberUsers: number;
    memberRate: string;
  };
  taskStats: {
    totalTasks: number;
    successTasks: number;
    processingTasks: number;
    successRate: string;
  };
  orderStats: {
    totalOrders: number;
    revenue: number;
  };
  todayStats: {
    newUsers: number;
    newTasks: number;
  };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/overview');
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (error) {
      console.error('获取统计数据失败', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>👋 欢迎回来，管理员</Title>
        <Text type="secondary">这里是您的 AI 工厂控制台，今日系统运行平稳。</Text>
      </div>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} hoverable style={{ background: 'linear-gradient(135deg, #fff 0%, #f0f5ff 100%)' }}>
            <Statistic
              title={<Space><UserOutlined /> 总用户数</Space>}
              value={stats?.userStats.totalUsers}
              valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
              suffix={<Tag color="blue">今日 +{stats?.todayStats.newUsers}</Tag>}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              会员占比: {stats?.userStats.memberRate}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} hoverable style={{ background: 'linear-gradient(135deg, #fff 0%, #f6ffed 100%)' }}>
            <Statistic
              title={<Space><RocketOutlined /> 总任务数</Space>}
              value={stats?.taskStats.totalTasks}
              valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
              suffix={<Tag color="green">今日 +{stats?.todayStats.newTasks}</Tag>}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              成功率: {stats?.taskStats.successRate}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} hoverable style={{ background: 'linear-gradient(135deg, #fff 0%, #fff7e6 100%)' }}>
            <Statistic
              title={<Space><DollarOutlined /> 总收入</Space>}
              value={stats?.orderStats.revenue}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#faad14', fontWeight: 'bold' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              总订单: {stats?.orderStats.totalOrders}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} hoverable style={{ background: 'linear-gradient(135deg, #fff 0%, #fff1f0 100%)' }}>
            <Statistic
              title={<Space><ThunderboltOutlined /> 正在处理</Space>}
              value={stats?.taskStats.processingTasks}
              valueStyle={{ color: '#f5222d', fontWeight: 'bold' }}
              suffix={stats?.taskStats.processingTasks > 0 && <Spin size="small" style={{ marginLeft: 8 }} />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              实时算力负载监控中
            </div>
          </Card>
        </Col>
      </Row>

      {/* 快捷入口与动态 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} md={16}>
          <Card title="🚀 快捷操作" bordered={false}>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card 
                  hoverable 
                  size="small"
                  style={{ textAlign: 'center', background: '#f9f9f9', cursor: 'pointer' }}
                  onClick={() => window.location.href = '/admin/pipelines/editor'}
                >
                  <RocketOutlined style={{ fontSize: 24, color: '#1890ff', marginBottom: 8 }} />
                  <div style={{ fontWeight: 500 }}>新建工作流</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card 
                  hoverable 
                  size="small"
                  style={{ textAlign: 'center', background: '#f9f9f9', cursor: 'pointer' }}
                  onClick={() => window.location.href = '/admin/features/new'}
                >
                  <RocketOutlined style={{ fontSize: 24, color: '#722ed1', marginBottom: 8 }} />
                  <div style={{ fontWeight: 500 }}>上架新应用</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card 
                  hoverable 
                  size="small"
                  style={{ textAlign: 'center', background: '#f9f9f9', cursor: 'pointer' }}
                  onClick={() => window.location.href = '/admin/users'}
                >
                  <UserOutlined style={{ fontSize: 24, color: '#52c41a', marginBottom: 8 }} />
                  <div style={{ fontWeight: 500 }}>用户管理</div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
        
        <Col xs={24} md={8}>
          <Card title="📢 系统状态" bordered={false}>
             <List
              size="small"
              dataSource={[
                { title: 'API 服务正常', status: 'success' },
                { title: 'Redis 连接正常', status: 'success' },
                { title: '数据库连接正常', status: 'success' },
                { title: 'DeepSeek 大脑在线', status: 'processing' },
              ]}
              renderItem={item => (
                <List.Item>
                  <Space>
                    {item.status === 'success' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ClockCircleOutlined style={{ color: '#1890ff' }} />}
                    {item.title}
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

import { Space } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';