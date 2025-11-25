'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Switch, Tag, Modal, message, Space } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
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
import type { Feature } from '@/types';

const { confirm } = Modal;

const DEFAULT_FILTERS = {
  search: '',
  category: '',
  type: '',
  is_public: '',
  is_enabled: '',
};

const CATEGORY_OPTIONS = [
  { label: '全部分类', value: '' },
  { label: '图片处理', value: 'image_processing' },
  { label: 'AI 生成', value: 'ai_generation' },
  { label: '视频处理', value: 'video_processing' },
  { label: '音频处理', value: 'audio_processing' },
  { label: '文本处理', value: 'text_processing' },
  { label: '数据分析', value: 'data_analysis' },
  { label: '文件管理', value: 'file_management' },
  { label: '用户管理', value: 'user_management' },
  { label: '支付功能', value: 'payment' },
  { label: '集成功能', value: 'integration' },
];

const CATEGORY_LABELS: Record<string, string> = {
  image_processing: '图片处理',
  ai_generation: 'AI 生成',
  video_processing: '视频处理',
  audio_processing: '音频处理',
  text_processing: '文本处理',
  data_analysis: '数据分析',
  file_management: '文件管理',
  user_management: '用户管理',
  payment: '支付功能',
  integration: '集成功能',
};

const FEATURE_TYPES = [
  { label: '全部类型', value: '' },
  { label: '基础', value: 'basic' },
  { label: '高级', value: 'premium' },
  { label: '企业级', value: 'enterprise' },
  { label: '测试/Beta', value: 'beta' },
];

const TYPE_LABELS: Record<string, string> = {
  basic: '基础',
  premium: '高级',
  enterprise: '企业',
  beta: 'Beta',
};

const TYPE_COLORS: Record<string, string> = {
  basic: 'blue',
  premium: 'gold',
  enterprise: 'purple',
  beta: 'geekblue',
};

const VISIBILITY_OPTIONS = [
  { label: '全部可见性', value: '' },
  { label: '公开', value: 'true' },
  { label: '白名单', value: 'false' },
];

const STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '已启用', value: 'true' },
  { label: '已禁用', value: 'false' },
];

const resolveFilterValue = (value: unknown) =>
  value && typeof value === 'object' && 'target' in value
    ? (value as Record<string, any>).target?.value
    : value;

const parseArrayField = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    return value as string[];
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }
  return undefined;
};

const parseObjectField = <T extends Record<string, any>>(value: unknown): T | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        return parsed as T;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const normalizeFeatureRecord = (feature: Feature): Feature => ({
  ...feature,
  tags: parseArrayField(feature.tags ?? undefined) ?? feature.tags ?? undefined,
  metadata: parseObjectField<Record<string, any>>(feature.metadata) ?? feature.metadata ?? undefined,
  requirements:
    parseObjectField<Record<string, any>>(feature.requirements) ?? feature.requirements ?? undefined,
  limits: parseObjectField<Record<string, any>>(feature.limits) ?? feature.limits ?? undefined,
  pricing: parseObjectField<Record<string, any>>(feature.pricing) ?? feature.pricing ?? undefined,
});

const unwrapResponse = (response: any) => (response?.data?.success !== undefined ? response.data : response);

const getFeatureKey = (feature: Feature) => feature.feature_key || feature.feature_id;

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString('zh-CN') : '-');

const mapBooleanFilter = (value: unknown) => {
  if (value === 'true' || value === true) return 'true';
  if (value === 'false' || value === false) return 'false';
  return undefined;
};

export default function AdminFeaturesPage() {
  const router = useRouter();

  const tableData = useTableData<Feature>({
    fetcher: async ({ pageSize, offset, filters }) => {
      const params: Record<string, any> = {
        limit: pageSize,
        offset,
      };

      if (filters.category) {
        params.category = filters.category;
      }
      if (filters.type) {
        params.type = filters.type;
      }
      const keyword = typeof filters.search === 'string' ? filters.search.trim() : '';
      if (keyword) {
        params.search = keyword;
      }

      const visibility = mapBooleanFilter(filters.is_public);
      if (visibility) {
        params.is_public = visibility;
      }
      const status = mapBooleanFilter(filters.is_enabled);
      if (status) {
        params.is_enabled = status;
      }

      const rawResponse = await api.admin.getFeatures(params);
      const payload = unwrapResponse(rawResponse);

      if (!payload?.success || !payload?.data) {
        throw new Error(payload?.error?.message ?? '获取功能列表失败');
      }

      const { features = [], pagination } = payload.data as {
        features?: Feature[];
        pagination?: { total?: number };
      };

      const normalized = (features ?? []).map(normalizeFeatureRecord);

      return {
        items: normalized,
        total: pagination?.total ?? normalized.length,
      };
    },
    autoLoad: true,
    initialFilters: DEFAULT_FILTERS,
    initialPageSize: 10,
  });

  const handleToggle = (feature: Feature, nextEnabled: boolean, currentEnabled: boolean) => {
    const featureKey = getFeatureKey(feature);
    if (!featureKey) return;

    const quotaCost = feature.quota_cost ?? 0;

    const executeToggle = async () => {
      try {
        const response = unwrapResponse(await api.admin.toggleFeature(featureKey, { is_enabled: nextEnabled }));
        if (!response?.success) {
          throw new Error(response?.error?.message ?? '操作失败');
        }
        message.success(nextEnabled ? '功能已启用' : '功能已禁用');
        tableData.refresh();
      } catch (error: any) {
        message.error(error?.message ?? '操作失败');
      }
    };

    if (!currentEnabled && nextEnabled && quotaCost === 0) {
      confirm({
        title: '确认开启零配额功能？',
        icon: <ExclamationCircleOutlined />,
        content: '该功能当前配额消耗为0，开启后可能导致资源滥用，是否继续？',
        okText: '仍要开启',
        okType: 'danger',
        cancelText: '取消',
        onOk: executeToggle,
      });
      return;
    }

    void executeToggle();
  };

  const handleDelete = (feature: Feature) => {
    const featureKey = getFeatureKey(feature);
    if (!featureKey) return;

    const featureName = feature.display_name || feature.name || featureKey;

    confirm({
      title: '确认删除功能',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除功能“${featureName}”吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = unwrapResponse(await api.admin.deleteFeature(featureKey));
          if (!response?.success) {
            throw new Error(response?.error?.message ?? '删除失败');
          }
          message.success('删除成功');
          tableData.refresh();
        } catch (error: any) {
          message.error(error?.message ?? '删除失败');
        }
      },
    });
  };

  const filterConfig: FilterConfig[] = useMemo(
    () => [
      {
        type: FilterType.SEARCH,
        key: 'search',
        label: '关键字',
        placeholder: '搜索名称或 Feature Key',
        width: 260,
      },
      {
        type: FilterType.SELECT,
        key: 'category',
        label: '功能分类',
        options: CATEGORY_OPTIONS,
        allowClear: true,
      },
      {
        type: FilterType.SELECT,
        key: 'type',
        label: '功能类型',
        options: FEATURE_TYPES,
        allowClear: true,
      },
      {
        type: FilterType.SELECT,
        key: 'is_public',
        label: '公开状态',
        options: VISIBILITY_OPTIONS,
        allowClear: true,
      },
      {
        type: FilterType.SELECT,
        key: 'is_enabled',
        label: '启用状态',
        options: STATUS_OPTIONS,
        allowClear: true,
      },
    ],
    []
  );

  const handleFilterChange = (key: string, rawValue: unknown) => {
    const value = resolveFilterValue(rawValue);
    tableData.filters.setFilter(key, value as any);
    tableData.pagination.reset();
  };

  const handleReset = () => {
    tableData.filters.setFilters({ ...DEFAULT_FILTERS });
    tableData.pagination.reset();
  };

  const columns: DataTableColumn<Feature>[] = [
    {
      title: 'Feature Key',
      key: 'feature_key',
      dataIndex: 'feature_key',
      width: 180,
      render: (_value, record) => getFeatureKey(record),
    },
    {
      title: '显示名称',
      key: 'display_name',
      dataIndex: 'display_name',
      width: 160,
      render: (_value, record) => record.display_name || record.name || '-',
    },
    {
      title: '分类',
      key: 'category',
      dataIndex: 'category',
      width: 130,
      render: (category: string) => (
        <Tag color="blue">{CATEGORY_LABELS[category] ?? category ?? '-'}</Tag>
      ),
    },
    {
      title: '类型',
      key: 'type',
      dataIndex: 'type',
      width: 120,
      render: (type: string | undefined) => (
        <Tag color={TYPE_COLORS[type as string] || 'default'}>{TYPE_LABELS[type as string] || type || '-'}</Tag>
      ),
    },
    {
      title: '公开状态',
      key: 'is_public',
      dataIndex: 'is_public',
      width: 120,
      render: (isPublic: boolean | undefined) => (
        <Tag color={isPublic ? 'green' : 'orange'}>{isPublic ? '公开' : '白名单'}</Tag>
      ),
    },
    {
      title: '启用状态',
      key: 'is_enabled',
      dataIndex: 'is_enabled',
      width: 120,
      render: (_value, record) => {
        const isEnabled = record.is_enabled ?? record.is_active ?? false;
        return (
          <Switch
            checked={isEnabled}
            onChange={(checked) => handleToggle(record, checked, isEnabled)}
          />
        );
      },
    },
    {
      title: '所需套餐',
      key: 'plan_required',
      dataIndex: 'plan_required',
      width: 120,
      render: (plan: string) => {
        const colorMap: Record<string, string> = {
          free: 'green',
          basic: 'blue',
          member: 'cyan',
          pro: 'gold',
          enterprise: 'purple',
        };
        return <Tag color={colorMap[plan] || 'default'}>{plan || '-'}</Tag>;
      },
    },
    {
      title: '访问模式',
      key: 'access_scope',
      dataIndex: 'access_scope',
      width: 120,
      render: (scope: string) => (
        <Tag color={scope === 'whitelist' ? 'orange' : 'green'}>
          {scope === 'whitelist' ? '白名单' : '套餐' }
        </Tag>
      ),
    },
    {
      title: '配额消耗',
      key: 'quota_cost',
      dataIndex: 'quota_cost',
      width: 120,
      render: (cost: number) => (
        <span
          style={{ color: cost === 0 ? '#ff4d4f' : undefined, fontWeight: cost === 0 ? 600 : 400 }}
        >
          {cost ?? 0} 次
        </span>
      ),
    },
    {
      title: '限流策略',
      key: 'rate_limit_policy',
      dataIndex: 'rate_limit_policy',
      width: 160,
      render: (policy: string | null) => policy || '-',
    },
    {
      title: '标签',
      key: 'tags',
      dataIndex: 'tags',
      width: 200,
      render: (tags: string[] | undefined) => {
        if (!tags || tags.length === 0) {
          return '-';
        }
        return (
          <Space size={[0, 4]} wrap>
            {tags.slice(0, 3).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            {tags.length > 3 && <Tag>+{tags.length - 3}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '发布时间',
      key: 'released_at',
      dataIndex: 'released_at',
      width: 150,
      render: (value: string | null | undefined) => formatDate(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_: unknown, record: Feature) => {
        const featureKey = getFeatureKey(record);
        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => router.push(`/admin/features/${featureKey}/edit`)}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            >
              删除
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <FilterBar
        filters={filterConfig}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/admin/features/new')}>
          新增功能卡片
        </Button>
      </div>

      <DataTable
        columns={columns}
        dataSource={tableData.data}
        loading={tableData.loading}
        rowKey={(record) => getFeatureKey(record) ?? record.feature_id}
        pagination={{
          page: tableData.pagination.page,
          pageSize: tableData.pagination.pageSize,
          total: tableData.pagination.total,
          onChange: tableData.pagination.goToPage,
        }}
        scroll={{ x: 1400 }}
      />
    </div>
  );
}
