/**
 * 节点配置面板（Inspector）
 * 艹！用于配置选中节点的参数，集成VarPicker和Monaco编辑器！
 */

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, Space, message, Divider, Spin } from 'antd';
import { VarPicker, buildDefaultVarTree, validateVarReferences } from '@/components/flow/VarPicker';
import type { VarNode } from '@/components/flow/VarPicker';
import type { VarNode as MonacoVarNode } from '@/components/common/MonacoEditor';
import dynamic from 'next/dynamic';
import api from '@/lib/api';

// 艹！动态导入Monaco编辑器，避免SSR问题！
const MonacoEditor = dynamic(() => import('@/components/common/MonacoEditor'), {
  ssr: false,
  loading: () => <div style={{ padding: '48px', textAlign: 'center' }}>Monaco编辑器加载中...</div>,
});

const { TextArea } = Input;

const mapVarsToMonaco = (nodes: VarNode[]): MonacoVarNode[] => {
  return nodes.map((node) => ({
    label: node.title,
    path: node.path,
    type: (node.type as MonacoVarNode['type']) || 'string',
    description: `${node.source}变量`,
    children: node.children ? mapVarsToMonaco(node.children) : undefined,
  }));
};

/**
 * 节点Inspector Props
 */
export interface NodeInspectorProps {
  /** 选中的节点ID */
  nodeId?: string;

  /** 节点类型 */
  nodeType?: string;

  /** 节点配置数据 */
  nodeData?: any;

  /** 可用的上游节点（用于构建变量树） */
  upstreamNodes?: Array<{ nodeId: string; outputs: string[] }>;

  /** 表单字段（用于构建form变量） */
  formFields?: string[];

  /** 配置变更回调 */
  onChange?: (nodeId: string, data: any) => void;
}

/**
 * 节点Inspector组件
 * 艹！这个组件让用户配置节点参数，集成变量选择器！
 */
export const NodeInspector: React.FC<NodeInspectorProps> = ({
  nodeId,
  nodeType,
  nodeData = {},
  upstreamNodes = [],
  formFields = [],
  onChange,
}) => {
  const [form] = Form.useForm();
  const [showVarPicker, setShowVarPicker] = useState(false);
  const [currentField, setCurrentField] = useState<string>('');
  const [providers, setProviders] = useState<string[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');

  /**
   * 构建可用变量树
   * 艹！根据上游节点和表单字段动态构建！
   */
  const availableVars: VarNode[] = useMemo(
    () =>
      buildDefaultVarTree({
        formFields,
        nodeOutputs: upstreamNodes,
      }),
    [formFields, upstreamNodes],
  );

  const monacoVars = useMemo(() => mapVarsToMonaco(availableVars), [availableVars]);

  /**
   * 加载已注册的Provider列表
   */
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoadingProviders(true);
        const response = await api.provider.getRegisteredProviders();
        if (response.data.success && response.data.data) {
          // response.data.data 是一个字符串数组，包含所有已注册的provider名称
          setProviders(response.data.data);
        }
      } catch (error) {
        console.error('[NodeInspector] 加载Provider列表失败:', error);
        message.error('加载Provider列表失败');
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchProviders();
  }, []);

  /**
   * 处理变量选择
   * 艹！将选中的变量插入到当前编辑的字段！
   */
  const handleVarSelect = (varPath: string) => {
    if (!currentField) return;

    const currentValue = form.getFieldValue(currentField) || '';
    const newValue = currentValue + varPath;

    form.setFieldValue(currentField, newValue);
    message.success(`已插入变量: ${varPath}`);
  };

  /**
   * 打开变量选择器
   */
  const openVarPicker = (fieldName: string) => {
    setCurrentField(fieldName);
    setShowVarPicker(true);
  };

  /**
   * 保存配置
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // 艹！校验变量引用
      const inputMapping = values.inputMapping || '';
      const validation = validateVarReferences(inputMapping, availableVars);

      if (!validation.isValid) {
        message.error(
          `发现${validation.undefinedPaths.length}个未定义的变量: ${validation.undefinedPaths.join(', ')}`
        );
        return;
      }

      if (nodeId) {
        onChange?.(nodeId, values);
        message.success('配置已保存');
      }
    } catch (error) {
      console.error('[NodeInspector] 保存失败', error);
    }
  };

  if (!nodeId) {
    return (
      <Card title="节点配置">
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          请选择一个节点进行配置
        </div>
      </Card>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <Card title={`配置节点: ${nodeType || nodeId}`}>
        <Form
          form={form}
          layout="vertical"
          initialValues={nodeData}
          onFinish={handleSave}
        >
          {/* Provider类型 */}
          <Form.Item
            label="Provider类型"
            name="providerType"
            rules={[{ required: true, message: '请选择Provider类型' }]}
          >
            <Select
              placeholder="选择Provider类型"
              loading={loadingProviders}
              notFoundContent={loadingProviders ? <Spin size="small" /> : '暂无可用Provider'}
              onChange={(value) => setSelectedProvider(value)}
            >
              {providers.map((provider) => (
                <Select.Option key={provider} value={provider}>
                  {provider}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* Provider引用 */}
          <Form.Item
            label="Provider引用"
            name="providerRef"
            tooltip="从Provider管理中选择已配置的Provider实例"
          >
            <Input placeholder="provider-ref-id" />
          </Form.Item>

          {/* 超时时间 */}
          <Form.Item label="超时时间 (ms)" name="timeout" initialValue={30000}>
            <Input type="number" placeholder="30000" />
          </Form.Item>

          {/* LLM Provider专用配置 */}
          {selectedProvider?.startsWith('llm_') && (
            <>
              <Divider>LLM配置</Divider>

              {/* Model选择 */}
              <Form.Item
                label="模型"
                name={['parameters', 'model']}
                tooltip="选择要使用的AI模型"
              >
                <Select placeholder="选择模型">
                  {selectedProvider === 'llm_openai' && (
                    <>
                      <Select.Option value="gpt-4">GPT-4</Select.Option>
                      <Select.Option value="gpt-4o">GPT-4o</Select.Option>
                      <Select.Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Select.Option>
                    </>
                  )}
                  {selectedProvider === 'llm_claude' && (
                    <>
                      <Select.Option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</Select.Option>
                      <Select.Option value="claude-3-opus-20240229">Claude 3 Opus</Select.Option>
                      <Select.Option value="claude-3-haiku-20240307">Claude 3 Haiku</Select.Option>
                    </>
                  )}
                  {selectedProvider === 'llm_qwen' && (
                    <>
                      <Select.Option value="qwen-max">通义千问 Max</Select.Option>
                      <Select.Option value="qwen-plus">通义千问 Plus</Select.Option>
                      <Select.Option value="qwen-turbo">通义千问 Turbo</Select.Option>
                      <Select.Option value="qwen-vl-plus">通义千问 VL Plus (多模态)</Select.Option>
                    </>
                  )}
                </Select>
              </Form.Item>

              {/* Prompt */}
              <Form.Item
                label="提示词 (Prompt)"
                name={['parameters', 'prompt']}
                rules={[{ required: true, message: '请输入提示词' }]}
                tooltip="AI的任务指令，支持变量引用 {{variableName}}"
              >
                <Input.TextArea
                  rows={4}
                  placeholder="例如: 请分析这张图片的内容，描述其中的主要元素..."
                />
              </Form.Item>

              {/* System Prompt */}
              <Form.Item
                label="系统提示词 (System Prompt)"
                name={['parameters', 'systemPrompt']}
                tooltip="定义AI的角色和行为方式"
              >
                <Input.TextArea
                  rows={2}
                  placeholder="例如: 你是一个专业的图片分析助手..."
                />
              </Form.Item>

              {/* Temperature */}
              <Form.Item
                label={`创造性 (Temperature): ${form.getFieldValue(['parameters', 'temperature']) || 0.7}`}
                name={['parameters', 'temperature']}
                initialValue={0.7}
                tooltip="0=严格确定性输出, 2=高度创造性输出"
              >
                <Input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    form.setFieldValue(['parameters', 'temperature'], value);
                  }}
                />
              </Form.Item>

              {/* Max Tokens */}
              <Form.Item
                label="最大Token数"
                name={['parameters', 'maxTokens']}
                initialValue={2000}
                tooltip="限制AI响应的长度"
              >
                <Input type="number" placeholder="2000" />
              </Form.Item>

              {/* Image URL (可选) */}
              <Form.Item
                label="图片URL (可选)"
                name={['parameters', 'imageUrl']}
                tooltip="用于多模态模型，支持变量引用 {{form.imageUrl}}"
              >
                <Input placeholder="{{nodeId.imageUrl}}" />
              </Form.Item>
            </>
          )}

          <Divider>输入映射</Divider>

          {/* 输入映射 */}
          <Form.Item
            label={
              <Space>
                <span>输入映射 (JSON)</span>
                <Button size="small" onClick={() => openVarPicker('inputMapping')}>
                  选择变量
                </Button>
              </Space>
            }
            name="inputMapping"
            tooltip="使用{{}}占位符引用变量，输入{{自动补全可用变量"
          >
            <MonacoEditor
              value={form.getFieldValue('inputMapping') || '{\n  "url": "{{form.imageUrl}}",\n  "userId": "{{system.userId}}"\n}'}
              onChange={(value) => form.setFieldValue('inputMapping', value)}
              language="json"
              height={250}
              theme="vs-dark"
              showActions={true}
              enableVarCompletion={true}
              availableVars={monacoVars}
            />
          </Form.Item>

          {/* 输出映射 */}
          <Form.Item
            label="输出字段名"
            name="outputKey"
            tooltip="定义此节点的输出字段名，可被下游节点引用"
          >
            <Input placeholder="result" />
          </Form.Item>

          {/* 保存按钮 */}
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存配置
              </Button>
              <Button onClick={() => form.resetFields()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 变量选择器（Drawer或Modal） */}
      {showVarPicker && (
        <Card
          title="选择变量"
          style={{ marginTop: '16px' }}
          extra={
            <Button onClick={() => setShowVarPicker(false)}>关闭</Button>
          }
        >
          <VarPicker
            variables={availableVars}
            onSelect={handleVarSelect}
            showValidation={true}
            height={300}
          />
        </Card>
      )}
    </div>
  );
};

export default NodeInspector;
