'use client';

import { useState } from 'react';
import { Tag, Button, Modal, message, Space, Avatar, Tooltip } from 'antd';
import {
    TeamOutlined,
    StopOutlined,
    CheckCircleOutlined,
    PlusOutlined,
    EyeOutlined,
    UserOutlined,
    ShopOutlined,
    BankOutlined,
} from '@ant-design/icons';
import {
    DataTable,
    FilterBar,
    FilterType,
    type DataTableColumn,
    type FilterConfig,
} from '@/shared/ui/DataTable';
import { useTableData } from '@/shared/hooks/useTableData';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

const { confirm } = Modal;

interface Tenant {
    id: string;
    name: string;
    type: 'personal' | 'distributor' | 'enterprise';
    owner_id: string;
    avatar?: string;
    status: 'active' | 'suspended' | 'deleted';
    member_count?: number;
    storage_quota?: number;
    used_storage?: number;
    created_at: string;
}

const DEFAULT_FILTERS = {
    type: '',
    status: '',
    keyword: '',
};

const TENANT_TYPE_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    personal: { label: '个人', color: 'blue', icon: <UserOutlined /> },
    distributor: { label: '分销商', color: 'orange', icon: <ShopOutlined /> },
    enterprise: { label: '企业', color: 'purple', icon: <BankOutlined /> },
};

export default function TenantsPage() {
    const router = useRouter();

    const tableData = useTableData<Tenant>({
        fetcher: async ({ pagination, filters }) => {
            // 调用后端API获取租户列表
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/admin/tenants?` +
                new URLSearchParams({
                    limit: String(pagination.pageSize),
                    offset: String((pagination.page - 1) * pagination.pageSize),
                    ...(filters.type && { type: filters.type }),
                    ...(filters.status && { status: filters.status }),
                    ...(filters.keyword && { keyword: filters.keyword }),
                }),
                {
                    credentials: 'include',
                }
            );

            const data = await response.json();

            return {
                items: data.tenants || [],
                total: data.total || 0,
            };
        },
        autoLoad: true,
        initialFilters: DEFAULT_FILTERS,
    });

    // 切换租户状态
    const handleToggleStatus = (tenant: Tenant) => {
        const isSuspended = tenant.status === 'suspended';
        const actionText = isSuspended ? '启用' : '停用';

        confirm({
            title: `确认${actionText}`,
            content: `确定要${actionText}租户 "${tenant.name}" 吗？${!isSuspended ? '停用后该租户下的所有成员将无法使用服务。' : ''}`,
            okText: '确定',
            okType: isSuspended ? 'primary' : 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/tenants/${tenant.id}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ status: isSuspended ? 'active' : 'suspended' }),
                    });
                    message.success(`租户已${actionText}`);
                    tableData.refresh();
                } catch (error: any) {
                    message.error('操作失败');
                }
            },
        });
    };

    // 查看租户详情
    const handleViewTenant = (tenant: Tenant) => {
        router.push(`/admin/tenants/${tenant.id}`);
    };

    // 筛选配置
    const filterConfig: FilterConfig[] = [
        {
            type: FilterType.INPUT,
            key: 'keyword',
            label: '搜索',
            placeholder: '租户名称',
            allowClear: true,
        },
        {
            type: FilterType.SELECT,
            key: 'type',
            label: '类型',
            placeholder: '全部类型',
            options: [
                { label: '全部', value: '' },
                { label: '个人', value: 'personal' },
                { label: '分销商', value: 'distributor' },
                { label: '企业', value: 'enterprise' },
            ],
            allowClear: true,
        },
        {
            type: FilterType.SELECT,
            key: 'status',
            label: '状态',
            placeholder: '全部状态',
            options: [
                { label: '全部', value: '' },
                { label: '正常', value: 'active' },
                { label: '停用', value: 'suspended' },
            ],
            allowClear: true,
        },
    ];

    // 表格列配置
    const columns: DataTableColumn<Tenant>[] = [
        {
            title: '租户',
            key: 'tenant',
            width: 250,
            render: (_: any, record: Tenant) => (
                <Space>
                    <Avatar
                        src={record.avatar}
                        icon={TENANT_TYPE_MAP[record.type]?.icon || <TeamOutlined />}
                        style={{
                            backgroundColor:
                                record.type === 'enterprise'
                                    ? '#722ed1'
                                    : record.type === 'distributor'
                                        ? '#fa8c16'
                                        : '#1890ff',
                        }}
                    />
                    <div>
                        <div style={{ fontWeight: 500 }}>{record.name}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>ID: {record.id.slice(0, 8)}...</div>
                    </div>
                </Space>
            ),
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            render: (type: string) => {
                const config = TENANT_TYPE_MAP[type] || { label: type, color: 'default', icon: null };
                return (
                    <Tag color={config.color} icon={config.icon}>
                        {config.label}
                    </Tag>
                );
            },
        },
        {
            title: '成员数',
            dataIndex: 'member_count',
            key: 'member_count',
            width: 100,
            render: (count: number) => (
                <Space>
                    <TeamOutlined />
                    {count || 0}
                </Space>
            ),
        },
        {
            title: '存储使用',
            key: 'storage',
            width: 150,
            render: (_: any, record: Tenant) => {
                const used = record.used_storage || 0;
                const quota = record.storage_quota || 10 * 1024 * 1024 * 1024;
                const percent = Math.round((used / quota) * 100);
                const usedGB = (used / 1024 / 1024 / 1024).toFixed(2);
                const quotaGB = (quota / 1024 / 1024 / 1024).toFixed(0);
                return (
                    <Tooltip title={`${usedGB}GB / ${quotaGB}GB`}>
                        <div style={{ width: 100 }}>
                            <div
                                style={{
                                    height: 6,
                                    backgroundColor: '#f0f0f0',
                                    borderRadius: 3,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        width: `${percent}%`,
                                        height: '100%',
                                        backgroundColor: percent > 80 ? '#ff4d4f' : percent > 60 ? '#faad14' : '#52c41a',
                                    }}
                                />
                            </div>
                            <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{percent}%</div>
                        </div>
                    </Tooltip>
                );
            },
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: string) => (
                <Tag
                    color={status === 'active' ? 'success' : status === 'suspended' ? 'warning' : 'error'}
                    icon={status === 'active' ? <CheckCircleOutlined /> : <StopOutlined />}
                >
                    {status === 'active' ? '正常' : status === 'suspended' ? '停用' : '已删除'}
                </Tag>
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 180,
            render: (date: string) => new Date(date).toLocaleString('zh-CN'),
        },
        {
            title: '操作',
            key: 'action',
            width: 180,
            fixed: 'right',
            render: (_: any, record: Tenant) => (
                <Space>
                    <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewTenant(record)}>
                        详情
                    </Button>
                    <Button
                        type="link"
                        danger={record.status === 'active'}
                        onClick={() => handleToggleStatus(record)}
                    >
                        {record.status === 'active' ? '停用' : '启用'}
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div
                style={{
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <h2 style={{ margin: 0 }}>租户管理</h2>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/admin/tenants/new')}>
                    创建租户
                </Button>
            </div>

            <FilterBar
                filters={filterConfig}
                onFilterChange={(key, value) => {
                    tableData.filters.setFilter(key, value);
                    tableData.pagination.reset();
                }}
                onReset={() => {
                    tableData.filters.setFilters({ ...DEFAULT_FILTERS });
                    tableData.pagination.reset();
                }}
            />

            <DataTable
                columns={columns}
                dataSource={tableData.data}
                loading={tableData.loading}
                rowKey="id"
                pagination={{
                    page: tableData.pagination.page,
                    pageSize: tableData.pagination.pageSize,
                    total: tableData.pagination.total,
                    onChange: tableData.pagination.goToPage,
                }}
                scroll={{ x: 1200 }}
            />
        </div>
    );
}
