'use client';

import { Tag } from 'antd';
import {
    DataTable,
    FilterBar,
    FilterType,
    type DataTableColumn,
    type FilterConfig,
} from '@/shared/ui/DataTable';
import { useTableData } from '@/shared/hooks/useTableData';
import { api } from '@/lib/api';

interface AuditLog {
    id: string;
    user_id: string;
    user_name?: string;
    action: string;
    resource_type: string;
    resource_id?: string;
    details?: any;
    ip_address?: string;
    created_at: string;
    status: 'success' | 'failure';
}

const DEFAULT_FILTERS = {
    action: '',
    user_id: '',
};

export default function AuditLogsPage() {
    // ========== 使用useTableData Hook统一管理状态 ==========
    const tableData = useTableData<AuditLog>({
        fetcher: async ({ pagination, filters }) => {
            const response: any = await api.admin.getAuditLogs({
                limit: pagination.pageSize,
                offset: (pagination.page - 1) * pagination.pageSize,
                action: filters.action || undefined,
                userId: filters.user_id || undefined,
            });

            // 如果API还没准备好，返回空数据防止报错
            if (!response.success) {
                return { items: [], total: 0 };
            }

            return {
                items: response.data.logs || [],
                total: response.data.total || 0,
            };
        },
        autoLoad: true,
        initialFilters: DEFAULT_FILTERS,
    });

    // ========== FilterBar配置 ==========
    const filterConfig: FilterConfig[] = [
        {
            type: FilterType.INPUT,
            key: 'user_id',
            label: '用户ID',
            placeholder: '输入用户ID搜索',
            allowClear: true,
        },
        {
            type: FilterType.SELECT,
            key: 'action',
            label: '操作类型',
            placeholder: '筛选操作',
            options: [
                { label: '全部操作', value: '' },
                { label: '登录', value: 'login' },
                { label: '创建任务', value: 'create_task' },
                { label: '充值', value: 'recharge' },
                { label: '提现', value: 'withdraw' },
                { label: '修改配置', value: 'update_config' },
            ],
            allowClear: true,
        },
    ];

    // ========== DataTable列配置 ==========
    const columns: DataTableColumn<AuditLog>[] = [
        {
            title: '时间',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 180,
            render: (date: string) => new Date(date).toLocaleString('zh-CN'),
        },
        {
            title: '用户',
            dataIndex: 'user_id',
            key: 'user_id',
            width: 150,
            render: (id: string, record: AuditLog) => (
                <span>{record.user_name || id}</span>
            ),
        },
        {
            title: '操作',
            dataIndex: 'action',
            key: 'action',
            width: 150,
            render: (action: string) => <Tag color="blue">{action}</Tag>,
        },
        {
            title: '资源类型',
            dataIndex: 'resource_type',
            key: 'resource_type',
            width: 120,
        },
        {
            title: 'IP地址',
            dataIndex: 'ip_address',
            key: 'ip_address',
            width: 140,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: string) => (
                <Tag color={status === 'success' ? 'green' : 'red'}>
                    {status === 'success' ? '成功' : '失败'}
                </Tag>
            ),
        },
        {
            title: '详情',
            dataIndex: 'details',
            key: 'details',
            width: 200,
            ellipsis: true,
            render: (details: any) => JSON.stringify(details),
        },
    ];

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto animate-fade-up">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gradient mb-2">系统审计日志</h1>
                    <p className="text-gray-500">追踪用户行为与系统关键操作记录。</p>
                </div>
                <div className="flex gap-2">
                    {/* Add export button or other actions here if needed */}
                </div>
            </div>

            <div className="glass-card-strong p-6 mb-6">
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
            </div>

            <div className="glass-card-strong p-6">
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
        </div>
    );
}
