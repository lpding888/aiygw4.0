'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Card,
    Descriptions,
    Tag,
    Button,
    Table,
    Space,
    Avatar,
    Modal,
    Form,
    Select,
    Input,
    message,
    Spin,
    Progress,
    Tabs,
} from 'antd';
import {
    ArrowLeftOutlined,
    TeamOutlined,
    UserOutlined,
    EditOutlined,
    DeleteOutlined,
    PlusOutlined,
    ShopOutlined,
    BankOutlined,
} from '@ant-design/icons';

interface Tenant {
    id: string;
    name: string;
    type: 'personal' | 'distributor' | 'enterprise';
    owner_id: string;
    avatar?: string;
    description?: string;
    status: 'active' | 'suspended' | 'deleted';
    storage_quota: number;
    used_storage: number;
    allowed_features?: string[];
    created_at: string;
}

interface TenantMember {
    id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    status: 'active' | 'invited' | 'removed';
    joined_at?: string;
    user?: {
        username: string;
        nickname?: string;
        avatar?: string;
        email?: string;
    };
}

const ROLE_MAP: Record<string, { label: string; color: string }> = {
    owner: { label: '所有者', color: 'gold' },
    admin: { label: '管理员', color: 'blue' },
    member: { label: '成员', color: 'green' },
    viewer: { label: '访客', color: 'default' },
};

const TYPE_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
    personal: { label: '个人空间', icon: <UserOutlined /> },
    distributor: { label: '分销商', icon: <ShopOutlined /> },
    enterprise: { label: '企业', icon: <BankOutlined /> },
};

export default function TenantDetailPage() {
    const params = useParams();
    const router = useRouter();
    const tenantId = params.id as string;

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [members, setMembers] = useState<TenantMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [addMemberVisible, setAddMemberVisible] = useState(false);
    const [form] = Form.useForm();

    // 获取租户详情
    const fetchTenant = async () => {
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/admin/tenants/${tenantId}`,
                { credentials: 'include' }
            );
            const data = await response.json();
            if (data.success) {
                setTenant(data.tenant);
            }
        } catch (error) {
            message.error('获取租户信息失败');
        }
    };

    // 获取成员列表
    const fetchMembers = async () => {
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/admin/tenants/${tenantId}/members`,
                { credentials: 'include' }
            );
            const data = await response.json();
            if (data.success) {
                setMembers(data.members || []);
            }
        } catch (error) {
            message.error('获取成员列表失败');
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchTenant(), fetchMembers()]);
            setLoading(false);
        };
        loadData();
    }, [tenantId]);

    // 添加成员
    const handleAddMember = async (values: { user_id: string; role: string }) => {
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/admin/tenants/${tenantId}/members`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(values),
                }
            );
            const data = await response.json();
            if (data.success) {
                message.success('成员添加成功');
                setAddMemberVisible(false);
                form.resetFields();
                fetchMembers();
            } else {
                message.error(data.error?.message || '添加失败');
            }
        } catch (error) {
            message.error('添加成员失败');
        }
    };

    // 移除成员
    const handleRemoveMember = (member: TenantMember) => {
        Modal.confirm({
            title: '确认移除',
            content: `确定要移除成员 "${member.user?.nickname || member.user_id}" 吗？`,
            okText: '确定',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await fetch(
                        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/tenants/${tenantId}/members/${member.user_id}`,
                        { method: 'DELETE', credentials: 'include' }
                    );
                    message.success('成员已移除');
                    fetchMembers();
                } catch (error) {
                    message.error('移除失败');
                }
            },
        });
    };

    // 成员表格列
    const memberColumns = [
        {
            title: '成员',
            key: 'user',
            render: (_: any, record: TenantMember) => (
                <Space>
                    <Avatar src={record.user?.avatar} icon={<UserOutlined />} />
                    <div>
                        <div>{record.user?.nickname || record.user?.username || record.user_id}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>{record.user?.email}</div>
                    </div>
                </Space>
            ),
        },
        {
            title: '角色',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => (
                <Tag color={ROLE_MAP[role]?.color}>{ROLE_MAP[role]?.label || role}</Tag>
            ),
        },
        {
            title: '加入时间',
            dataIndex: 'joined_at',
            key: 'joined_at',
            render: (date: string) => (date ? new Date(date).toLocaleString('zh-CN') : '-'),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: TenantMember) =>
                record.role !== 'owner' && (
                    <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveMember(record)}
                    >
                        移除
                    </Button>
                ),
        },
    ];

    if (loading) {
        return (
            <div style={{ padding: 24, textAlign: 'center' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!tenant) {
        return (
            <div style={{ padding: 24, textAlign: 'center' }}>
                <p>租户不存在</p>
                <Button onClick={() => router.back()}>返回</Button>
            </div>
        );
    }

    const storagePercent = Math.round((tenant.used_storage / tenant.storage_quota) * 100);

    return (
        <div style={{ padding: 24 }}>
            <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => router.back()}
                style={{ marginBottom: 16 }}
            >
                返回
            </Button>

            <Tabs
                defaultActiveKey="info"
                items={[
                    {
                        key: 'info',
                        label: '基本信息',
                        children: (
                            <Card>
                                <Descriptions title="租户信息" bordered column={2}>
                                    <Descriptions.Item label="租户名称">{tenant.name}</Descriptions.Item>
                                    <Descriptions.Item label="租户ID">{tenant.id}</Descriptions.Item>
                                    <Descriptions.Item label="类型">
                                        <Tag icon={TYPE_MAP[tenant.type]?.icon}>
                                            {TYPE_MAP[tenant.type]?.label || tenant.type}
                                        </Tag>
                                    </Descriptions.Item>
                                    <Descriptions.Item label="状态">
                                        <Tag color={tenant.status === 'active' ? 'success' : 'warning'}>
                                            {tenant.status === 'active' ? '正常' : '停用'}
                                        </Tag>
                                    </Descriptions.Item>
                                    <Descriptions.Item label="存储配额" span={2}>
                                        <div style={{ width: 300 }}>
                                            <Progress
                                                percent={storagePercent}
                                                status={storagePercent > 80 ? 'exception' : 'normal'}
                                            />
                                            <div style={{ fontSize: 12, color: '#999' }}>
                                                已用 {(tenant.used_storage / 1024 / 1024 / 1024).toFixed(2)} GB / 配额{' '}
                                                {(tenant.storage_quota / 1024 / 1024 / 1024).toFixed(0)} GB
                                            </div>
                                        </div>
                                    </Descriptions.Item>
                                    <Descriptions.Item label="描述" span={2}>
                                        {tenant.description || '-'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="创建时间">
                                        {new Date(tenant.created_at).toLocaleString('zh-CN')}
                                    </Descriptions.Item>
                                </Descriptions>
                            </Card>
                        ),
                    },
                    {
                        key: 'members',
                        label: `成员管理 (${members.length})`,
                        children: (
                            <Card
                                title={
                                    <Space>
                                        <TeamOutlined />
                                        成员列表
                                    </Space>
                                }
                                extra={
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={() => setAddMemberVisible(true)}
                                    >
                                        添加成员
                                    </Button>
                                }
                            >
                                <Table
                                    dataSource={members}
                                    columns={memberColumns}
                                    rowKey="id"
                                    pagination={false}
                                />
                            </Card>
                        ),
                    },
                ]}
            />

            {/* 添加成员弹窗 */}
            <Modal
                title="添加成员"
                open={addMemberVisible}
                onCancel={() => setAddMemberVisible(false)}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleAddMember}>
                    <Form.Item
                        name="user_id"
                        label="用户ID"
                        rules={[{ required: true, message: '请输入用户ID' }]}
                    >
                        <Input placeholder="请输入要添加的用户ID" />
                    </Form.Item>
                    <Form.Item
                        name="role"
                        label="角色"
                        rules={[{ required: true, message: '请选择角色' }]}
                        initialValue="member"
                    >
                        <Select>
                            <Select.Option value="admin">管理员</Select.Option>
                            <Select.Option value="member">成员</Select.Option>
                            <Select.Option value="viewer">访客</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
