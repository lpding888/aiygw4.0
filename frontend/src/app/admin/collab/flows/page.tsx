'use client';

/**
 * 审批流管理页面
 * 艹！这个页面用于配置审批流程！
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
  Divider,
  Typography,
  Steps,
  Avatar,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  UserOutlined,
  TeamOutlined,
  BranchesOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Step } = Steps;

/**
 * 审批节点类型
 */
type ApprovalNodeType = 'single' | 'all' | 'any' | 'sequential';

/**
 * 审批节点
 */
interface ApprovalNode {
  id: string;
  name: string;
  type: ApprovalNodeType; // single: 单人, all: 全部通过, any: 任意通过, sequential: 顺序审批
  approvers: string[]; // 审批人ID列表
  auto_approve?: boolean; // 自动通过（如果是发起人）
  timeout_hours?: number; // 超时时间（小时）
}

/**
 * 审批流
 */
interface ApprovalFlow {
  id: string;
  name: string;
  description?: string;
  resource_type: 'template' | 'product' | 'prompt' | 'pipeline' | 'config';
  enabled: boolean;
  nodes: ApprovalNode[];
  created_at: number;
  updated_at: number;
}

/**
 * 团队成员Mock（实际应该从API获取）
 */
const TEAM_MEMBERS = [
  { id: 'user-001', name: '张三（产品经理）', role: 'PM' },
  { id: 'user-002', name: '李四（设计师）', role: 'Designer' },
  { id: 'user-003', name: '王五（开发）', role: 'Dev' },
  { id: 'user-004', name: '赵六（测试）', role: 'QA' },
  { id: 'user-005', name: '孙七（运营）', role: 'Ops' },
];

/**
 * 审批流管理页面
 */
export default function ApprovalFlowsPage() {
  const [flows, setFlows] = useState<ApprovalFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingFlow, setEditingFlow] = useState<ApprovalFlow | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [form] = Form.useForm();

  /**
   * 加载审批流列表
   */
  const loadFlows = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/collab/flows');
      if (!response.ok) throw new Error('加载失败');

      const data = await response.json();
      setFlows(data.flows || []);
    } catch (error: any) {
      message.error(`加载失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
  }, []);

  /**
   * 创建审批流
   */
  const handleCreate = () => {
    setEditingFlow(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      nodes: [
        {
          id: `node-${Date.now()}`,
          name: '审批节点1',
          type: 'single',
          approvers: [],
        },
      ],
    });
    setEditorVisible(true);
  };

  /**
   * 编辑审批流
   */
  const handleEdit = (flow: ApprovalFlow) => {
    setEditingFlow(flow);
    form.setFieldsValue(flow);
    setEditorVisible(true);
  };

  /**
   * 保存审批流
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const flow: ApprovalFlow = {
        id: editingFlow?.id || `flow-${Date.now()}`,
        ...values,
        created_at: editingFlow?.created_at || Date.now(),
        updated_at: Date.now(),
      };

      const response = await fetch('/api/admin/collab/flows', {
        method: editingFlow ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flow),
      });

      if (!response.ok) throw new Error('保存失败');

      message.success(editingFlow ? '审批流已更新' : '审批流已创建');
      setEditorVisible(false);
      loadFlows();
    } catch (error: any) {
      message.error(`保存失败: ${error.message}`);
    }
  };

  /**
   * 删除审批流
   */
  const handleDelete = (flowId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个审批流吗？',
      onOk: async () => {
        try {
          const response = await fetch(`/api/admin/collab/flows/${flowId}`, { method: 'DELETE' });
          if (!response.ok) throw new Error('删除失败');

          message.success('审批流已删除');
          loadFlows();
        } catch (error: any) {
          message.error(`删除失败: ${error.message}`);
        }
      },
    });
  };

  /**
   * 切换启用状态
   */
  const handleToggle = async (flow: ApprovalFlow, enabled: boolean) => {
    try {
      const response = await fetch('/api/admin/collab/flows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...flow, enabled }),
      });

      if (!response.ok) throw new Error('更新失败');

      message.success(enabled ? '已启用' : '已禁用');
      loadFlows();
    } catch (error: any) {
      message.error(`更新失败: ${error.message}`);
    }
  };

  /**
   * 表格列定义
   */
  const columns = [
    {
      title: '流程名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, flow: ApprovalFlow) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {flow.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {flow.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '资源类型',
      dataIndex: 'resource_type',
      key: 'resource_type',
      render: (type: string) => {
        const config: Record<string, { color: string; text: string }> = {
          template: { color: 'blue', text: '模板' },
          product: { color: 'green', text: '产品' },
          prompt: { color: 'purple', text: 'Prompt' },
          pipeline: { color: 'orange', text: '流水线' },
          config: { color: 'red', text: '配置' },
        };
        return <Tag color={config[type]?.color}>{config[type]?.text}</Tag>;
      },
    },
    {
      title: '审批节点',
      dataIndex: 'nodes',
      key: 'nodes',
      render: (nodes: ApprovalNode[]) => (
        <Space>
          <BranchesOutlined />
          <Text>{nodes.length} 个节点</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'success' : 'default'}>{enabled ? '已启用' : '已禁用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: any, flow: ApprovalFlow) => (
        <Space size="small">
          <Switch
            size="small"
            checked={flow.enabled}
            onChange={(checked) => handleToggle(flow, checked)}
          />
          <Tooltip title="编辑">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(flow)} />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => {
                const copy = { ...flow, id: `flow-${Date.now()}`, name: `${flow.name} (副本)` };
                setEditingFlow(copy);
                form.setFieldsValue(copy);
                setEditorVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(flow.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <BranchesOutlined />
            <span>审批流管理</span>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            创建审批流
          </Button>
        }
      >
        <Table columns={columns} dataSource={flows} rowKey="id" loading={loading} />
      </Card>

      {/* 审批流编辑器 */}
      <Modal
        title={editingFlow ? '编辑审批流' : '创建审批流'}
        open={editorVisible}
        onCancel={() => setEditorVisible(false)}
        onOk={handleSave}
        width={720}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="流程名称" name="name" rules={[{ required: true, message: '请输入流程名称' }]}>
            <Input placeholder="例如：模板审批流程" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="流程的详细说明" />
          </Form.Item>

          <Form.Item label="资源类型" name="resource_type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="template">模板</Select.Option>
              <Select.Option value="product">产品</Select.Option>
              <Select.Option value="prompt">Prompt</Select.Option>
              <Select.Option value="pipeline">流水线</Select.Option>
              <Select.Option value="config">配置</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Divider>审批节点配置</Divider>

          <Form.List name="nodes">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`节点 ${index + 1}`}
                    extra={
                      fields.length > 1 && (
                        <Button size="small" danger onClick={() => remove(field.name)}>
                          删除
                        </Button>
                      )
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <Form.Item
                      label="节点名称"
                      name={[field.name, 'name']}
                      rules={[{ required: true, message: '请输入节点名称' }]}
                    >
                      <Input placeholder="例如：部门主管审批" />
                    </Form.Item>

                    <Form.Item label="审批类型" name={[field.name, 'type']} rules={[{ required: true }]}>
                      <Select>
                        <Select.Option value="single">单人审批</Select.Option>
                        <Select.Option value="all">全部通过</Select.Option>
                        <Select.Option value="any">任意通过</Select.Option>
                        <Select.Option value="sequential">顺序审批</Select.Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      label="审批人"
                      name={[field.name, 'approvers']}
                      rules={[{ required: true, message: '请选择审批人' }]}
                    >
                      <Select mode="multiple" placeholder="选择审批人">
                        {TEAM_MEMBERS.map((member) => (
                          <Select.Option key={member.id} value={member.id}>
                            <Space>
                              <Avatar size="small">{member.name[0]}</Avatar>
                              {member.name}
                            </Space>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item label="超时时间（小时）" name={[field.name, 'timeout_hours']}>
                      <Input type="number" placeholder="不设置则无超时限制" />
                    </Form.Item>
                  </Card>
                ))}

                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加审批节点
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
