/**
 * DataTable 通用表格组件
 * Visionary Theme: Bento Card Style
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Table, Space, Button, Alert, Empty } from 'antd';
import type { TableProps as AntTableProps } from 'antd';
import type { DataTableProps } from './types';

/**
 * DataTable 组件
 */
export function DataTable<T extends Record<string, any> = any>({
  columns,
  dataSource = [],
  loading = false,
  pagination,
  rowSelection: enableRowSelection = false,
  onRowSelectionChange,
  batchActions = [],
  bordered = false, // 默认关闭边框，使用 Visionary 风格
  size = 'middle',
  showHeader = true,
  emptyText = '暂无数据',
  emptyRender,
  title,
  toolbar,
  rowKey = 'id',
  ...restProps
}: DataTableProps<T>) {
  // 选中的行
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<T[]>([]);

  /**
   * 过滤掉隐藏的列
   */
  const visibleColumns = useMemo(() => {
    return columns
      .filter((col) => !col.hidden)
      .map((col) => ({
        ...col,
        dataIndex: col.dataIndex || col.key,
      })) as any[];
  }, [columns]);

  /**
   * 处理行选择变化
   */
  const handleRowSelectionChange = (keys: React.Key[], rows: T[]) => {
    setSelectedRowKeys(keys);
    setSelectedRows(rows);
    onRowSelectionChange?.(keys, rows);
  };

  /**
   * 清空选择
   */
  const clearSelection = () => {
    setSelectedRowKeys([]);
    setSelectedRows([]);
    onRowSelectionChange?.([], []);
  };

  /**
   * 行选择配置
   */
  const rowSelectionConfig = enableRowSelection
    ? {
      selectedRowKeys,
      onChange: handleRowSelectionChange,
      preserveSelectedRowKeys: true,
    }
    : undefined;

  /**
   * 分页配置
   */
  const paginationConfig = pagination
    ? {
      current: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      showSizeChanger: true,
      showQuickJumper: true,
      showTotal: (total: number) => `共 ${total} 条`,
      onChange: (page: number, pageSize: number) => {
        pagination.onChange(page, pageSize);
        clearSelection(); // 换页时清空选择
      },
      // Visionary Pagination Style
      itemRender: (page: number, type: 'page' | 'prev' | 'next' | 'jump-prev' | 'jump-next', originalElement: React.ReactNode) => {
        return originalElement;
      }
    }
    : false;

  /**
   * 渲染批量操作栏
   */
  const renderBatchActions = () => {
    if (!enableRowSelection || batchActions.length === 0) {
      return null;
    }

    if (selectedRowKeys.length === 0) {
      return null;
    }

    return (
      <div className="animate-fade-up" style={{ marginBottom: 16 }}>
        <Alert
          message={
            <Space>
              <span style={{ fontWeight: 500 }}>
                已选择 <strong style={{ color: '#1D1D1F' }}>{selectedRowKeys.length}</strong> 项
              </span>
              <Button type="link" size="small" onClick={clearSelection}>
                清空
              </Button>
              <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.1)', margin: '0 8px' }} />
              {batchActions.map((action) => {
                const isDisabled =
                  action.disabled === true ||
                  (typeof action.disabled === 'function' &&
                    action.disabled(selectedRows));

                return (
                  <Button
                    key={action.key}
                    type={action.danger ? 'primary' : 'default'}
                    danger={action.danger}
                    size="small"
                    icon={action.icon}
                    disabled={isDisabled}
                    onClick={() => {
                      action.onClick(selectedRows, selectedRowKeys);
                    }}
                    style={{ borderRadius: 6 }}
                  >
                    {action.label}
                  </Button>
                );
              })}
            </Space>
          }
          type="info"
          showIcon
          style={{
            borderRadius: 12,
            border: 'none',
            background: 'rgba(24, 144, 255, 0.08)',
          }}
        />
      </div>
    );
  };

  /**
   * 渲染表格标题栏
   */
  const renderTitle = () => {
    if (!title && !toolbar) {
      return null;
    }

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          padding: '0 8px'
        }}
      >
        {title && <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>}
        <div>{toolbar}</div>
      </div>
    );
  };

  /**
   * 自定义空状态
   */
  const locale = {
    emptyText: emptyRender || (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<span style={{ color: '#86868B' }}>{emptyText}</span>}
      />
    ),
  };

  return (
    <div className="bento-card" style={{ padding: 24 }}>
      {/* 标题栏 */}
      {renderTitle()}

      {/* 批量操作栏 */}
      {renderBatchActions()}

      {/* 表格 */}
      <Table<T>
        columns={visibleColumns}
        dataSource={dataSource}
        loading={loading}
        rowKey={rowKey}
        rowSelection={rowSelectionConfig}
        pagination={paginationConfig}
        bordered={bordered}
        size={size}
        showHeader={showHeader}
        locale={locale}
        scroll={{ x: 'max-content' }}
        {...restProps}
        // 覆盖默认样式
        style={{ background: 'transparent' }}
      />
    </div>
  );
}

export default DataTable;
