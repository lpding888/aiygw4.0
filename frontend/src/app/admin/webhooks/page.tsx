'use client';

/**
 * Webhook管理页面
 * 艹！这个页面管理Webhook配置、密钥、日志！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Typography,
  Tabs,
  Divider,
  Alert,
  Tooltip,
  Badge,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  KeyOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ApiOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

/**
 * Webhook配置
 */
interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  secret: string; // 签名密钥
  headers?: Record<string, string>;
  enabled: boolean;
  retry_count?: number; // 重试次数
  timeout?: number; // 超时时间（毫秒）
  events?: string[]; // 监听的事件列表
  created_at: number;
  updated_at: number;
}

/**
 * Webhook调用日志
 */
interface WebhookLog {
  id: string;
  webhook_id: string;
  webhook_name: string;
  event: string;
  url: string;
  method: string;
  status: 'success' | 'failed' | 'retrying';
  status_code?: number;
  request_body?: any;
  response_body?: any;
  error_message?: string;
  duration_ms: number;
  retry_count: number;
  created_at: number;
}

/**
 * Webhook管理页面
 */
export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [testVisible, setTestVisible] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
  const [form] = Form.useForm();
  const [testForm] = Form.useForm();

  /**
   * 加载Webhook列表
   */
  const loadWebhooks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/webhooks');
      if (!response.ok) throw new Error('加载失败');

      const data = await response.json();
      setWebhooks(data.webhooks || []);
    } catch (error: any) {
      message.error(`加载失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载Webhook日志
   */
  const loadLogs = async () => {
    try {
      const response = await fetch('/api/admin/webhooks/logs');
      if (!response.ok) throw new Error('加载日志失败');

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error: any) {
      message.error(`加载日志失败: ${error.message}`);
    }
  };

  useEffect(() => {
    loadWebhooks();
    loadLogs();
  }, []);

  /**
   * 创建Webhook
   */
  const handleCreate = () => {
    setEditingWebhook(null);
    form.resetFields();
    form.setFieldsValue({
      method: 'POST',
      enabled: true,
      retry_count: 3,
      timeout: 5000,
      secret: generateSecret(),
    });
    setEditorVisible(true);
  };

  /**
   * 编辑Webhook
   */
  const handleEdit = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    form.setFieldsValue(webhook);
    setEditorVisible(true);
  };

  /**
   * 保存Webhook
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const webhook: WebhookConfig = {
        id: editingWebhook?.id || `webhook-${Date.now()}`,
        ...values,
        created_at: editingWebhook?.created_at || Date.now(),
        updated_at: Date.now(),
      };

      const response = await fetch('/api/admin/webhooks', {
        method: editingWebhook ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhook),
      });

      if (!response.ok) throw new Error('保存失败');

      message.success(editingWebhook ? 'Webhook已更新' : 'Webhook已创建');
      setEditorVisible(false);
      loadWebhooks();
    } catch (error: any) {
      message.error(`保存失败: ${error.message}`);
    }
  };

  /**
   * 删除Webhook
   */
  const handleDelete = (webhookId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个Webhook吗？',
      onOk: async () => {
        try {
          const response = await fetch(`/api/admin/webhooks/${webhookId}`, { method: 'DELETE' });
          if (!response.ok) throw new Error('删除失败');

          message.success('Webhook已删除');
          loadWebhooks();
        } catch (error: any) {
          message.error(`删除失败: ${error.message}`);
        }
      },
    });
  };

  /**
   * 切换启用状态
   */
  const handleToggle = async (webhook: WebhookConfig, enabled: boolean) => {
    try {
      const response = await fetch('/api/admin/webhooks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...webhook, enabled }),
      });

      if (!response.ok) throw new Error('更新失败');

      message.success(enabled ? '已启用' : '已禁用');
      loadWebhooks();
    } catch (error: any) {
      message.error(`更新失败: ${error.message}`);
    }
  };

  /**
   * 测试Webhook
   */
  const handleTest = (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    testForm.resetFields();
    testForm.setFieldsValue({
      event: 'test.webhook',
      payload: JSON.stringify({ test: true, timestamp: Date.now() }, null, 2),
    });
    setTestVisible(true);
  };

  /**
   * 发送测试请求
   */
  const handleSendTest = async () => {
    try {
      const values = await testForm.validateFields();

      const response = await fetch('/api/admin/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_id: selectedWebhook?.id,
          event: values.event,
          payload: JSON.parse(values.payload),
        }),
      });

      if (!response.ok) throw new Error('测试失败');

      const result = await response.json();
      message.success(`测试成功！响应: ${result.status_code} (${result.duration_ms}ms)`);
      setTestVisible(false);
      loadLogs();
    } catch (error: any) {
      message.error(`测试失败: ${error.message}`);
    }
  };

  /**
   * 生成密钥
   */
  const generateSecret = (): string => {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  };

  /**
   * 复制密钥
   */
  const handleCopySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    message.success('密钥已复制到剪贴板');
  };

  /**
   * 获取统计数据
   */
  const getStats = () => {
    const last24h = logs.filter((log) => log.created_at > Date.now() - 86400000);
    const successCount = last24h.filter((log) => log.status === 'success').length;
    const failedCount = last24h.filter((log) => log.status === 'failed').length;
    const avgDuration = last24h.length > 0
      ? Math.round(last24h.reduce((sum, log) => sum + log.duration_ms, 0) / last24h.length)
      : 0;

    return {
      total: webhooks.length,
      enabled: webhooks.filter((w) => w.enabled).length,
      calls_24h: last24h.length,
      success_rate: last24h.length > 0 ? ((successCount / last24h.length) * 100).toFixed(1) : '0',
      avg_duration: avgDuration,
    };
  };

  const stats = getStats();

  /**
   * Webhook表格列
   */
  const webhookColumns = [
    {
      title: 'Webhook名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, webhook: WebhookConfig) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {webhook.url}
          </Text>
        </Space>
      ),
    },
    {
      title: '请求方法',
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (method: string) => <Tag color="blue">{method}</Tag>,
    },
    {
      title: '事件',
      dataIndex: 'events',
      key: 'events',
      render: (events: string[]) => (
        <Space size={[0, 4]} wrap>
          {events?.slice(0, 3).map((event) => (
            <Tag key={event} style={{ fontSize: 11 }}>
              {event}
            </Tag>
          ))}
          {events?.length > 3 && <Tag>+{events.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled: boolean) => (
        <Badge status={enabled ? 'success' : 'default'} text={enabled ? '已启用' : '已禁用'} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_: any, webhook: WebhookConfig) => (
        <Space size="small">
          <Switch
            size="small"
            checked={webhook.enabled}
            onChange={(checked) => handleToggle(webhook, checked)}
          />
          <Tooltip title="测试">
            <Button size="small" icon={<SendOutlined />} onClick={() => handleTest(webhook)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(webhook)} />
          </Tooltip>
          <Tooltip title="复制密钥">
            <Button size="small" icon={<KeyOutlined />} onClick={() => handleCopySecret(webhook.secret)} />
          </Tooltip>
          <Tooltip title="删除">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(webhook.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  /**
   * 日志表格列
   */
  const logColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: number) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: 'Webhook',
      dataIndex: 'webhook_name',
      key: 'webhook_name',
    },
    {
      title: '事件',
      dataIndex: 'event',
      key: 'event',
      render: (event: string) => <Tag>{event}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string, log: WebhookLog) => {
        if (status === 'success') {
          return (
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text type="success">{log.status_code}</Text>
            </Space>
          );
        } else if (status === 'retrying') {
          return (
            <Space>
              <SyncOutlined spin style={{ color: '#faad14' }} />
              <Text type="warning">重试中</Text>
            </Space>
          );
        } else {
          return (
            <Space>
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              <Text type="danger">{log.status_code || 'Error'}</Text>
            </Space>
          );
        }
      },
    },
    {
      title: '耗时',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      width: 100,
      render: (ms: number) => `${ms}ms`,
    },
    {
      title: '重试',
      dataIndex: 'retry_count',
      key: 'retry_count',
      width: 80,
      render: (count: number) => (count > 0 ? <Badge count={count} /> : '-'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="总Webhook数" value={stats.total} prefix={<ApiOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="已启用" value={stats.enabled} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="24h调用" value={stats.calls_24h} prefix={<SendOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="成功率" value={stats.success_rate} suffix="%" valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="webhooks">
        {/* Webhook配置 */}
        <TabPane
          tab={
            <Space>
              <ApiOutlined />
              Webhook配置
            </Space>
          }
          key="webhooks"
        >
          <Card
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                创建Webhook
              </Button>
            }
          >
            <Table columns={webhookColumns} dataSource={webhooks} rowKey="id" loading={loading} />
          </Card>
        </TabPane>

        {/* 调用日志 */}
        <TabPane
          tab={
            <Space>
              <HistoryOutlined />
              调用日志
              <Badge count={logs.filter((l) => l.status === 'failed').length} />
            </Space>
          }
          key="logs"
        >
          <Card>
            <Table columns={logColumns} dataSource={logs} rowKey="id" pagination={{ pageSize: 20 }} />
          </Card>
        </TabPane>
      </Tabs>

      {/* Webhook编辑器 */}
      <Modal
        title={editingWebhook ? '编辑Webhook' : '创建Webhook'}
        open={editorVisible}
        onCancel={() => setEditorVisible(false)}
        onOk={handleSave}
        width={720}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Webhook名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：客服工单系统" />
          </Form.Item>

          <Form.Item label="URL" name="url" rules={[{ required: true, message: '请输入URL' }]}>
            <Input placeholder="https://api.example.com/webhook" />
          </Form.Item>

          <Form.Item label="请求方法" name="method" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="GET">GET</Select.Option>
              <Select.Option value="POST">POST</Select.Option>
              <Select.Option value="PUT">PUT</Select.Option>
              <Select.Option value="DELETE">DELETE</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="签名密钥" name="secret" rules={[{ required: true }]}>
            <Input.Password
              placeholder="用于签名验证"
              addonAfter={
                <Button size="small" type="link" onClick={() => form.setFieldValue('secret', generateSecret())}>
                  重新生成
                </Button>
              }
            />
          </Form.Item>

          <Form.Item label="监听事件" name="events">
            <Select mode="tags" placeholder="输入事件名称，如 user.login">
              <Select.Option value="user.login">user.login</Select.Option>
              <Select.Option value="nps.submitted">nps.submitted</Select.Option>
              <Select.Option value="quota.low">quota.low</Select.Option>
              <Select.Option value="template.published">template.published</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="重试次数" name="retry_count">
            <Input type="number" placeholder="默认3次" />
          </Form.Item>

          <Form.Item label="超时时间（毫秒）" name="timeout">
            <Input type="number" placeholder="默认5000" />
          </Form.Item>

          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 测试对话框 */}
      <Modal
        title="测试Webhook"
        open={testVisible}
        onCancel={() => setTestVisible(false)}
        onOk={handleSendTest}
        width={600}
        okText="发送测试"
        cancelText="取消"
      >
        <Form form={testForm} layout="vertical">
          <Alert
            message="测试说明"
            description={`将向 ${selectedWebhook?.url} 发送测试请求，并记录到调用日志`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item label="事件名称" name="event" rules={[{ required: true }]}>
            <Input placeholder="test.webhook" />
          </Form.Item>

          <Form.Item label="载荷数据（JSON）" name="payload" rules={[{ required: true }]}>
            <TextArea rows={8} placeholder='{"test": true}' style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
