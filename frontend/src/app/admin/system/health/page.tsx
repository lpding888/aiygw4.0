'use client';

import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, Table, Tag, Space, message, Tabs, Descriptions, Badge } from 'antd';
import {
    ReloadOutlined,
    ThunderboltOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    DashboardOutlined,
    DatabaseOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';

export default function SystemHealthPage() {
    const [loading, setLoading] = useState(false);
    const [cacheStats, setCacheStats] = useState<any>(null);
    const [breakerHealth, setBreakerHealth] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('cache');

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Cache Stats
            const cacheRes = await api.system.cache.getStats();
            if (cacheRes.success) {
                setCacheStats(cacheRes.data);
            }

            // Fetch Circuit Breaker Health
            const breakerRes = await api.system.circuitBreaker.getHealth();
            if (breakerRes.success) {
                setBreakerHealth(breakerRes.data);
            }
        } catch (error) {
            message.error('获取系统状态失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleClearCache = async () => {
        try {
            // Clear all cache ("*" pattern)
            await api.system.cache.batchDelete('*');
            message.success('缓存清理指令已发送 (清理所有)');
            fetchData();
        } catch (e) {
            message.error('清理失败');
        }
    };

    const handleResetBreaker = async (name: string) => {
        try {
            await api.system.circuitBreaker.operate(name, 'reset');
            message.success(`熔断器 ${name} 重置指令已发送`);
            fetchData();
        } catch (e) {
            message.error('重置失败');
        }
    };

    // Cache Tab Content
    const renderCacheStats = () => {
        if (!cacheStats) return null;
        const { cache, subscriber } = cacheStats;

        // Convert memory stats to readable
        const memSize = (cache?.memoryCacheSize || 0);

        return (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Row gutter={16}>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="命中率"
                                value={cache?.hitRate || 0}
                                precision={2}
                                suffix="%"
                                valueStyle={{ color: '#3f8600' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="内存命中率"
                                value={cache?.memoryHitRate || 0}
                                precision={2}
                                suffix="%"
                                valueStyle={{ color: '#1890ff' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="内存缓存对象数"
                                value={memSize}
                                prefix={<DatabaseOutlined />}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="运行时间"
                                value={Math.floor((cache?.uptime || 0) / 3600)}
                                suffix="小时"
                            />
                        </Card>
                    </Col>
                </Row>

                <Card title="订阅服务状态 (Redis)" extra={<Tag color={subscriber?.connected ? 'green' : 'red'}>{subscriber?.connected ? '已连接' : '断开'}</Tag>}>
                    <Descriptions bordered>
                        <Descriptions.Item label="Channel">{subscriber?.channel || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Last Event">{subscriber?.lastEvent || 'None'}</Descriptions.Item>
                        <Descriptions.Item label="Message Count">{subscriber?.messageCount || 0}</Descriptions.Item>
                    </Descriptions>
                </Card>

                <Card title="操作">
                    <Button danger icon={<DeleteOutlined />} onClick={handleClearCache}>清理所有缓存</Button>
                </Card>
            </Space>
        );
    };

    // Breaker Tab Content
    const renderBreakerStats = () => {
        if (!breakerHealth) return null;

        // Typically backend returns an object map or list. Let's assume list or convert.
        // Based on `circuitBreaker.routes.ts` -> `getHealth`.
        // Let's assume structure based on typical circuit breaker response.
        // If it's a map: { "serviceA": { state: "Closed", ... } }

        // For safety, let's just dump raw for now or try to iterate if it's an object
        const breakers = Object.entries(breakerHealth).map(([name, status]: [string, any]) => ({
            name,
            ...status
        }));

        const columns = [
            { title: '服务名称', dataIndex: 'name', key: 'name' },
            {
                title: '状态',
                dataIndex: 'state',
                key: 'state',
                render: (state: string) => {
                    const color = state === 'Closed' ? 'green' : state === 'Open' ? 'red' : 'orange';
                    return <Tag color={color}>{state}</Tag>;
                }
            },
            { title: '失败率', dataIndex: 'failureRate', key: 'failureRate', render: (v: number) => `${(v * 100).toFixed(1)}%` },
            {
                title: '操作',
                key: 'action',
                render: (_: any, record: any) => (
                    <Button size="small" onClick={() => handleResetBreaker(record.name)}>重置</Button>
                )
            }
        ];

        return (
            <Card title="熔断器监控">
                <Table dataSource={breakers} columns={columns} rowKey="name" pagination={false} />
            </Card>
        );
    };

    return (
        <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: 24, margin: 0 }}>系统健康看板</h1>
                <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
            </div>

            <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
                <Tabs.TabPane tab="缓存监控" key="cache">
                    {renderCacheStats()}
                </Tabs.TabPane>
                <Tabs.TabPane tab="服务熔断" key="breaker">
                    {renderBreakerStats()}
                </Tabs.TabPane>
            </Tabs>
        </div>
    );
}
