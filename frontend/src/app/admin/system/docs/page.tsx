'use client';

import { useState, useEffect } from 'react';
import {
    Card,
    Button,
    Statistic,
    Row,
    Col,
    Space,
    message,
    Typography,
} from 'antd';
import {
    ReadOutlined,
    ReloadOutlined,
    LinkOutlined,
    CloudSyncOutlined,
} from '@ant-design/icons';
import axios from '@/lib/api';

const { Title, Text, Paragraph } = Typography;

export default function DocsPage() {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/docs/stats');
            setStats(response.data.data);
        } catch (error) {
            // Silent fail or non-blocking
            console.log('Docs stats fetch failed', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleRegenerate = async () => {
        try {
            await axios.post('/api/docs/regenerate');
            message.success('文档重新生成任务已提交');
            fetchStats();
        } catch (error) {
            message.error('请求失败');
        }
    };

    return (
        <div className="p-6">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>

                <Card
                    title={
                        <Space>
                            <ReadOutlined />
                            <span>API 文档中心</span>
                        </Space>
                    }
                    extra={
                        <Button icon={<ReloadOutlined />} onClick={fetchStats} loading={loading}>
                            刷新状态
                        </Button>
                    }
                >
                    <div className="text-center mb-8">
                        <Title level={2}>后端 API 接口文档</Title>
                        <Paragraph type="secondary">
                            系统自动生成的 OpenAPI (Swagger) 规范文档，供开发者和前端调试使用。
                        </Paragraph>
                        <Space size="large">
                            <Button type="primary" size="large" icon={<LinkOutlined />} href="/api-docs" target="_blank">
                                打开 Swagger UI
                            </Button>
                            <Button size="large" icon={<CloudSyncOutlined />} onClick={handleRegenerate}>
                                重新生成文档
                            </Button>
                        </Space>
                    </div>

                    <Row gutter={24} className="mt-8">
                        <Col span={8}>
                            <Statistic title="总接口数 (Endpoints)" value={stats?.totalEndpoints ?? '-'} />
                        </Col>
                        <Col span={8}>
                            <Statistic title="数据模型 (Schemas)" value={stats?.totalSchemas ?? '-'} />
                        </Col>
                        <Col span={8}>
                            <Statistic title="文档版本" value={stats?.version ?? '1.0.0'} />
                        </Col>
                    </Row>

                    <div className="mt-8 p-4 bg-gray-50 rounded border border-gray-100">
                        <Text strong>调试提示：</Text>
                        <ul className="list-disc pl-5 mt-2 text-gray-600">
                            <li>文档地址：<Text code>/api-docs</Text></li>
                            <li>JSON 规范：<Text code>/api/docs/swagger.json</Text></li>
                            <li>所有接口均需携带 <Text code>Authorization: Bearer &lt;token&gt;</Text> 头（登录接口除外）。</li>
                        </ul>
                    </div>
                </Card>
            </Space>
        </div>
    );
}
