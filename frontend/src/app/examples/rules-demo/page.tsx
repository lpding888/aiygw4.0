'use client';

/**
 * 规则引擎演示页面
 * 艹！这个页面演示规则引擎的各种功能！
 *
 * @author 老王
 */

import React, { useState } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Divider,
  Select,
  InputNumber,
  Form,
  Alert,
  Timeline,
  Badge,
  Tag,
} from 'antd';
import {
  ThunderboltOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { ruleEngine } from '@/lib/rules/engine';
import type { Rule } from '@/lib/rules/types';

const { Title, Text, Paragraph } = Typography;

/**
 * 规则引擎演示页面
 */
export default function RulesDemoPage() {
  const [loaded, setLoaded] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [eventForm] = Form.useForm();

  /**
   * 加载规则到引擎
   */
  const loadRules = async () => {
    try {
      const response = await fetch('/api/admin/rules');
      if (!response.ok) throw new Error('加载规则失败');

      const data = await response.json();
      ruleEngine.loadRules(data.rules || []);
      setLoaded(true);

      const stats = ruleEngine.getStats();
      addResult({
        type: 'info',
        message: `规则引擎已加载 ${stats.total_rules} 条规则（${stats.enabled_rules} 条已启用）`,
      });
    } catch (error: any) {
      addResult({
        type: 'error',
        message: `加载失败: ${error.message}`,
      });
    }
  };

  /**
   * 触发测试事件
   */
  const triggerEvent = async () => {
    try {
      const values = await eventForm.validateFields();

      // 构建事件数据
      const eventData: any = {};
      if (values.eventName === 'quota.check') {
        eventData.usage_percent = values.usage_percent;
        eventData.remaining = values.remaining;
      } else if (values.eventName === 'nps.submitted') {
        eventData.score = values.score;
        eventData.feedback = values.feedback || '测试反馈';
      } else if (values.eventName === 'user.first_login') {
        eventData.is_first_login = true;
      }

      addResult({
        type: 'info',
        message: `触发事件: ${values.eventName}`,
        data: eventData,
      });

      // 触发规则引擎
      const results = await ruleEngine.triggerEvent(values.eventName, eventData, {
        user_id: 'demo-user',
        tenant_id: 'demo-tenant',
        user_email: 'demo@example.com',
      });

      // 显示结果
      results.forEach((result) => {
        addResult({
          type: result.conditions_met ? 'success' : 'warning',
          message: `规则 "${result.rule_name}" 执行完成`,
          data: result,
        });
      });

      if (results.length === 0) {
        addResult({
          type: 'warning',
          message: '没有规则被触发',
        });
      }
    } catch (error: any) {
      addResult({
        type: 'error',
        message: `触发失败: ${error.message}`,
      });
    }
  };

  /**
   * 添加结果到时间线
   */
  const addResult = (result: any) => {
    setResults((prev) => [{ ...result, timestamp: Date.now() }, ...prev]);
  };

  /**
   * 清除结果
   */
  const clearResults = () => {
    setResults([]);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2}>
            <ThunderboltOutlined style={{ marginRight: 8 }} />
            规则引擎演示
          </Title>
          <Paragraph type="secondary">
            演示规则引擎的事件触发、条件评估、动作执行
          </Paragraph>
        </div>

        {/* 加载规则 */}
        {!loaded && (
          <Alert
            message="规则引擎未加载"
            description="请先点击下方按钮加载规则到引擎中"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            action={
              <Button type="primary" onClick={loadRules}>
                加载规则
              </Button>
            }
          />
        )}

        {loaded && (
          <>
            {/* 统计信息 */}
            <Alert
              message="规则引擎已就绪"
              description={
                <div>
                  <Text>
                    当前已加载 <Text strong>{ruleEngine.getStats().total_rules}</Text> 条规则，
                    其中 <Text strong type="success">{ruleEngine.getStats().enabled_rules}</Text> 条已启用
                  </Text>
                </div>
              }
              type="success"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Divider>事件触发测试</Divider>

            {/* 事件触发表单 */}
            <Card size="small" style={{ marginBottom: 24 }}>
              <Form form={eventForm} layout="inline">
                <Form.Item
                  label="事件类型"
                  name="eventName"
                  initialValue="quota.check"
                  rules={[{ required: true }]}
                  style={{ marginBottom: 16 }}
                >
                  <Select style={{ width: 200 }}>
                    <Select.Option value="quota.check">配额检查</Select.Option>
                    <Select.Option value="nps.submitted">NPS提交</Select.Option>
                    <Select.Option value="user.first_login">首次登录</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item noStyle shouldUpdate>
                  {({ getFieldValue }) => {
                    const eventName = getFieldValue('eventName');

                    if (eventName === 'quota.check') {
                      return (
                        <>
                          <Form.Item
                            label="使用百分比"
                            name="usage_percent"
                            initialValue={95}
                            rules={[{ required: true }]}
                            style={{ marginBottom: 16 }}
                          >
                            <InputNumber min={0} max={100} style={{ width: 120 }} />
                          </Form.Item>
                          <Form.Item
                            label="剩余次数"
                            name="remaining"
                            initialValue={5}
                            style={{ marginBottom: 16 }}
                          >
                            <InputNumber min={0} style={{ width: 120 }} />
                          </Form.Item>
                        </>
                      );
                    } else if (eventName === 'nps.submitted') {
                      return (
                        <Form.Item
                          label="NPS评分"
                          name="score"
                          initialValue={2}
                          rules={[{ required: true }]}
                          style={{ marginBottom: 16 }}
                        >
                          <InputNumber min={0} max={10} style={{ width: 120 }} />
                        </Form.Item>
                      );
                    }

                    return null;
                  }}
                </Form.Item>

                <Form.Item style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={triggerEvent}>
                    触发事件
                  </Button>
                </Form.Item>
              </Form>
            </Card>

            <Divider>执行结果</Divider>

            {/* 执行结果时间线 */}
            <Card
              size="small"
              title={<Text>执行历史 ({results.length})</Text>}
              extra={
                <Button size="small" onClick={clearResults}>
                  清除
                </Button>
              }
            >
              {results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Text type="secondary">暂无执行记录</Text>
                </div>
              ) : (
                <Timeline style={{ marginTop: 16 }}>
                  {results.map((result, index) => (
                    <Timeline.Item
                      key={index}
                      color={
                        result.type === 'success'
                          ? 'green'
                          : result.type === 'error'
                          ? 'red'
                          : result.type === 'warning'
                          ? 'orange'
                          : 'blue'
                      }
                      dot={
                        result.type === 'success' ? (
                          <CheckCircleOutlined />
                        ) : result.type === 'error' ? (
                          <CloseCircleOutlined />
                        ) : undefined
                      }
                    >
                      <div>
                        <Space>
                          <Tag
                            color={
                              result.type === 'success'
                                ? 'success'
                                : result.type === 'error'
                                ? 'error'
                                : result.type === 'warning'
                                ? 'warning'
                                : 'default'
                            }
                          >
                            {result.type}
                          </Tag>
                          <Text>{result.message}</Text>
                        </Space>

                        {result.data && (
                          <div
                            style={{
                              marginTop: 8,
                              padding: 8,
                              background: '#f5f5f5',
                              borderRadius: 4,
                              fontSize: 12,
                              fontFamily: 'monospace',
                            }}
                          >
                            {result.data.rule_name && (
                              <div>
                                <Text type="secondary">规则名称: </Text>
                                <Text strong>{result.data.rule_name}</Text>
                              </div>
                            )}
                            {result.data.conditions_met !== undefined && (
                              <div>
                                <Text type="secondary">条件满足: </Text>
                                <Badge
                                  status={result.data.conditions_met ? 'success' : 'error'}
                                  text={result.data.conditions_met ? '是' : '否'}
                                />
                              </div>
                            )}
                            {result.data.actions_executed !== undefined && (
                              <div>
                                <Text type="secondary">动作执行: </Text>
                                <Text>
                                  {result.data.actions_executed} / {result.data.actions_executed + result.data.actions_failed}
                                </Text>
                              </div>
                            )}
                            {result.data.duration_ms && (
                              <div>
                                <Text type="secondary">执行耗时: </Text>
                                <Text>{result.data.duration_ms}ms</Text>
                              </div>
                            )}
                            {!result.data.rule_name && (
                              <pre style={{ margin: 0 }}>{JSON.stringify(result.data, null, 2)}</pre>
                            )}
                          </div>
                        )}

                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(result.timestamp).toLocaleString()}
                          </Text>
                        </div>
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              )}
            </Card>
          </>
        )}
      </Card>
    </div>
  );
}
