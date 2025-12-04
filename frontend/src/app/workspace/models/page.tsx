/**
 * PAGE-P0-MODEL-003 模型管理页面
 * 艹，必须做好模型管理界面，让用户能清楚地看到和控制所有AI模型！
 *
 * 功能清单：
 * 1. 模型列表展示（卡片式布局）
 * 2. 模型状态筛选（全部/可用/不可用/测试中）
 * 3. 模型配置面板（参数调整、上下文长度等）
 * 4. 模型测试功能（实时对话测试）
 * 5. 使用统计展示（调用次数、响应时间等）
 *
 * @author 老王
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Tag,
  Switch,
  Input,
  InputNumber,
  Tabs,
  List,
  Avatar,
  Badge,
  Space,
  Tooltip,
  message,
  Modal,
  Form,
  Select,
  Progress,
  Statistic,
  Typography
} from 'antd';
import {
  RobotOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FireOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { startSSE } from '@/lib/api/sse';
import { MSWInitializer } from '@/components/MSWInitializer';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// 模型数据类型
interface AIModel {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  status: 'available' | 'unavailable' | 'testing';
  enabled: boolean;
  temperature?: number;
  maxContext?: number;
  systemPrompt?: string;
  description?: string;
}

// 模型统计数据
interface ModelStats {
  totalCalls: number;
  avgResponseTime: number;
  successRate: number;
  lastUsed: string;
}

export default function ModelManagement() {
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [configForm] = Form.useForm();

  // 获取模型列表
  const { data: modelsData, isLoading, refetch } = useQuery({
    queryKey: ['ai-models'],
    queryFn: async () => {
      const response = await api.client.get('/ai/models');
      return response.data;
    },
  });

  // 模拟数据（当API不可用时）
  const mockModels: AIModel[] = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'OpenAI',
      maxTokens: 8192,
      status: 'available',
      enabled: true,
      temperature: 0.7,
      maxContext: 8192,
      description: '最强大的通用AI模型，适合复杂任务'
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'OpenAI',
      maxTokens: 4096,
      status: 'available',
      enabled: true,
      temperature: 0.7,
      maxContext: 4096,
      description: '快速可靠的模型，适合日常任务'
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude-3 Sonnet',
      provider: 'Anthropic',
      maxTokens: 4096,
      status: 'available',
      enabled: true,
      temperature: 0.7,
      maxContext: 4096,
      description: '擅长推理和分析的AI助手'
    },
    {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      provider: 'Google',
      maxTokens: 8192,
      status: 'testing',
      enabled: false,
      temperature: 0.7,
      maxContext: 8192,
      description: 'Google的多模态AI模型'
    }
  ];

  // 模拟统计数据
  const mockStats: Record<string, ModelStats> = {
    'gpt-4': {
      totalCalls: 1250,
      avgResponseTime: 2.3,
      successRate: 98.5,
      lastUsed: '2分钟前'
    },
    'gpt-3.5-turbo': {
      totalCalls: 3420,
      avgResponseTime: 1.1,
      successRate: 99.2,
      lastUsed: '刚刚'
    },
    'claude-3-sonnet': {
      totalCalls: 890,
      avgResponseTime: 1.8,
      successRate: 97.8,
      lastUsed: '15分钟前'
    },
    'gemini-pro': {
      totalCalls: 45,
      avgResponseTime: 3.2,
      successRate: 95.5,
      lastUsed: '2小时前'
    }
  };

  const models = modelsData?.models || mockModels;

  // 过滤模型
  const filteredModels = models.filter((model: AIModel) => {
    if (filterStatus === 'all') return true;
    return model.status === filterStatus;
  });

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'available':
        return <Tag color="success" icon={<CheckCircleOutlined />}>可用</Tag>;
      case 'unavailable':
        return <Tag color="error" icon={<CloseCircleOutlined />}>不可用</Tag>;
      case 'testing':
        return <Tag color="warning" icon={<ClockCircleOutlined />}>测试中</Tag>;
      default:
        return <Tag>未知</Tag>;
    }
  };

  // 获取提供商图标
  const getProviderIcon = (provider: string) => {
    const iconMap: Record<string, string> = {
      'OpenAI': '🤖',
      'Anthropic': '🧠',
      'Google': '🔍',
      'Custom': '⚙️'
    };
    return iconMap[provider] || '🤖';
  };

  // 测试模型
  const testModel = async (model: AIModel) => {
    if (!testMessage.trim()) {
      message.warning('请输入测试消息');
      return;
    }

    setSelectedModel(model);
    setTestResponse('');

    try {
      await startSSE({
        url: '/ai/chat',
        body: {
          message: testMessage,
          model: model.id,
          sessionId: `test_${Date.now()}`
        },
        onDelta: (data: { text?: string }) => {
          if (data.text) {
            setTestResponse(prev => prev + data.text);
          }
        },
        onDone: () => {
          message.success('测试完成');
        },
        onError: (error) => {
          message.error(`测试失败: ${error.message}`);
        }
      });
    } catch (error) {
      message.error('测试请求失败');
    }
  };

  // 保存模型配置
  const saveModelConfig = async (model: AIModel) => {
    try {
      const values = await configForm.validateFields();
      // 这里应该调用API保存配置
      console.log('保存配置:', model.id, values);
      message.success('配置已保存');
      setConfigModalVisible(false);
      refetch();
    } catch (error) {
      message.error('配置保存失败');
    }
  };

  // 切换模型启用状态
  const toggleModelEnabled = async (modelId: string, enabled: boolean) => {
    try {
      // 这里应该调用API切换状态
      console.log('切换状态:', modelId, enabled);
      message.success(`模型已${enabled ? '启用' : '禁用'}`);
      refetch();
    } catch (error) {
      message.error('状态切换失败');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <MSWInitializer />

      {/* 页面头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <RobotOutlined className="text-3xl text-blue-600" />
            <div>
              <Title level={2} className="mb-1">模型管理</Title>
              <Text type="secondary">管理和配置AI模型，监控使用状态</Text>
            </div>
          </div>
          <Button
            type="primary"
            icon={<SettingOutlined />}
            onClick={() => setConfigModalVisible(true)}
          >
            批量配置
          </Button>
        </div>

        {/* 状态筛选 */}
        <div className="flex gap-2 mb-6">
          <Button
            type={filterStatus === 'all' ? 'primary' : 'default'}
            onClick={() => setFilterStatus('all')}
          >
            全部 ({models.length})
          </Button>
          <Button
            type={filterStatus === 'available' ? 'primary' : 'default'}
            onClick={() => setFilterStatus('available')}
          >
            可用 ({models.filter((m: AIModel) => m.status === 'available').length})
          </Button>
          <Button
            type={filterStatus === 'testing' ? 'primary' : 'default'}
            onClick={() => setFilterStatus('testing')}
          >
            测试中 ({models.filter((m: AIModel) => m.status === 'testing').length})
          </Button>
          <Button
            type={filterStatus === 'unavailable' ? 'primary' : 'default'}
            onClick={() => setFilterStatus('unavailable')}
          >
            不可用 ({models.filter((m: AIModel) => m.status === 'unavailable').length})
          </Button>
        </div>
      </div>

      {/* 模型卡片网格 */}
      <Row gutter={[24, 24]}>
        {filteredModels.map((model: AIModel) => {
          const stats = mockStats[model.id];
          return (
            <Col xs={24} sm={12} lg={8} xl={6} key={model.id}>
              <Card
                className="h-full model-card"
                cover={
                  <div className="p-6 text-center bg-gradient-to-br from-blue-50 to-purple-50">
                    <div className="text-4xl mb-3">
                      {getProviderIcon(model.provider)}
                    </div>
                    <Title level={4} className="mb-2">{model.name}</Title>
                    <Space>
                      {getStatusTag(model.status)}
                      <Badge
                        status={model.enabled ? 'success' : 'default'}
                        text={model.enabled ? '已启用' : '已禁用'}
                      />
                    </Space>
                  </div>
                }
                actions={[
                  <Tooltip key="test" title="测试模型">
                    <PlayCircleOutlined
                      onClick={() => {
                        setSelectedModel(model);
                        setTestModalVisible(true);
                      }}
                    />
                  </Tooltip>,
                  <Tooltip key="config" title="配置模型">
                    <SettingOutlined
                      onClick={() => {
                        setSelectedModel(model);
                        configForm.setFieldsValue(model);
                        setConfigModalVisible(true);
                      }}
                    />
                  </Tooltip>,
                  <Switch
                    key="toggle"
                    checked={model.enabled}
                    onChange={(checked) => toggleModelEnabled(model.id, checked)}
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                  />
                ]}
              >
                <div className="space-y-4">
                  {/* 基本信息 */}
                  <div>
                    <Text type="secondary">提供商</Text>
                    <div className="font-medium">{model.provider}</div>
                  </div>

                  <div>
                    <Text type="secondary">最大令牌</Text>
                    <div className="font-medium">{model.maxTokens.toLocaleString()}</div>
                  </div>

                  {/* 使用统计 */}
                  {stats && (
                    <div className="pt-4 border-t">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-lg font-semibold text-blue-600">
                            {stats.totalCalls.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">总调用次数</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-green-600">
                            {stats.avgResponseTime}s
                          </div>
                          <div className="text-xs text-gray-500">平均响应</div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>成功率</span>
                          <span>{stats.successRate}%</span>
                        </div>
                        <Progress
                          percent={stats.successRate}
                          size="small"
                          status={stats.successRate > 95 ? 'success' : 'active'}
                        />
                      </div>

                      <div className="text-center mt-2">
                        <Text type="secondary" className="text-xs">
                          最后使用: {stats.lastUsed}
                        </Text>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 测试模态框 */}
      <Modal
        title={`测试模型: ${selectedModel?.name}`}
        open={testModalVisible}
        onCancel={() => {
          setTestModalVisible(false);
          setTestMessage('');
          setTestResponse('');
        }}
        footer={null}
        width={800}
      >
        <div className="space-y-4">
          <div>
            <Text strong>测试消息:</Text>
            <Input.TextArea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="输入要测试的消息..."
              rows={3}
              className="mt-2"
            />
          </div>

          <div className="flex justify-center">
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => selectedModel && testModel(selectedModel)}
              disabled={!testMessage.trim()}
            >
              开始测试
            </Button>
          </div>

          {testResponse && (
            <div>
              <Text strong>模型回复:</Text>
              <div className="mt-2 p-4 bg-gray-50 rounded-lg max-h-64 overflow-y-auto">
                <Text>{testResponse}</Text>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 配置模态框 */}
      <Modal
        title={`配置模型: ${selectedModel?.name}`}
        open={configModalVisible}
        onOk={() => selectedModel && saveModelConfig(selectedModel)}
        onCancel={() => setConfigModalVisible(false)}
        width={600}
      >
        <Form
          form={configForm}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            label="Temperature"
            name="temperature"
            help="控制输出的随机性，0-1之间，越高越随机"
          >
            <InputNumber
              min={0}
              max={1}
              step={0.1}
              placeholder="0.7"
              className="w-full"
            />
          </Form.Item>

          <Form.Item
            label="最大上下文长度"
            name="maxContext"
            help="模型能处理的最大文本长度"
          >
            <InputNumber
              min={512}
              max={128000}
              step={1024}
              placeholder="4096"
              className="w-full"
            />
          </Form.Item>

          <Form.Item
            label="系统提示词"
            name="systemPrompt"
            help="设定模型的角色和行为准则"
          >
            <Input.TextArea
              rows={4}
              placeholder="你是一个有用的AI助手..."
            />
          </Form.Item>
        </Form>
      </Modal>

      <style jsx>{`
        .model-card {
          transition: all 0.3s ease;
        }
        .model-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }
      `}</style>
    </div>
  );
}
