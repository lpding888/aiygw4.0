'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Card,
    Table,
    Button,
    Input,
    Select,
    Tag,
    Space,
    Typography,
    Tooltip,
    Modal,
    Form,
    message,
    Tabs,
    Badge,
    Alert,
    Drawer,
    Spin
} from 'antd';
import {
    SearchOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    HistoryOutlined,
    CloudSyncOutlined,
    RocketOutlined,
    UndoOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface PromptTemplate {
    id: string;
    key: string;
    name: string;
    description: string;
    content: string;
    category: string;
    status: 'draft' | 'published' | 'archived';
    version: number;
    updated_at: string;
    updated_by_username: string;
    metadata?: any;
}

export default function PromptManagementPage() {
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState<PromptTemplate[]>([]);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
        total: 0
    });
    const [filters, setFilters] = useState({
        search: '',
        category: '',
        status: ''
    });
    const [stats, setStats] = useState<any>(null);

    // Drawer & Modal State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Form State
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);

    const fetchTemplates = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const res: any = await api.adminPromptTemplates.list({
                page,
                limit: pagination.pageSize,
                ...filters
            });
            if (res.success) {
                setTemplates(res.data.templates);
                setPagination({
                    current: res.data.pagination.page,
                    pageSize: res.data.pagination.limit,
                    total: res.data.pagination.total
                });
            }
        } catch (error: any) {
            message.error(error.message || '加载模板失败');
        } finally {
            setLoading(false);
        }
    }, [filters, pagination.pageSize]);

    const fetchStats = async () => {
        try {
            const res: any = await api.adminPromptTemplates.getStats();
            if (res.success) {
                setStats(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch stats', error);
        }
    };

    useEffect(() => {
        fetchTemplates();
        fetchStats();
    }, [fetchTemplates]);

    const handleCreate = () => {
        setEditingTemplate(null);
        form.resetFields();
        setIsDrawerOpen(true);
    };

    const handleEdit = async (record: PromptTemplate) => {
        setEditingTemplate(record);
        // Fetch full details including content
        try {
            const res: any = await api.adminPromptTemplates.get(record.id);
            if (res.success) {
                form.setFieldsValue(res.data);
                setIsDrawerOpen(true);
            }
        } catch (error: any) {
            message.error('加载详情失败');
        }
    };

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: '确认删除',
            content: '确定要删除这个模板吗？删除后可以从归档中恢复。',
            onOk: async () => {
                try {
                    await api.adminPromptTemplates.delete(id);
                    message.success('删除成功');
                    fetchTemplates(pagination.current);
                    fetchStats();
                } catch (error: any) {
                    message.error(error.message);
                }
            }
        });
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            if (editingTemplate) {
                await api.adminPromptTemplates.update(editingTemplate.id, values);
                message.success('更新成功');
            } else {
                await api.adminPromptTemplates.create(values);
                message.success('创建成功');
            }
            setIsDrawerOpen(false);
            fetchTemplates(pagination.current);
            fetchStats();
        } catch (error: any) {
            message.error(error.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async (record: PromptTemplate) => {
        try {
            await api.adminPromptTemplates.publish(record.id);
            message.success('发布成功');
            fetchTemplates(pagination.current);
        } catch (error: any) {
            message.error(error.message);
        }
    };

    const handleRefreshProtocol = async () => {
        setIsRefreshing(true);
        try {
            const res: any = await api.adminPromptTemplates.refreshProtocol();
            if (res.success) {
                message.success('Protocol 文档已刷新，AI Architect 提示词已更新');
                fetchTemplates(pagination.current); // Content might change
            }
        } catch (error: any) {
            message.error(error.message || '刷新失败');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleViewHistory = async (record: PromptTemplate) => {
        setEditingTemplate(record);
        setIsHistoryModalOpen(true);
        try {
            const res: any = await api.adminPromptTemplates.getHistory(record.id);
            if (res.success) {
                setHistory(res.data.history);
            }
        } catch (error: any) {
            message.error('获取历史记录失败');
        }
    };

    const handleRollback = (version: number) => {
        if (!editingTemplate) return;
        Modal.confirm({
            title: `回滚到版本 v${version}?`,
            content: '这将创建一个新版本，内容与选定版本一致。',
            onOk: async () => {
                try {
                    await api.adminPromptTemplates.rollback(editingTemplate.id, { targetVersion: version });
                    message.success('回滚成功');
                    setIsHistoryModalOpen(false);
                    fetchTemplates(pagination.current);
                } catch (error: any) {
                    message.error(error.message);
                }
            }
        });
    };

    const columns: ColumnsType<PromptTemplate> = [
        {
            title: '名称 / Key',
            key: 'name',
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{record.name}</Text>
                    <Text type="secondary" copyable>{record.key}</Text>
                    {record.key.startsWith('ai_architect') && <Tag color="geekblue">AI Architect</Tag>}
                </Space>
            )
        },
        {
            title: '分类',
            dataIndex: 'category',
            key: 'category',
            render: (cat) => <Tag>{cat}</Tag>
        },
        {
            title: '版本',
            dataIndex: 'version',
            key: 'version',
            render: (v) => <Tag color="purple">v{v}</Tag>
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                const colors: any = { draft: 'orange', published: 'green', archived: 'default' };
                return <Badge status={status === 'published' ? 'success' : 'warning'} text={status} />;
            }
        },
        {
            title: '更新时间',
            dataIndex: 'updated_at',
            key: 'updated_at',
            render: (date) => new Date(date).toLocaleString(),
            sorter: true
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Space>
                    <Tooltip title="编辑">
                        <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    </Tooltip>
                    <Tooltip title="历史记录">
                        <Button icon={<HistoryOutlined />} onClick={() => handleViewHistory(record)} />
                    </Tooltip>
                    {record.status !== 'published' && (
                        <Tooltip title="发布">
                            <Button icon={<RocketOutlined />} onClick={() => handlePublish(record)} type="dashed" />
                        </Tooltip>
                    )}
                    <Tooltip title="删除">
                        <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
                    </Tooltip>
                </Space>
            )
        }
    ];

    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
                <div>
                    <Title level={2} style={{ marginBottom: 0 }}>提示词管理 (Prompt Manager)</Title>
                    <Paragraph type="secondary">管理系统中的所有动态提示词模板，支持版本控制和实时更新。</Paragraph>
                </div>
                <Space>
                    <Tooltip title="从 Protocol 定义重新生成 AI Architect 的文档部分">
                        <Button
                            icon={<CloudSyncOutlined />}
                            onClick={handleRefreshProtocol}
                            loading={isRefreshing}
                        >
                            刷新 Protocol 文档
                        </Button>
                    </Tooltip>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                        创建模板
                    </Button>
                </Space>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-4 gap-4">
                    <Card>
                        <div className="text-gray-500">总模板数</div>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </Card>
                    <Card>
                        <div className="text-gray-500">已发布</div>
                        <div className="text-2xl font-bold text-green-600">{stats.published}</div>
                    </Card>
                    <Card>
                        <div className="text-gray-500">AI Architect</div>
                        <div className="text-2xl font-bold text-blue-600">
                            {(templates.filter(t => t.category === 'system').length)}
                        </div>
                    </Card>
                    {/* Add more stats if needed */}
                </div>
            )}

            <Card>
                <div className="mb-4 flex gap-4">
                    <Input
                        prefix={<SearchOutlined />}
                        placeholder="搜索名称或内容..."
                        style={{ width: 300 }}
                        onChange={e => setFilters({ ...filters, search: e.target.value })}
                    />
                    <Select
                        placeholder="分类"
                        style={{ width: 150 }}
                        allowClear
                        onChange={val => setFilters({ ...filters, category: val })}
                    >
                        <Option value="system">System</Option>
                        <Option value="user">User</Option>
                        <Option value="assistant">Assistant</Option>
                    </Select>
                </div>

                <Table
                    columns={columns}
                    dataSource={templates}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        ...pagination,
                        onChange: (page) => fetchTemplates(page)
                    }}
                />
            </Card>

            {/* Editor Drawer */}
            <Drawer
                title={editingTemplate ? "编辑模板" : "创建模板"}
                width={800}
                onClose={() => setIsDrawerOpen(false)}
                open={isDrawerOpen}
                extra={
                    <Button type="primary" onClick={handleSave} loading={saving}>
                        保存
                    </Button>
                }
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="name" label="名称" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="key" label="Key (唯一标识)" rules={[{ required: true }]}>
                        <Input disabled={!!editingTemplate} />
                    </Form.Item>
                    <Form.Item name="category" label="分类" rules={[{ required: true }]}>
                        <Select>
                            <Option value="system">System (系统)</Option>
                            <Option value="user">User (用户)</Option>
                            <Option value="assistant">Assistant (助手)</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                        <TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="content" label="提示词内容 (支持 {{variable}})" rules={[{ required: true }]}>
                        <TextArea rows={15} style={{ fontFamily: 'monospace' }} />
                    </Form.Item>
                </Form>
            </Drawer>

            {/* History Modal */}
            <Modal
                title="版本历史"
                open={isHistoryModalOpen}
                onCancel={() => setIsHistoryModalOpen(false)}
                footer={null}
                width={800}
            >
                <Table
                    dataSource={history}
                    rowKey="version"
                    columns={[
                        { title: '版本', dataIndex: 'version', render: v => `v${v}` },
                        { title: '状态', dataIndex: 'status' },
                        { title: '更新时间', dataIndex: 'created_at', render: d => new Date(d).toLocaleString() },
                        { title: '变更人', dataIndex: 'created_by' }, // This usually returns ID, user needs join. MVP ignores names here.
                        {
                            title: '操作',
                            render: (_, record) => (
                                <Button
                                    size="small"
                                    icon={<UndoOutlined />}
                                    onClick={() => handleRollback(record.version)}
                                    disabled={record.version === editingTemplate?.version}
                                >
                                    回滚至此
                                </Button>
                            )
                        }
                    ]}
                />
            </Modal>
        </div>
    );
}
