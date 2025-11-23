/**
 * Dashboard Page
 * Visionary Theme: Bento Grid & Micro-interactions
 */

'use client';

import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, List, Tag, Spin, Button, Typography, Space } from 'antd';
import {
    UserOutlined,
    ShoppingOutlined,
    RiseOutlined,
    FallOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    RocketOutlined,
    FormOutlined,
    ApartmentOutlined,
    ArrowRightOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

// 模拟数据（如果后端没准备好）
const MOCK_STATS = {
    totalUsers: 1258,
    activeUsers: 342,
    totalRevenue: 45800,
    todayRevenue: 1200,
    totalTasks: 8900,
    successRate: 98.5,
};

const MOCK_ACTIVITIES = [
    { user: 'User_9527', action: '创建了新任务', time: '2分钟前', status: 'success' },
    { user: 'User_8848', action: '充值了会员', time: '5分钟前', status: 'success' },
    { user: 'User_1001', action: '任务执行失败', time: '12分钟前', status: 'error' },
    { user: 'User_2024', action: '申请提现', time: '30分钟前', status: 'warning' },
    { user: 'User_3344', action: '登录系统', time: '1小时前', status: 'success' },
];

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(MOCK_STATS);
    const [activities, setActivities] = useState<any[]>(MOCK_ACTIVITIES);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            // 尝试调用后端API，如果失败则使用Mock数据
            const response: any = await api.admin.getOverview();
            if (response.data.success && response.data.data) {
                // 映射后端数据结构到前端状态
                setStats({
                    totalUsers: response.data.data.userStats?.totalUsers || 0,
                    activeUsers: response.data.data.userStats?.activeMembers || 0,
                    totalRevenue: response.data.data.orderStats?.revenue || 0,
                    todayRevenue: 0, // 后端暂未返回今日收入，先置0
                    totalTasks: response.data.data.taskStats?.totalTasks || 0,
                    successRate: parseFloat(response.data.data.taskStats?.successRate || '0'),
                });
                // setActivities(response.data.data.activities || MOCK_ACTIVITIES); // 后端暂未返回活动列表
            }
        } catch (error) {
            console.warn('Dashboard API调用失败，使用Mock数据', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <Spin size="large" tip="正在加载仪表盘数据..." />
            </div>
        );
    }

    return (
        <div className="animate-fade-up">
            <div style={{ marginBottom: 32 }}>
                <Title level={2} style={{ marginBottom: 8, letterSpacing: '-0.02em' }}>系统概览</Title>
                <Text type="secondary">欢迎回来，这里是您的AI SaaS平台运营中心。</Text>
            </div>

            {/* 核心指标卡片 - Bento Grid */}
            <Row gutter={[24, 24]}>
                <Col xs={24} sm={12} md={6}>
                    <div className="bento-card" style={{ padding: 24, height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                background: 'rgba(63, 134, 0, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#3f8600',
                                fontSize: 24
                            }}>
                                <UserOutlined />
                            </div>
                            <Tag color="success" style={{ margin: 0, borderRadius: 12 }}>
                                <RiseOutlined /> +12%
                            </Tag>
                        </div>
                        <Statistic
                            title={<span style={{ color: '#86868B' }}>总用户数</span>}
                            value={stats.totalUsers}
                            valueStyle={{ fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em' }}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <div className="bento-card" style={{ padding: 24, height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                background: 'rgba(207, 19, 34, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#cf1322',
                                fontSize: 24
                            }}>
                                <ShoppingOutlined />
                            </div>
                            <Tag color="red" style={{ margin: 0, borderRadius: 12 }}>
                                +{stats.todayRevenue} 今日
                            </Tag>
                        </div>
                        <Statistic
                            title={<span style={{ color: '#86868B' }}>总收入 (CNY)</span>}
                            value={stats.totalRevenue}
                            precision={2}
                            valueStyle={{ fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em' }}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <div className="bento-card" style={{ padding: 24, height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                background: 'rgba(24, 144, 255, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#1890ff',
                                fontSize: 24
                            }}>
                                <ClockCircleOutlined />
                            </div>
                            <Tag color="blue" style={{ margin: 0, borderRadius: 12 }}>
                                {stats.activeUsers} 活跃
                            </Tag>
                        </div>
                        <Statistic
                            title={<span style={{ color: '#86868B' }}>总任务数</span>}
                            value={stats.totalTasks}
                            valueStyle={{ fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em' }}
                        />
                    </div>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <div className="bento-card" style={{ padding: 24, height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                background: 'rgba(82, 196, 26, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#52c41a',
                                fontSize: 24
                            }}>
                                <CheckCircleOutlined />
                            </div>
                            <Tag color="orange" style={{ margin: 0, borderRadius: 12 }}>
                                <FallOutlined /> {(100 - stats.successRate).toFixed(1)}% 失败
                            </Tag>
                        </div>
                        <Statistic
                            title={<span style={{ color: '#86868B' }}>任务成功率</span>}
                            value={stats.successRate}
                            suffix="%"
                            valueStyle={{ fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em' }}
                        />
                    </div>
                </Col>
            </Row>

            {/* 快速开始 */}
            <div style={{ marginTop: 32 }}>
                <Title level={4} style={{ marginBottom: 16 }}>快速操作</Title>
                <Row gutter={[24, 24]}>
                    <Col xs={24} sm={12} md={6}>
                        <div
                            className="bento-card hover:shadow-lg cursor-pointer"
                            style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.3s' }}
                            onClick={() => router.push('/admin/features/new')}
                        >
                            <div style={{
                                width: 56, height: 56, borderRadius: 16,
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: 24, boxShadow: '0 8px 16px rgba(118, 75, 162, 0.2)'
                            }}>
                                <RocketOutlined />
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 16 }}>新建 AI 应用</div>
                                <div style={{ fontSize: 13, color: '#86868B' }}>创建新的功能模块</div>
                            </div>
                        </div>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <div
                            className="bento-card hover:shadow-lg cursor-pointer"
                            style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.3s' }}
                            onClick={() => window.open('/admin/forms/builder', '_blank')}
                        >
                            <div style={{
                                width: 56, height: 56, borderRadius: 16,
                                background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: 24, boxShadow: '0 8px 16px rgba(255, 154, 158, 0.2)'
                            }}>
                                <FormOutlined />
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 16 }}>设计表单</div>
                                <div style={{ fontSize: 13, color: '#86868B' }}>可视化表单设计器</div>
                            </div>
                        </div>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <div
                            className="bento-card hover:shadow-lg cursor-pointer"
                            style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.3s' }}
                            onClick={() => router.push('/admin/pipelines/editor')}
                        >
                            <div style={{
                                width: 56, height: 56, borderRadius: 16,
                                background: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: 24, boxShadow: '0 8px 16px rgba(132, 250, 176, 0.2)'
                            }}>
                                <ApartmentOutlined />
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 16 }}>编排流程</div>
                                <div style={{ fontSize: 13, color: '#86868B' }}>Pipeline可视化编辑</div>
                            </div>
                        </div>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <div
                            className="bento-card hover:shadow-lg cursor-pointer"
                            style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.3s' }}
                            onClick={() => router.push('/admin/users')}
                        >
                            <div style={{
                                width: 56, height: 56, borderRadius: 16,
                                background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: 24, boxShadow: '0 8px 16px rgba(161, 140, 209, 0.2)'
                            }}>
                                <UserOutlined />
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 16 }}>用户管理</div>
                                <div style={{ fontSize: 13, color: '#86868B' }}>查看与管理用户</div>
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>

            <Row gutter={[24, 24]} style={{ marginTop: 32 }}>
                {/* 左侧：图表区域 (占位) */}
                <Col xs={24} lg={16}>
                    <div className="bento-card" style={{ padding: 24, height: '100%', minHeight: 400 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <Title level={4} style={{ margin: 0 }}>增长趋势</Title>
                            <Space>
                                <Tag color="blue" style={{ borderRadius: 12, cursor: 'pointer' }}>近7天</Tag>
                                <Tag style={{ borderRadius: 12, cursor: 'pointer', border: 'none', background: '#F5F5F7' }}>近30天</Tag>
                            </Space>
                        </div>
                        <div style={{
                            height: '300px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#F5F5F7',
                            borderRadius: 20,
                            color: '#86868B',
                            border: '1px dashed #E0E0E0'
                        }}>
                            图表组件加载中... (ECharts/Recharts)
                        </div>
                    </div>
                </Col>

                {/* 右侧：最近活动 */}
                <Col xs={24} lg={8}>
                    <div className="bento-card" style={{ padding: 24, height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <Title level={4} style={{ margin: 0 }}>最近活动</Title>
                            <Button type="link" size="small" style={{ color: '#86868B' }}>查看全部</Button>
                        </div>
                        <List
                            itemLayout="horizontal"
                            dataSource={activities}
                            split={false}
                            renderItem={(item: any) => (
                                <List.Item style={{ padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                                    <List.Item.Meta
                                        avatar={
                                            <div style={{
                                                width: 40, height: 40, borderRadius: 12,
                                                background: item.status === 'success' ? 'rgba(82, 196, 26, 0.1)' :
                                                    item.status === 'error' ? 'rgba(255, 77, 79, 0.1)' : 'rgba(250, 173, 20, 0.1)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: item.status === 'success' ? '#52c41a' :
                                                    item.status === 'error' ? '#ff4d4f' : '#faad14'
                                            }}>
                                                {item.status === 'success' ? <CheckCircleOutlined /> :
                                                    item.status === 'error' ? <CloseCircleOutlined /> : <ClockCircleOutlined />}
                                            </div>
                                        }
                                        title={<span style={{ fontWeight: 500 }}>{item.user}</span>}
                                        description={
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: 13 }}>{item.action}</span>
                                                <span style={{ fontSize: 12, color: '#ccc' }}>{item.time}</span>
                                            </div>
                                        }
                                    />
                                </List.Item>
                            )}
                        />
                    </div>
                </Col>
            </Row>
        </div>
    );
}
