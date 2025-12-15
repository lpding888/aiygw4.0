'use client';

import { useState, useEffect } from 'react';
import {
    Card,
    Button,
    Statistic,
    Row,
    Col,
    Space,
    Input,
    message,
    Typography,
    Divider,
    Descriptions,
    Modal,
    Form,
} from 'antd';
import {
    HddOutlined,
    ReloadOutlined,
    DeleteOutlined,
    ClearOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';
import axios from '@/lib/api';

const { Title, Text } = Typography;

interface CacheStats {
    hits: number;
    misses: number;
    keys: number;
    ksize: number;
    vsize: number;
    memory_usage?: number;
}

export default function CachePage() {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<CacheStats | null>(null);
    const [form] = Form.useForm();

    const fetchStats = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/cache/stats');
            // Adjust based on actual API response structure
            // Verified route returns { success: true, data: { cache: stats, ... } }
            setStats(response.data.data?.cache || response.data.data);
        } catch (error) {
            console.error('Fetch error:', error);
            message.error('获取缓存统计失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleClearAll = () => {
        Modal.confirm({
            title: '确认清空所有缓存？',
            content: '此操作将清除系统中的所有缓存数据，可能导致短期内数据库负载升高。',
            okType: 'danger',
            onOk: async () => {
                try {
                    // Usually "flushall" or similar, but route says "delete by pattern"
                    // Let's use delete pattern '*'
                    await axios.delete('/api/cache/batch', { data: { pattern: '*' } });
                    message.success('缓存已清空');
                    fetchStats();
                } catch (error) {
                    message.error('清空失败');
                }
            },
        });
    };

    const handleDeletePattern = async (values: any) => {
        try {
            await axios.delete('/api/cache/batch', { data: { pattern: values.pattern } });
            message.success(`已删除匹配模式 ${values.pattern} 的缓存`);
            form.resetFields();
            fetchStats();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const hitRate = stats ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(1) : 0;

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto animate-fade-up">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gradient mb-2">缓存监控与管理</h1>
                    <p className="text-gray-500">实时监控系统缓存性能，清理无效数据。</p>
                </div>
                <Button
                    size="large"
                    className="rounded-full shadow-md"
                    icon={<ReloadOutlined />}
                    onClick={fetchStats}
                    loading={loading}
                >
                    刷新状态
                </Button>
            </div>

            {/* Bento Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="glass-card-strong p-6 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all"></div>
                    <div className="text-gray-500 text-sm font-medium mb-2">缓存命中率</div>
                    <div className="text-4xl font-bold text-gray-800 flex items-baseline gap-2">
                        {hitRate}%
                        <span className="text-sm text-gray-400 font-normal">Target: &gt;80%</span>
                    </div>
                </div>
                <div className="glass-card-strong p-6 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                    <div className="text-gray-500 text-sm font-medium mb-2">当前键数量 (Keys)</div>
                    <div className="text-4xl font-bold text-gray-800">{stats?.keys ?? '-'}</div>
                </div>
                <div className="glass-card-strong p-6 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all"></div>
                    <div className="text-gray-500 text-sm font-medium mb-2">缓存命中 (Hits)</div>
                    <div className="text-4xl font-bold text-green-600">{stats?.hits ?? '-'}</div>
                </div>
                <div className="glass-card-strong p-6 relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all"></div>
                    <div className="text-gray-500 text-sm font-medium mb-2">缓存未命中 (Misses)</div>
                    <div className="text-4xl font-bold text-red-500">{stats?.misses ?? '-'}</div>
                </div>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                    <div className="glass-card-strong p-6 h-full">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <ThunderboltOutlined className="text-blue-500" />
                            内存使用详情
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                <span className="text-gray-500">键空间 (Key Size)</span>
                                <span className="font-mono font-medium">{stats?.ksize ?? 0} bytes</span>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                <span className="text-gray-500">值空间 (Value Size)</span>
                                <span className="font-mono font-medium">{stats?.vsize ?? 0} bytes</span>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <span className="text-gray-700 font-medium">总内存占用估算</span>
                                <span className="font-mono text-lg font-bold text-blue-600">
                                    {stats?.memory_usage ? (stats.memory_usage / 1024 / 1024).toFixed(2) + ' MB' : '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                </Col>
                <Col xs={24} md={12}>
                    <div className="glass-card-strong p-6 h-full flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                                <DeleteOutlined className="text-red-500" />
                                缓存管理
                            </h3>

                            <Form layout="vertical" form={form} onFinish={handleDeletePattern}>
                                <Form.Item name="pattern" label="按模式清理 (支持通配符)" rules={[{ required: true, message: '请输入模式' }]}>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="例如: sess:*"
                                            size="large"
                                            className="rounded-xl"
                                            prefix={<span className="text-gray-400">KEY:</span>}
                                        />
                                        <Button type="primary" htmlType="submit" size="large" icon={<DeleteOutlined />}>
                                            清理
                                        </Button>
                                    </div>
                                </Form.Item>
                            </Form>
                        </div>

                        <div className="mt-8 p-6 bg-red-50 rounded-2xl border border-red-100">
                            <h4 className="font-medium text-red-800 mb-2">危险区域</h4>
                            <p className="text-sm text-red-600 mb-4">清空所有缓存将导致系统重新加载大量数据，请谨慎操作。</p>
                            <Button type="primary" danger size="large" icon={<ClearOutlined />} onClick={handleClearAll} block className="h-12 rounded-xl">
                                清空所有缓存 (Flush All)
                            </Button>
                        </div>
                    </div>
                </Col>
            </Row>
        </div>
    );
}
