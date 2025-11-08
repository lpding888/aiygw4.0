/**
 * REL-P2-ALERT-213: 用户反馈浮层
 * 艹！用户遇到问题必须能快速反馈，直达日志！
 *
 * @author 老王
 */

'use client';

import React, { useState } from 'react';
import { Button, FloatButton, Modal, Form, Input, Select, message, Typography, Space, Tag } from 'antd';
import { BugOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { globalAlertManager } from '@/lib/monitoring/alerts';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

export interface FeedbackData {
  type: 'bug' | 'performance' | 'feature' | 'other';
  description: string;
  url: string;
  userAgent: string;
  timestamp: string;
  sessionId?: string;
  recentAlerts?: any[];
  screenshot?: string;
}

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [sessionId] = useState(() => {
    // 生成会话ID
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });
  const [copied, setCopied] = useState(false);

  const handleOpen = () => {
    setOpen(true);

    // 预填充当前页面URL
    form.setFieldsValue({
      url: window.location.href,
    });
  };

  const handleClose = () => {
    setOpen(false);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      setSubmitting(true);

      // 收集反馈数据
      const feedbackData: FeedbackData = {
        type: values.type,
        description: values.description,
        url: values.url || window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        sessionId,
        recentAlerts: globalAlertManager.getRecords(10), // 最近10条告警
      };

      // 发送到后端
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      });

      if (!response.ok) {
        throw new Error('提交失败');
      }

      const result = await response.json();

      message.success(`反馈已提交！追踪ID: ${result.ticketId || sessionId}`);

      // 上报到Sentry
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.captureMessage('User Feedback', {
          level: 'info',
          tags: {
            feedback_type: values.type,
          },
          extra: feedbackData,
        });
      }

      handleClose();
    } catch (error: any) {
      message.error(error.message || '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    message.success('会话ID已复制');

    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* 浮动按钮 */}
      <FloatButton
        icon={<BugOutlined />}
        type="primary"
        style={{
          right: 24,
          bottom: 24,
        }}
        onClick={handleOpen}
        tooltip="反馈问题"
      />

      {/* 反馈弹窗 */}
      <Modal
        title="反馈问题"
        open={open}
        onCancel={handleClose}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="提交"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="问题类型"
            name="type"
            rules={[{ required: true, message: '请选择问题类型' }]}
            initialValue="bug"
          >
            <Select>
              <Select.Option value="bug">🐛 Bug反馈</Select.Option>
              <Select.Option value="performance">⚡ 性能问题</Select.Option>
              <Select.Option value="feature">💡 功能建议</Select.Option>
              <Select.Option value="other">📝 其他</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="问题描述"
            name="description"
            rules={[
              { required: true, message: '请描述遇到的问题' },
              { min: 10, message: '请至少输入10个字符' },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="请详细描述遇到的问题，包括：&#10;1. 问题发生的场景&#10;2. 预期行为和实际行为&#10;3. 重现步骤（如有）"
            />
          </Form.Item>

          <Form.Item label="页面URL" name="url">
            <Input placeholder="当前页面URL（自动填充）" disabled />
          </Form.Item>

          <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
            <div>
              <Text strong>会话ID：</Text>
              <Tag
                color="blue"
                style={{ marginLeft: 8, cursor: 'pointer' }}
                onClick={handleCopySessionId}
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              >
                {sessionId}
              </Tag>
            </div>

            <Paragraph type="secondary" style={{ margin: 0 }}>
              💡 提示：会话ID用于追踪和排查问题，提交后可复制此ID用于后续查询
            </Paragraph>

            {globalAlertManager.getRecords(5).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Text type="warning">
                  ⚠️ 检测到最近有{globalAlertManager.getRecords(5).length}条告警记录，已自动附加到反馈中
                </Text>
              </div>
            )}
          </Space>
        </Form>
      </Modal>
    </>
  );
}
