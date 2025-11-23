/**
 * Pipeline执行历史页面
 * 艹！显示所有Pipeline执行记录，支持筛选、查看详情和实时更新！
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Select,
  Input,
  Drawer,
  Row,
  Col,
  Statistic,
  message,
  Typography,
  Divider,
  Timeline,
  Alert,
  Empty,
  Spin,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const { Text, Title } = Typography;
const { Option } = Select;

/**
 * 执行记录类型
 */
interface ExecutionRecord {
  id: string;
  schema_id: string;
  schema_name?: string;
  execution_mode: 'sync' | 'async' | 'manual';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  error_details?: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
  updated_at?: string;
}

/**
 * 统计数据类型
 */
interface ExecutionStats {
  total: number;
  byStatus: Record<string, number>;
  byMode: Record<string, number>;
  avgDuration: number;
  successRate: number;
}

/**
 * Pipeline执行历史页面组件
 */
const ExecutionsPage: React.FC = () => {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // 筛选状态
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterSchemaId, setFilterSchemaId] = useState<string | undefined>();
  const [searchKeyword, setSearchKeyword] = useState('');

  // 分页
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 详情抽屉
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);

  /**
   * 加载执行列表
   */
  const loadExecutions = async () => {
    try {
      setLoading(true);
      const response = await api.pipeline.getExecutions({
        status: filterStatus,
        schema_id: filterSchemaId,
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
      });

      if (response.success && response.data) {
        setExecutions(response.data.items || []);
        setPagination((prev) => ({
          ...prev,
          total: response.data.total || 0,
        }));
      }
    } catch (error) {
      console.error('[ExecutionsPage] 加载执行列表失败:', error);
      message.error('加载执行列表失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载统计数据
   */
  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const response = await api.pipeline.getExecutionStats();

      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('[ExecutionsPage] 加载统计数据失败:', error);
      message.error('加载统计数据失败');
    } finally {
      setStatsLoading(false);
    }
  };

  /**
   * 查看执行详情
   */
  const handleViewDetail = async (record: ExecutionRecord) => {
    try {
      const response = await api.pipeline.getExecution(record.id);

      if (response.success && response.data) {
        setSelectedExecution(response.data);
        setDetailDrawerVisible(true);
      }
    } catch (error) {
      console.error('[ExecutionsPage] 加载执行详情失败:', error);
      message.error('加载执行详情失败');
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadExecutions();
    loadStats();
  }, [filterStatus, filterSchemaId, pagination.current, pagination.pageSize]);

  /**
   * 自动刷新（每30秒）
   */
  useEffect(() => {
    const interval = setInterval(() => {
      loadExecutions();
      loadStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [filterStatus, filterSchemaId, pagination.current, pagination.pageSize]);

  /**
   * 状态标签渲染
   */
  const renderStatusTag = (status: ExecutionRecord['status']) => {
    const statusConfig = {
      pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待中' },
      running: { color: 'processing', icon: <SyncOutlined spin />, text: '执行中' },
      completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
      cancelled: { color: 'warning', icon: <CloseCircleOutlined />, text: '已取消' },
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  /**
   * 执行模式标签渲染
   */
  const renderModeTag = (mode: ExecutionRecord['execution_mode']) => {
    const modeConfig = {
      sync: { color: 'blue', text: '同步' },
      async: { color: 'cyan', text: '异步' },
      manual: { color: 'purple', text: '手动' },
    };

    const config = modeConfig[mode] || modeConfig.sync;

    return <Tag color={config.color}>{config.text}</Tag>;
  };

  /**
   * 表格列定义
   */
  const columns: ColumnsType<ExecutionRecord> = [
    {
      title: '执行ID',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      ellipsis: true,
      render: (id: string) => (
        <Text copyable={{ text: id }} style={{ fontSize: 12 }}>
          {id.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: 'Schema名称',
      dataIndex: 'schema_name',
      key: 'schema_name',
      width: 180,
      ellipsis: true,
      render: (name: string, record) => (
        <Text strong>{name || record.schema_id.slice(0, 8) + '...'}</Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: renderStatusTag,
    },
    {
      title: '模式',
      dataIndex: 'execution_mode',
      key: 'execution_mode',
      width: 100,
      render: renderModeTag,
    },
    {
      title: '执行时长',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      width: 120,
      render: (duration: number | undefined) => {
        if (!duration) return <Text type="secondary">-</Text>;
        if (duration < 1000) return <Text>{duration}ms</Text>;
        if (duration < 60000) return <Text>{(duration / 1000).toFixed(2)}s</Text>;
        return <Text>{(duration / 60000).toFixed(2)}min</Text>;
      },
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      render: (startedAt: string | undefined) => {
        if (!startedAt) return <Text type="secondary">-</Text>;
        return (
          <Text style={{ fontSize: 12 }}>
            {formatDistanceToNow(new Date(startedAt), { addSuffix: true, locale: zhCN })}
          </Text>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_: any, record: ExecutionRecord) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={3}>Pipeline执行历史</Title>
        <Text type="secondary">查看所有Pipeline执行记录和统计信息</Text>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card loading={statsLoading}>
              <Statistic
                title="总执行次数"
                value={stats.total}
                prefix={<SyncOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card loading={statsLoading}>
              <Statistic
                title="成功率"
                value={stats.successRate}
                suffix="%"
                precision={1}
                valueStyle={{ color: stats.successRate >= 90 ? '#3f8600' : '#cf1322' }}
                prefix={
                  stats.successRate >= 90 ? <CheckCircleOutlined /> : <CloseCircleOutlined />
                }
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card loading={statsLoading}>
              <Statistic
                title="平均耗时"
                value={stats.avgDuration / 1000}
                suffix="秒"
                precision={2}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card loading={statsLoading}>
              <Statistic
                title="执行中"
                value={stats.byStatus?.running || 0}
                valueStyle={{ color: '#1890ff' }}
                prefix={<SyncOutlined spin />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 筛选和操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <Space>
            <FilterOutlined />
            <Text strong>筛选：</Text>
          </Space>

          <Select
            placeholder="选择状态"
            allowClear
            style={{ width: 120 }}
            value={filterStatus}
            onChange={setFilterStatus}
          >
            <Option value="pending">等待中</Option>
            <Option value="running">执行中</Option>
            <Option value="completed">已完成</Option>
            <Option value="failed">失败</Option>
            <Option value="cancelled">已取消</Option>
          </Select>

          <Input
            placeholder="Schema ID"
            allowClear
            style={{ width: 200 }}
            value={filterSchemaId}
            onChange={(e) => setFilterSchemaId(e.target.value || undefined)}
          />

          <Input
            placeholder="搜索关键词"
            allowClear
            style={{ width: 200 }}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />

          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadExecutions();
              loadStats();
            }}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </Card>

      {/* 执行列表表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={executions}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setPagination((prev) => ({
                ...prev,
                current: page,
                pageSize: pageSize || prev.pageSize,
              }));
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title="执行详情"
        placement="right"
        width={720}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedExecution(null);
        }}
      >
        {selectedExecution ? (
          <div>
            {/* 基本信息 */}
            <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text type="secondary">执行ID：</Text>
                  <br />
                  <Text copyable={{ text: selectedExecution.id }}>
                    {selectedExecution.id}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Schema ID：</Text>
                  <br />
                  <Text copyable={{ text: selectedExecution.schema_id }}>
                    {selectedExecution.schema_id}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">状态：</Text>
                  <br />
                  {renderStatusTag(selectedExecution.status)}
                </Col>
                <Col span={12}>
                  <Text type="secondary">执行模式：</Text>
                  <br />
                  {renderModeTag(selectedExecution.execution_mode)}
                </Col>
                <Col span={12}>
                  <Text type="secondary">开始时间：</Text>
                  <br />
                  <Text>
                    {selectedExecution.started_at
                      ? new Date(selectedExecution.started_at).toLocaleString('zh-CN')
                      : '-'}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">完成时间：</Text>
                  <br />
                  <Text>
                    {selectedExecution.completed_at
                      ? new Date(selectedExecution.completed_at).toLocaleString('zh-CN')
                      : '-'}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">执行时长：</Text>
                  <br />
                  <Text>
                    {selectedExecution.duration_ms
                      ? `${(selectedExecution.duration_ms / 1000).toFixed(2)}秒`
                      : '-'}
                  </Text>
                </Col>
              </Row>
            </Card>

            {/* 输入数据 */}
            {selectedExecution.input_data && (
              <Card title="输入数据" size="small" style={{ marginBottom: 16 }}>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: '12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                    maxHeight: '200px',
                  }}
                >
                  {JSON.stringify(selectedExecution.input_data, null, 2)}
                </pre>
              </Card>
            )}

            {/* 输出数据 */}
            {selectedExecution.output_data && (
              <Card title="输出数据" size="small" style={{ marginBottom: 16 }}>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: '12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                    maxHeight: '200px',
                  }}
                >
                  {JSON.stringify(selectedExecution.output_data, null, 2)}
                </pre>
              </Card>
            )}

            {/* 错误信息 */}
            {selectedExecution.error_message && (
              <Card title="错误信息" size="small" style={{ marginBottom: 16 }}>
                <Alert
                  message={selectedExecution.error_message}
                  type="error"
                  showIcon
                  description={
                    selectedExecution.error_details && (
                      <pre
                        style={{
                          marginTop: 8,
                          background: '#fff2f0',
                          padding: '8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          overflow: 'auto',
                          maxHeight: '150px',
                        }}
                      >
                        {JSON.stringify(selectedExecution.error_details, null, 2)}
                      </pre>
                    )
                  }
                />
              </Card>
            )}
          </div>
        ) : (
          <Empty description="未选择执行记录" />
        )}
      </Drawer>
    </div>
  );
};

export default ExecutionsPage;
