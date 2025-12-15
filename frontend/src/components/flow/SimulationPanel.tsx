'use client';

import React, { useState } from 'react';
import { Button, Drawer, Space, Form, Input, message, Upload, Spin, Tag, Card, Divider, Collapse, Image } from 'antd';
import { PlayCircleOutlined, UploadOutlined, FileTextOutlined, LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { UploadChangeParam, UploadFile } from 'antd/es/upload';
import { RcFile } from 'antd/lib/upload';

interface SimulationPanelProps {
  open: boolean;
  onClose: () => void;
  onSimulate: (initialInputs: { text_input?: string; image_url?: string }) => Promise<any>; // Function to call backend
  simulationResult: any; // Result from backend
  loading: boolean;
}

const { TextArea } = Input;
const { Panel } = Collapse;

export default function SimulationPanel({
  open,
  onClose,
  onSimulate,
  simulationResult,
  loading,
}: SimulationPanelProps) {
  const [form] = Form.useForm();
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

  const handleRunSimulation = async () => {
    try {
      const values = await form.validateFields();
      const initialInputs = {
        text_input: values.text_input,
        image_url: imageUrl,
      };
      await onSimulate(initialInputs);
    } catch (error) {
      message.error('请填写必要的模拟输入');
    }
  };

  const beforeUpload = (file: RcFile) => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isJpgOrPng) {
      message.error('只能上传 JPG/PNG 文件!');
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('图片必须小于 2MB!');
    }
    return isJpgOrPng && isLt2M;
  };

  const handleImageUploadChange = (info: UploadChangeParam<UploadFile>) => {
    if (info.file.status === 'done') {
      // Assuming backend returns URL in response
      // For mock, just use a dummy URL or local FileReader
      message.success(`${info.file.name} 文件上传成功`);
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageUrl(reader.result as string));
      reader.readAsDataURL(info.file.originFileObj as RcFile);
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 文件上传失败`);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(undefined);
  };

  return (
    <Drawer
      title={
        <Space>
          <PlayCircleOutlined />
          实时预览 (模拟运行)
        </Space>
      }
      width={600}
      open={open}
      onClose={onClose}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>关闭</Button>
          <Button type="primary" onClick={handleRunSimulation} loading={loading}>
            <PlayCircleOutlined /> 运行模拟
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item label="文本输入 (initial_text_input)" name="text_input">
          <TextArea rows={4} placeholder="例如：把图片中的衣服换到海边场景..." />
        </Form.Item>

        <Form.Item label="图片输入 (initial_image_url)">
          <Upload
            name="image"
            listType="picture"
            beforeUpload={beforeUpload}
            onChange={handleImageUploadChange}
            onRemove={handleRemoveImage}
            maxCount={1}
            accept="image/jpeg,image/png"
          >
            {!imageUrl && (
              <Button icon={<UploadOutlined />}>上传图片</Button>
            )}
          </Upload>
          {imageUrl && (
            <div style={{ marginTop: 16 }}>
              <Image src={imageUrl} alt="Uploaded" style={{ maxWidth: '100px', maxHeight: '100px' }} />
              <Button type="link" danger onClick={handleRemoveImage}>移除图片</Button>
            </div>
          )}
        </Form.Item>
        <Divider />
      </Form>

      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <p style={{ marginTop: 16 }}>正在运行模拟...</p>
        </div>
      )}

      {simulationResult && (
        <Card
          title={
            <Space>
              模拟结果
              {simulationResult.overallStatus === 'success' ? (
                <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>
              )}
            </Space>
          }
          size="small"
          style={{ marginTop: 24 }}
        >
          <p>总状态: {simulationResult.message}</p>
          <Collapse accordion>
            {simulationResult.results.map((step: any, index: number) => (
              <Panel
                header={
                  <Space>
                    步骤 {index + 1}: {step.nodeType} ({step.nodeId})
                    {step.status === 'success' ? (
                      <Tag color="success">成功</Tag>
                    ) : (
                      <Tag color="error">失败</Tag>
                    )}
                    <Tag>{step.duration.toFixed(2)} ms</Tag>
                  </Space>
                }
                key={step.nodeId}
              >
                <p><strong>输入:</strong> <pre>{JSON.stringify(step.input, null, 2)}</pre></p>
                <p><strong>输出:</strong> <pre>{JSON.stringify(step.output, null, 2)}</pre></p>
                {step.error && <p style={{ color: 'red' }}><strong>错误:</strong> {step.error}</p>}
                {step.output?.result && typeof step.output.result === 'string' && step.output.result.startsWith('http') && (
                  <Image src={step.output.result} alt="Node Output" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                )}
              </Panel>
            ))}
          </Collapse>
          <Divider />
          <p><strong>最终输出:</strong> <pre>{JSON.stringify(simulationResult.finalOutput, null, 2)}</pre></p>
        </Card>
      )}
    </Drawer>
  );
}
