'use client';

/**
 * 表单Schema管理页面
 * 艹！使用GPT5工业级框架，统一UI风格！
 */

import { useRouter } from 'next/navigation';
import { Button, Tag, Modal, message, Space } from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    FormOutlined,
    HistoryOutlined
} from '@ant-design/icons';

// 新框架组件和Hooks
import {
    DataTable,
    FilterBar,
    FilterType,
    type DataTableColumn,
    type FilterConfig,
} from '@/shared/ui/DataTable';
import { useTableData } from '@/shared/hooks/useTableData';

// API和类型
import { formSchemas, FormSchema } from '@/lib/services/formSchemas';

const { confirm } = Modal;

const DEFAULT_FILTERS = {
    publish_status: '',
};

export default function AdminFormsPage() {
    const router = useRouter();

    // ========== 新框架：使用useTableData Hook统一管理状态 ==========
    const tableData = useTableData<FormSchema>({
        fetcher: async ({ pagination, filters }) => {
            const response = await formSchemas.list({
                limit: pagination.pageSize,
                offset: (pagination.page - 1) * pagination.pageSize,
                publish_status: filters.publish_status as any || undefined,
            });

            return {
                items: response.schemas,
                total: response.total,
            };
        },
        autoLoad: true,
        initialFilters: DEFAULT_FILTERS,
    });

    // ========== 新框架：FilterBar配置 ==========
    const filterConfig: FilterConfig[] = [
        {
            type: FilterType.SELECT,
            key: 'publish_status',
            label: '发布状态',
            placeholder: '筛选状态',
            options: [
                { label: '全部状态', value: '' },
                { label: '草稿', value: 'draft' },
                { label: '已发布', value: 'published' },
                { label: '已归档', value: 'archived' },
            ],
            allowClear: true,
        },
    ];

    // ========== 操作处理函数 ==========

    /**
     * 删除Schema
     */
    const handleDelete = (schemaId: string) => {
        confirm({
            title: '确认归档',
            content: `确定要归档表单 "${schemaId}" 吗？`,
            okText: '确定',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await formSchemas.delete(schemaId);
                    message.success('归档成功');
                    tableData.refresh();
                } catch (error: any) {
                    message.error('归档失败');
                }
            },
        });
    };

    // ========== 新框架：DataTable列配置 ==========
    const columns: DataTableColumn<FormSchema>[] = [
        {
            title: 'Schema ID',
            dataIndex: 'schema_id',
            key: 'schema_id',
            width: 180,
            render: (text: string) => (
                <Space>
                    <FormOutlined />
                    <span style={{ fontWeight: 500 }}>{text}</span>
                </Space>
            ),
        },
        {
            title: '当前版本',
            dataIndex: 'version',
            key: 'version',
            width: 100,
            render: (version: number) => <Tag color="blue">v{version}</Tag>,
        },
        {
            title: '状态',
            dataIndex: 'publish_status',
            key: 'publish_status',
            width: 100,
            render: (status: string) => {
                const colorMap: Record<string, string> = {
                    draft: 'orange',
                    published: 'green',
                    archived: 'default',
                };
                const textMap: Record<string, string> = {
                    draft: '草稿',
                    published: '已发布',
                    archived: '已归档',
                };
                return <Tag color={colorMap[status]}>{textMap[status] || status}</Tag>;
            },
        },
        {
            title: '版本描述',
            dataIndex: 'version_description',
            key: 'version_description',
            width: 200,
            ellipsis: true,
            render: (text: string) => text || '-',
        },
        {
            title: '更新时间',
            dataIndex: 'updated_at',
            key: 'updated_at',
            width: 180,
            render: (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '-',
        },
        {
            title: '操作',
            key: 'action',
            width: 180,
            fixed: 'right',
            render: (_: any, record: FormSchema) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => router.push(`/admin/forms/builder?id=${record.schema_id}`)}
                    >
                        编辑
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record.schema_id)}
                    >
                        归档
                    </Button>
                </Space>
            ),
        },
    ];

    // ========== 渲染UI（新框架组件） ==========
    return (
        <div style={{ padding: '24px' }}>
            {/* 新框架：FilterBar */}
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => router.push('/admin/forms/builder')}
                >
                    新建表单
                </Button>
            </div>

            {/* 新框架：DataTable */}
            <DataTable
                columns={columns}
                dataSource={tableData.data}
                loading={tableData.loading}
                rowKey="schema_id"
                pagination={{
                    page: tableData.pagination.page,
                    pageSize: tableData.pagination.pageSize,
                    total: tableData.pagination.total,
                    onChange: tableData.pagination.goToPage,
                }}
                scroll={{ x: 1000 }}
            />
        </div>
    );
}
