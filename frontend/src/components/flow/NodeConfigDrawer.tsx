'use client';

/**
 * 节点配置侧边栏 (重构版)
 * 支持基于 Schema 的动态表单渲染，以及变量插入
 */

import React, { useEffect } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  message,
  Card,
  InputNumber,
  Switch,
  Tooltip
} from 'antd';
import {
  ApiOutlined,
  BranchesOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Node } from '@xyflow/react';

const { Text } = Typography;
const { TextArea } = Input;

export interface NodeConfigDrawerProps {
  open: boolean;
  node: Node | null;
  onClose: () => void;
  onSave: (nodeId: string, data: any) => void;
  availableVariables?: string[]; 
}

export default function NodeConfigDrawer({
  open,
  node,
  onClose,
  onSave,
  availableVariables = [],
}: NodeConfigDrawerProps) {
  const [form] = Form.useForm();

  /**
   * 当选中的节点变化时，更新表单值
   */
  useEffect(() => {
    if (node && open) {
      // 将 node.data.params 里的值填入表单
      const initialValues = {
        label: node.data.label,
        ...node.data.params // 动态积木的参数通常存在 params 里
      };
      
      // 兼容旧逻辑
      if (node.type === 'condition') initialValues.condition = node.data.condition;
      if (node.type === 'postProcess') initialValues.processor = node.data.processor;
      
      form.setFieldsValue(initialValues);
    }
  }, [node, open, form]);

  const handleSave = () => {
    form.validateFields().then((values) => {
      if (!node) return;
      
      // 分离 label 和 params
      const { label, ...params } = values;
      
      // 构造新的 data
      const newData = {
        label,
        params: params, // 将所有动态表单的值存入 params
        // 兼容旧字段
        condition: values.condition,
        processor: values.processor
      };

      onSave(node.id, newData);
      message.success('节点配置已保存');
      onClose();
    });
  };

  const insertVariable = (fieldName: string, variable: string) => {
    const currentVal = form.getFieldValue(fieldName) || '';
    form.setFieldsValue({
      [fieldName]: currentVal + `{{${variable}}}`
    });
  };

  /**
   * 渲染动态表单项 (基于 ToolGenerator 生成的 Schema)
   */
  const renderDynamicFields = (schema: any[]) => {
    if (!schema || schema.length === 0) {
      return <Card size="small" style={{ background: '#f5f5f5' }}>该节点无需配置参数</Card>;
    }

    return schema.map((field: any) => {
      const { name, label, type, description, required, default: defaultValue } = field;
      
      let inputComponent;
      // 变量插入按钮
      const suffix = availableVariables.length > 0 && type === 'string' ? (
        <Tooltip title="插入变量">
          <Select 
            style={{ width: 24 }} 
            dropdownMatchSelectWidth={false}
            bordered={false}
            suffixIcon={<PlusOutlined style={{ color: '#1890ff' }} />}
            onSelect={(val) => insertVariable(name, val)}
            options={availableVariables.map(v => ({ label: v, value: v }))}
          />
        </Tooltip>
      ) : null;

      switch (type) {
        case 'number':
          inputComponent = <InputNumber style={{ width: '100%' }} placeholder={defaultValue} />;
          break;
        case 'boolean':
          inputComponent = <Switch />;
          break;
        case 'text': // 长文本
          inputComponent = <TextArea rows={4} placeholder={defaultValue} />;
          break;
        default: // string
          inputComponent = <Input placeholder={defaultValue} suffix={suffix} />;
      }

      return (
        <Form.Item
          key={name}
          label={
            <Space>
              {label || name}
              <Tooltip title={description || name}>
                <InfoCircleOutlined style={{ color: '#999', fontSize: 12 }} />
              </Tooltip>
            </Space>
          }
          name={name}
          rules={[{ required: required, message: `请输入${label}` }]}
          initialValue={defaultValue}
          valuePropName={type === 'boolean' ? 'checked' : 'value'}
        >
          {inputComponent}
        </Form.Item>
      );
    });
  };

  const getNodeIcon = (type?: string) => {
    switch (type) {
      case 'provider': return <ApiOutlined style={{ color: '#1890ff' }} />;
      case 'condition': return <BranchesOutlined style={{ color: '#52c41a' }} />;
      case 'postProcess': return <ToolOutlined style={{ color: '#faad14' }} />;
      default: return <ThunderboltOutlined />;
    }
  };

  const renderFormContent = () => {
    if (!node) return null;

    const commonFields = (
      <Form.Item label="节点名称" name="label" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
    );

    // 1. 动态 AI 节点 (从 Toolbox 拖进来的，带有 schema)
    if (node.type === 'provider' && node.data.schema) {
      return (
        <>
          {commonFields}
          <Card title="参数配置" size="small" style={{ marginTop: 16 }}>
            {renderDynamicFields(node.data.schema as any[])}
          </Card>
        </>
      );
    }

    // 2. 旧的条件节点
    if (node.type === 'condition') {
      return (
        <>
          {commonFields}
          <Form.Item label="条件表达式" name="condition" tooltip="例如: output.score > 0.8">
            <TextArea rows={4} />
          </Form.Item>
        </>
      );
    }

    // 3. 旧的后处理节点
    if (node.type === 'postProcess') {
      return (
        <>
          {commonFields}
          <Form.Item label="处理器" name="processor">
            <Select options={[
              { label: '文本增强', value: 'enhance' },
              { label: 'JSON格式化', value: 'json' }
            ]} />
          </Form.Item>
        </>
      );
    }

    return commonFields;
  };

  return (
    <Drawer
      title={
        <Space>
          {getNodeIcon(node?.type)}
          <span>{node?.data?.label || '节点配置'}</span>
          <Tag>{node?.type}</Tag>
        </Space>
      }
      width={480}
      open={open}
      onClose={onClose}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>保存配置</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        {renderFormContent()}
      </Form>
    </Drawer>
  );
}
