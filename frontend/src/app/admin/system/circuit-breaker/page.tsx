'use client';

import { useState, useEffect } from 'react';
import {
    Card,
    Table,
    Button,
    Tag,
    Space,
    Typography,
    message,
    Statistic,
    Row,
    Col,
    Alert,
    Popconfirm,
} from 'antd';
import {
    ThunderboltOutlined,
    ReloadOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    WarningOutlined,
    PoweroffOutlined,
} from '@ant-design/icons';
import axios from '@/lib/api';

const { Title, Text } = Typography;

interface CircuitBreakerState {
    name: string;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
    lastFailure?: string;
    consecutiveFailures: number;
}

interface CircuitBreakerStats {
    total: number;
    open: number;
    closed: number;
    halfOpen: number;
}

export default function CircuitBreakerPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<CircuitBreakerState[]>([]);
    const [stats, setStats] = useState<CircuitBreakerStats>({ total: 0, open: 0, closed: 0, halfOpen: 0 });
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get('/api/circuit-breaker/circuit-breakers');
            const list = Array.isArray(response.data.data) ? response.data.data : [];
            setData(list);

            const newStats = {
                total: list.length,
                open: list.filter((i: CircuitBreakerState) => i.state === 'OPEN').length,
                closed: list.filter((i: CircuitBreakerState) => i.state === 'CLOSED').length,
                halfOpen: list.filter((i: CircuitBreakerState) => i.state === 'HALF_OPEN').length,
            };
            setStats(newStats);

        } catch (err: any) {
            console.error('Fetch error:', err);
            message.error('获取熔断器状态失败');
            setError(err.message || '未知错误');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (name: string, action: 'open' | 'close' | 'reset' | 'half-open') => {
        try {
            await axios.post(`/api/circuit-breaker/circuit-breakers/${name}/${action}`);
            message.success(`操作成功: ${action}`);
            fetchData();
        } catch (err: any) {
            console.error('Action error:', err);
            message.error(`操作失败: ${err.message || '未知错误'}`);
        }
    };

    const getStatusColor = (state: string) => {
        switch (state) {
            case 'CLOSED': return 'green';
            case 'OPEN': return 'red';
            case 'HALF_OPEN': return 'orange';
            default: return 'default';
        }
    };

    const getStatusText = (state: string) => {
        switch (state) {
            case 'CLOSED': return '正常 (Closed)';
            case 'OPEN': return '熔断中 (Open)';
            case 'HALF_OPEN': return '尝试恢复 (Half-Open)';
            default: return state;
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto animate-fade-up">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gradient mb-2">服务熔断监控</h1>
                    <p className="text-gray-500">实时监控所有外部服务的健康状态，保障系统稳定性。</p>
                </div>
                <Button
                    size="large"
                    className="rounded-full shadow-md"
                    icon={<ReloadOutlined />}
                    onClick={fetchData}
                    loading={loading}
                >
                    刷新状态
                </Button>
            </div>

            {error && (
                <Alert
                    message="获取熔断状态失败"
                    description={error}
                    type="error"
                    showIcon
                    className="mb-8 rounded-xl border-red-100 bg-red-50/50"
                />
            )}

            {/* Bento Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="glass-card-strong p-6 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                    <div className="text-gray-500 text-sm font-medium mb-2">监控服务总数</div>
                    <div className="text-4xl font-bold text-gray-800">{stats.total}</div>
                </div>
                <div className="glass-card-strong p-6 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all"></div>
                    <div className="text-gray-500 text-sm font-medium mb-2">正常运行</div>
                    <div className="text-4xl font-bold text-green-600 flex items-center gap-2">
                        {stats.closed}
                        <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                    </div>
                </div>
                <div className="glass-card-strong p-6 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all"></div>
                    <div className="text-gray-500 text-sm font-medium mb-2">已熔断 (Open)</div>
                    <div className="text-4xl font-bold text-red-600">{stats.open}</div>
                </div>
                <div className="glass-card-strong p-6 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-orange-500/10 rounded-full blur-3xl group-hover:bg-orange-500/20 transition-all"></div>
                    <div className="text-gray-500 text-sm font-medium mb-2">尝试恢复 (Half-Open)</div>
                    <div className="text-4xl font-bold text-orange-500">{stats.halfOpen}</div>
                </div>
            </div>

            <div className="glass-card-strong p-6">
                <div className="mb-4 text-lg font-semibold text-gray-800">服务状态详情</div>
                <Table
                    dataSource={data}
                    rowKey="name"
                    loading={loading}
                    pagination={false}
                    className="bg-transparent"
                    columns={[
                        {
                            title: '服务名称',
                            dataIndex: 'name',
                            key: 'name',
                            render: (text) => <span className="font-medium text-base">{text}</span>
                        },
                        {
                            title: '当前状态',
                            dataIndex: 'state',
                            key: 'state',
                            render: (state: string) => (
                                <Tag color={getStatusColor(state)} className="px-3 py-1 text-sm rounded-full border-0">
                                    {getStatusText(state)}
                                </Tag>
                            )
                        },
                        {
                            title: '失败次数',
                            dataIndex: 'failures',
                            key: 'failures',
                            render: (count) => <span className="font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">{count}</span>
                        },
                        {
                            title: '最后失败时间',
                            dataIndex: 'lastFailure',
                            key: 'lastFailure',
                            render: (ts: string) => ts ? <span className="text-gray-500 text-sm">{new Date(ts).toLocaleString()}</span> : '-'
                        },
                        {
                            title: '操作',
                            key: 'action',
                            render: (_, record) => (
                                <Space>
                                    {record.state === 'CLOSED' && (
                                        <Popconfirm title="确定要强制熔断吗？" onConfirm={() => handleAction(record.name, 'open')}>
                                            <Button size="small" danger>
                                                手动熔断
                                            </Button>
                                        </Popconfirm>
                                    )}
                                    {record.state === 'OPEN' && (
                                        <Popconfirm title="确定要尝试恢复吗？" onConfirm={() => handleAction(record.name, 'half-open')}>
                                            <Button size="small" type="primary">
                                                尝试恢复
                                            </Button>
                                        </Popconfirm>
                                    )}
                                    <Popconfirm title="确定要重置熔断器吗？" onConfirm={() => handleAction(record.name, 'reset')}>
                                        <Button size="small">
                                            重置
                                        </Button>
                                    </Popconfirm>
                                </Space>
                            )
                        }
                    ]}
                />
            </div>
        </div>
    );
}
