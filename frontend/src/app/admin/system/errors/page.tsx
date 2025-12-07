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
    Tooltip,
} from 'antd';
import {
    BugOutlined,
    ReloadOutlined,
    DownloadOutlined,
    DeleteOutlined,
} from '@ant-design/icons';
import axios from '@/lib/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function ErrorLogsPage() {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/admin/errors/stats');
            // Structure based on verified route: { success: true, data: stats }
            setStats(response.data.data);
        } catch (error) {
            console.error('Fetch error:', error);
            message.error('获取错误统计失败');
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleExport = () => {
        // Direct download link
        window.open(process.env.NEXT_PUBLIC_API_URL + '/admin/errors/export', '_blank');
    };

    const handleReset = async () => {
        try {
            await axios.post('/api/admin/errors/reset-stats');
            message.success('错误统计已重置');
            fetchData();
        } catch (error) {
            message.error('重置失败');
        }
    };

    const columns = [
        {
            title: '错误码',
            dataIndex: 'code',
            key: 'code',
            render: (code: number) => <Tag color="volcano">{code}</Tag>,
        },
        {
            title: '分类',
            dataIndex: 'category',
            key: 'category',
        },
        {
            title: '严重程度',
            dataIndex: 'severity',
            key: 'severity',
            render: (severity: string) => {
                const color = severity === 'critical' ? 'red' : severity === 'high' ? 'orange' : 'blue';
                return <Tag color={color}>{severity}</Tag>;
            }
        },
        {
            title: '出现次数',
            dataIndex: 'count',
            key: 'count',
            render: (count: number) => <b>{count}</b>,
            sorter: (a: any, b: any) => a.count - b.count,
        },
        {
            title: '最近发生时间',
            dataIndex: 'lastOccurrence',
            key: 'lastOccurrence',
            render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
        },
    ];

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto animate-fade-up">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gradient mb-2">系统错误追踪</h1>
                    <p className="text-gray-500">实时监控和分析系统异常，快速定位问题。</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        size="large"
                        icon={<DownloadOutlined />}
                        onClick={handleExport}
                        className="rounded-full"
                    >
                        导出报告
                    </Button>
                    <Button
                        size="large"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={handleReset}
                        className="rounded-full"
                    >
                        重置统计
                    </Button>
                    <Button
                        size="large"
                        type="primary"
                        shape="circle"
                        icon={<ReloadOutlined spin={loading} />}
                        onClick={fetchData}
                    />
                </div>
            </div>

            {/* Bento Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="glass-card-strong p-6 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all"></div>
                    <div className="text-gray-500 text-sm font-medium mb-2">总错误数 (Total Errors)</div>
                    <div className="text-5xl font-bold text-gray-800 tracking-tight">{stats?.totalErrors ?? 0}</div>
                </div>
                <div className="glass-card-strong p-6 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-orange-500/10 rounded-full blur-3xl group-hover:bg-orange-500/20 transition-all"></div>
                    <div className="text-gray-500 text-sm font-medium mb-2">最近一小时 (Recent Errors)</div>
                    <div className="text-5xl font-bold text-red-500 tracking-tight flex items-center gap-3">
                        {stats?.recentErrors ?? 0}
                        {(stats?.recentErrors ?? 0) > 0 && (
                            <span className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="glass-card-strong p-6">
                <div className="mb-4 text-lg font-semibold text-gray-800">错误详情列表 (Top Errors)</div>
                <Table
                    columns={columns}
                    dataSource={stats?.topErrors || []}
                    rowKey="code"
                    loading={loading}
                    pagination={{ pageSize: 20 }}
                    className="bg-transparent"
                />
            </div>
        </div>
    );
}
