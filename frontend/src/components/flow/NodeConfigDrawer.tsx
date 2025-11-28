'use client';

/**
 * 节点配置侧边栏
 * 艹，这个tm负责配置选中的Pipeline节点！
 */

import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Space,
  Divider,
  Typography,
  Tag,
  message,
  Card,
  Alert,
} from 'antd';
import {
  ApiOutlined,
  BranchesOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Node } from '@xyflow/react';
import { adminProviders } from '@/lib/services/adminProviders';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * Props接口
 */
export interface NodeConfigDrawerProps {
  open: boolean;
  node: Node | null;
  onClose: () => void;
  onSave: (nodeId: string, data: any) => void;
  availableVariables?: string[]; // 可用的变量列表
}

/**
 * 节点配置Drawer
 * 艹，根据节点类型渲染不同的配置表单！
 */
export default function NodeConfigDrawer({
  open,
  node,
  onClose,
  onSave,
  availableVariables = [],
}: NodeConfigDrawerProps) {
  const [form] = Form.useForm();
  const [providers, setProviders] = useState<any[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  /**
   * 加载Provider列表
   * 艹，从后端API获取所有可用的Provider！
   */
  const loadProviders = async () => {
    setLoadingProviders(true);
    try {
      const response = await adminProviders.list({ limit: 100, offset: 0 });
      setProviders(response.items || []);
    } catch (error: any) {
      console.error('[加载Provider失败]', error);
      message.error('加载Provider列表失败');
    } finally {
      setLoadingProviders(false);
    }
  };

  /**
   * 打开Drawer时加载数据
   */
  useEffect(() => {
    if (open && node?.type === 'provider') {
      loadProviders();
    }
  }, [open, node?.type]);

  /**
   * 当选中的节点变化时，更新表单值
   */
  useEffect(() => {
    if (node) {
      form.setFieldsValue({
        label: node.data.label || '',
        providerRef: node.data.providerRef || undefined,
        prompt: node.data.prompt || '',
        condition: node.data.condition || '',
        processor: node.data.processor || '',
        outputKey: node.data.outputKey || '',
      });
    }
  }, [node, form]);

  /**
   * 保存配置
   * 艹，把表单数据更新到节点！
   */
  const handleSave = () => {
    form.validateFields().then((values) => {
      if (!node) return;

      console.log('[保存节点配置]', values);
      onSave(node.id, values);
      message.success('节点配置已保存');
      onClose();
    });
  };

  /**
   * 获取节点图标
   */
  const getNodeIcon = (type?: string) => {
    switch (type) {
      case 'provider':
        return <ApiOutlined style={{ fontSize: '20px', color: '#1890ff' }} />;
      case 'condition':
        return <BranchesOutlined style={{ fontSize: '20px', color: '#52c41a' }} />;
      case 'postProcess':
        return <ToolOutlined style={{ fontSize: '20px', color: '#faad14' }} />;
      case 'end':
        return <CheckCircleOutlined style={{ fontSize: '20px', color: '#f5222d' }} />;
      default:
        return <InfoCircleOutlined style={{ fontSize: '20px', color: '#999' }} />;
    }
  };

  /**
   * 获取节点类型标签
   */
  const getNodeTypeTag = (type?: string) => {
    switch (type) {
      case 'provider':
        return <Tag color="blue">Provider节点</Tag>;
      case 'condition':
        return <Tag color="green">条件节点</Tag>;
      case 'postProcess':
        return <Tag color="orange">后处理节点</Tag>;
      case 'end':
        return <Tag color="red">结束节点</Tag>;
      default:
        return <Tag>未知节点</Tag>;
    }
  };

  /**
   * 渲染配置表单内容
   * 艹，根据节点类型渲染不同的表单！
   */
  const renderFormContent = () => {
    if (!node) return null;

    const nodeType = node.type;

    // 通用字段：节点名称
    const commonFields = (
      <Form.Item
        label="节点名称"
        name="label"
        rules={[{ required: true, message: '请输入节点名称' }]}
      >
        <Input placeholder="输入节点名称" />
      </Form.Item>
    );

    switch (nodeType) {
      // ========== Provider节点配置 ==========
      case 'provider':
        return (
          <>
            {commonFields}

            {providers.length === 0 && !loadingProviders ? (
              <div style={{ marginBottom: 24 }}>
                <Alert
                  message="暂无可用AI模型"
                  description={
                    <span>
                      系统未检测到可用的AI模型服务商。请先前往 <a href="/admin/providers">系统运维 - 模型服务商</a> 进行配置。
                    </span>
                  }
                  type="warning"
                  showIcon
                />
              </div>
            ) : (
              <Form.Item
                label="选择AI模型"
                name="providerRef"
                rules={[{ required: true, message: '请选择一个AI模型' }]}
                tooltip="选择用于处理任务的AI模型服务"
              >
                <Select
                  placeholder="请选择一个AI模型"
                  loading={loadingProviders}
                  showSearch
                  optionFilterProp="label"
                  options={providers.map((p) => ({
                    label: `${p.provider_name} (${p.provider_ref})`,
                    value: p.provider_ref,
                  }))}
                />
              </Form.Item>
            )}

            <Form.Item
              label="提示词 (Prompt)"
              name="prompt"
              tooltip="告诉AI模型你想做什么。可以使用 {{变量名}} 来插入动态内容。"
            >
              <TextArea
                rows={6}
                placeholder="输入Prompt模板，例如：\n\n根据以下信息生成回答：\n{{user_input}}\n\n请用中文回答。"
              />
            </Form.Item>

            {/* 可用变量提示 */}
            {availableVariables.length > 0 && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  💡 可用变量：
                </Text>
                <div style={{ marginTop: 8 }}>
                  {availableVariables.map((varName) => (
                    <Tag
                      key={varName}
                      color="cyan"
                      style={{ cursor: 'pointer', marginBottom: 4 }}
                      onClick={() => {
                        const currentPrompt = form.getFieldValue('prompt') || '';
                        form.setFieldsValue({
                          prompt: currentPrompt + `{{${varName}}}`,
                        });
                      }}
                    >
                      {`{{${varName}}}`}
                    </Tag>
                  ))}
                </div>
              </Card>
            )}
          </>
        );

      // ========== 条件节点配置 ==========
      case 'condition':
        return (
          <>
            {commonFields}

            <Form.Item
              label="条件表达式"
              name="condition"
              rules={[{ required: true, message: '请输入条件表达式' }]}
              tooltip="JavaScript表达式，返回true/false"
            >
              <TextArea
                rows={4}
                placeholder="输入条件表达式，例如：\n\noutput.quality > 0.8 && output.length > 100"
              />
            </Form.Item>

            {/* 可用变量提示 */}
            {availableVariables.length > 0 && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  💡 可用变量：
                </Text>
                <div style={{ marginTop: 8 }}>
                  {availableVariables.map((varName) => (
                    <Tag key={varName} color="cyan" style={{ marginBottom: 4 }}>
                      {varName}
                    </Tag>
                  ))}
                </div>
              </Card>
            )}
          </>
        );

      // ========== 后处理节点配置 ==========
      case 'postProcess':
        return (
          <>
            {commonFields}

            <Form.Item
              label="处理器类型"
              name="processor"
              rules={[{ required: true, message: '请选择处理器类型' }]}
            >
              <Select
                placeholder="选择后处理器"
                options={[
                  { label: '文本增强 (enhance)', value: 'enhance' },
                  { label: '格式化JSON (json)', value: 'json' },
                  { label: '提取关键词 (keywords)', value: 'keywords' },
                  { label: '摘要生成 (summary)', value: 'summary' },
                  { label: '翻译 (translate)', value: 'translate' },
                ]}
              />
            </Form.Item>

            <Form.Item label="处理参数" name="processorParams">
              <TextArea
                rows={4}
                placeholder='输入JSON格式的参数，例如：\n\n{\n  "language": "zh-CN",\n  "maxLength": 100\n}'
              />
            </Form.Item>
          </>
        );

      // ========== 结束节点配置 ==========
      case 'end':
        return (
          <>
            {commonFields}

            <Form.Item
              label="输出变量名"
              name="outputKey"
              tooltip="最终输出的变量名"
            >
              <Input placeholder="例如：final_result" />
            </Form.Item>

            <Card size="small">
              <Text type="secondary" style={{ fontSize: '12px' }}>
                💡 提示：结束节点标志Pipeline执行完成，可以指定输出变量名。
              </Text>
            </Card>
          </>
        );

      default:
        return (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#999' }}>
            <InfoCircleOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <p>不支持的节点类型</p>
          </div>
        );
    }
  };

  return (
    <Drawer
      title={
        <Space>
          {getNodeIcon(node?.type)}
          <span>节点配置</span>
          {node && getNodeTypeTag(node.type)}
        </Space>
      }
      width={500}
      open={open}
      onClose={onClose}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            保存配置
          </Button>
        </Space>
      }
    >
      {node && (
        <>
          <div
            style={{
              padding: '12px 16px',
              background: '#f0f2f5',
              borderRadius: '4px',
              marginBottom: '24px',
            }}
          >
            <Text type="secondary" style={{ fontSize: '12px' }}>
              节点ID: <Text code>{node.id}</Text>
            </Text>
          </div>

          <Form form={form} layout="vertical" autoComplete="off">
            {renderFormContent()}
          </Form>
        </>
      )}
    </Drawer>
  );
}
