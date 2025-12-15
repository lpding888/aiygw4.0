'use client';

import { useState } from 'react';
import { Tag, Button, Modal, message, Space, Avatar, Tooltip } from 'antd';
import { UserOutlined, StopOutlined, CheckCircleOutlined, CrownOutlined, EyeOutlined } from '@ant-design/icons';
import {
  DataTable,
  FilterBar,
  FilterType,
  type DataTableColumn,
  type FilterConfig,
} from '@/shared/ui/DataTable';
import { useTableData } from '@/shared/hooks/useTableData';
import { api } from '@/lib/api';
import UserDetailDrawer from './components/UserDetailDrawer';

const { confirm } = Modal;

interface User {
  user_id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  email?: string;
  phone?: string;
  role: string;
  status: 'active' | 'banned';
  created_at: string;
  membership_level?: string;
}

const DEFAULT_FILTERS = {
  role: '',
  status: '',
  keyword: '',
};

export default function UsersPage() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // ========== 使用useTableData Hook统一管理状态 ==========
  const tableData = useTableData<User>({
    fetcher: async ({ pagination, filters }) => {
      const response: any = await api.admin.getUsers({
        limit: pagination.pageSize,
        offset: (pagination.page - 1) * pagination.pageSize,
        role: filters.role || undefined,
        status: filters.status || undefined,
        keyword: filters.keyword || undefined,
      });

      return {
        items: response.users || [],
        total: response.total || 0,
      };
    },
    autoLoad: true,
    initialFilters: DEFAULT_FILTERS,
  });

  // ========== 操作处理函数 ==========
  const handleToggleStatus = (user: User) => {
    const isBanned = user.status === 'banned';
    const actionText = isBanned ? '解封' : '封禁';

    confirm({
      title: `确认${actionText}`,
      content: `确定要${actionText}用户 "${user.nickname || user.username}" 吗？`,
      okText: '确定',
      okType: isBanned ? 'primary' : 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 调用后端API更新状态
          await api.admin.updateUser(user.user_id, { status: isBanned ? 'active' : 'banned' });
          message.success(`用户已${actionText}`);
          tableData.refresh();
        } catch (error: any) {
          message.error('操作失败');
        }
      },
    });
  };

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setDrawerVisible(true);
  };

  // ========== FilterBar配置 ==========
  const filterConfig: FilterConfig[] = [
    {
      type: FilterType.INPUT,
      key: 'keyword',
      label: '搜索',
      placeholder: '用户名/手机号/邮箱',
      allowClear: true,
    },
    {
      type: FilterType.SELECT,
      key: 'role',
      label: '角色',
      placeholder: '全部角色',
      options: [
        { label: '全部', value: '' },
        { label: '普通用户', value: 'user' },
        { label: '管理员', value: 'admin' },
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
        { label: '封禁', value: 'banned' },
      ],
      allowClear: true,
    },
  ];

  // ========== DataTable列配置 ==========
  const columns: DataTableColumn<User>[] = [
    {
      title: '用户',
      key: 'user',
      width: 250,
      render: (_: any, record: User) => (
        <Space className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => handleViewUser(record)}>
          <Avatar src={record.avatar} icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>{record.nickname || record.username}</div>
            <div style={{ fontSize: 12, color: '#999' }}>ID: {record.user_id}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '联系方式',
      key: 'contact',
      width: 200,
      render: (_: any, record: User) => (
        <div>
          {record.phone && <div>📱 {record.phone}</div>}
          {record.email && <div>📧 {record.email}</div>}
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'gold' : 'blue'}>
          {role === 'admin' ? '管理员' : '用户'}
        </Tag>
      ),
    },
    {
      title: '会员等级',
      dataIndex: 'membership_level',
      key: 'membership_level',
      width: 120,
      render: (level: string) => (
        level ? <Tag color="purple" icon={<CrownOutlined />}>{level}</Tag> : '-'
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'success' : 'error'} icon={status === 'active' ? <CheckCircleOutlined /> : <StopOutlined />}>
          {status === 'active' ? '正常' : '封禁'}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_: any, record: User) => (
        <Space>
          <Tooltip title="查看详情">
            <Button type="text" icon={<EyeOutlined />} onClick={() => handleViewUser(record)} />
          </Tooltip>
          <Button
            type="link"
            danger={record.status === 'active'}
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === 'active' ? '封禁' : '解封'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
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
        rowKey="user_id"
        pagination={{
          page: tableData.pagination.page,
          pageSize: tableData.pagination.pageSize,
          total: tableData.pagination.total,
          onChange: tableData.pagination.goToPage,
        }}
        scroll={{ x: 1200 }}
      />

      <UserDetailDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        user={selectedUser}
      />
    </div>
  );
}
