'use client';

import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, message, Tooltip, Badge } from 'antd';
import {
    PlusOutlined,
    ApiOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    SyncOutlined,
    DeleteOutlined,
    RocketOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';
import dayjs from 'dayjs';

interface MCPEndpoint {
    id: string;
    name: string;
    endpointUrl: string;
    status: 'active' | 'inactive' | 'error';
    healthy: boolean;
    supportedTools: any[];
    lastSyncAt: string;
    lastError?: string;
    capabilities: string[];
}

export default function MCPPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<MCPEndpoint[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [testingId, setTestingId] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = (await api.mcp.listEndpoints({ limit: 100 })) as any;
            if (res.success) {
                setData(res.data || []);
            }
        } catch (error) {
            message.error('加载列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = async (values: any) => {
        setSubmitting(true);
        try {
            // 如果是stdio，自动添加前缀如果用户没写
            // 但这里我们让用户输入完整的命令，或者我们在后端处理
            // 这里简单透传
            const res = (await api.mcp.createEndpoint(values)) as any;
            if (res.success) {
                message.success('添加成功');
                setModalVisible(false);
                form.resetFields();
                fetchData();

                // 自动触发一次测试以连接
                if (res.data?.id) {
                    handleTest(res.data.id);
                }
            } else {
                message.error(res.message || '添加失败');
            }
        } catch (error) {
            message.error('添加失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        Modal.confirm({
            title: '确认删除?',
            content: '删除后相关的Pipeline可能会失效',
            okType: 'danger',
            onOk: async () => {
                try {
                    await api.mcp.deleteEndpoint(id);
                    message.success('删除成功');
                    fetchData();
                } catch (e) {
                    message.error('删除失败');
                }
            }
        });
    };

    const handleTest = async (id: string) => {
        setTestingId(id);
        try {
            const res = (await api.mcp.testEndpoint(id)) as any;
            if (res.success && res.data.success) {
                message.success(`连接成功! 发现 ${res.data.toolsCount} 个工具`);
                fetchData(); // 刷新状态
            } else {
                message.error(res.data?.error || '连接失败');
            }
        } catch (error) {
            message.error('测试连接失败');
        } finally {
            setTestingId(null);
        }
    };

    const columns = [
        {
            title: '名称 / ID',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: MCPEndpoint) => (
                <Space direction="vertical" size={0}>
                    <span style={{ fontWeight: 500 }}>{text}</span>
                    <span style={{ fontSize: 12, color: '#999' }}>{record.id}</span>
                </Space>
            )
        },
        {
            title: '连接地址',
            dataIndex: 'endpointUrl',
            key: 'endpointUrl',
            render: (text: string) => <Tag>{text}</Tag>
        },
        {
            title: '状态',
            key: 'status',
            render: (_: any, record: MCPEndpoint) => (
                <Space>
                    <Badge status={record.healthy ? 'success' : 'error'} />
                    {record.healthy ? '正常' : '异常'}
                    {record.lastError && (
                        <Tooltip title={record.lastError}>
                            <CloseCircleOutlined style={{ color: 'red' }} />
                        </Tooltip>
                    )}
                </Space>
            )
        },
        {
            title: '工具数',
            key: 'tools',
            render: (_: any, record: MCPEndpoint) => (
                <Tag color="blue">{record.supportedTools?.length || 0} Tools</Tag>
            )
        },
        {
            title: '最后同步',
            dataIndex: 'lastSyncAt',
            key: 'lastSyncAt',
            render: (text: string) => text ? dayjs(text).format('MM-DD HH:mm:ss') : '-'
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: MCPEndpoint) => (
                <Space>
                    <Button
                        type="link"
                        icon={testingId === record.id ? <SyncOutlined spin /> : <RocketOutlined />}
                        onClick={() => handleTest(record.id)}
                        disabled={!!testingId}
                    >
                        测试
                    </Button>
                    <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record.id)}
                    >
                        删除
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card
                title={
                    <Space>
                        <ApiOutlined />
                        <span>MCP 服务管理</span>
                    </Space>
                }
                extra={
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
                        添加服务
                    </Button>
                }
            >
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={data}
                    loading={loading}
                    pagination={false}
                />
            </Card>

            <Modal
                title="添加 MCP 服务"
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                centered
                width={600}
            >
                <Form form={form} layout="vertical" onFinish={handleCreate}>
                    <Form.Item
                        name="name"
                        label="服务名称"
                        rules={[{ required: true, message: '请输入名称' }]}
                    >
                        <Input placeholder="例如: Local Filesystem" />
                    </Form.Item>

                    <Form.Item
                        name="endpointUrl"
                        label="连接地址 (URL 或 stdio命令)"
                        tooltip="HTTP服务输入 http://...，本地进程输入 stdio:npx ..."
                        rules={[{ required: true, message: '请输入连接地址' }]}
                    >
                        <Input.TextArea
                            placeholder="stdio:npx -y @modelcontextprotocol/server-filesystem c:/Users/qq100/Desktop"
                            autoSize={{ minRows: 3, maxRows: 8 }}
                        />
                    </Form.Item>

                    <Form.Item name="apiKey" label="API Key (可选)">
                        <Input.Password placeholder="如果服务需要鉴权" />
                    </Form.Item>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setModalVisible(false)}>取消</Button>
                        <Button type="primary" htmlType="submit" loading={submitting}>
                            添加并连接
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
}
