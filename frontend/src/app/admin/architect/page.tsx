'use client';

/**
 * AI Architect - 自然语言生成 Pipeline
 *
 * 功能：
 * 1. 对话式界面，输入自然语言需求
 * 2. AI 自动生成符合 Protocol 的 Pipeline JSON
 * 3. 可视化预览生成的 Pipeline
 * 4. 支持迭代修改和优化
 * 5. 一键保存到 Pipeline Schema
 */

import { useState, useRef, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Typography,
  Spin,
  message,
  Tag,
  Divider,
  Alert,
  Modal,
  Form,
  Empty,
  Tabs,
  Statistic,
  Row,
  Col,
  Tooltip,
  theme,
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  CodeOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  LeftOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  BackgroundVariant,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/components/flow/NodeTypes';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  pipeline?: any;
  metadata?: {
    attempts?: number;
    qualityScore?: number;
    confidence?: number;
    autoFixCount?: number;
  };
}

interface GeneratedPipeline {
  version: string;
  meta: {
    name: string;
    description: string;
  };
  nodes: any[];
  edges: any[];
}

export default function AIArchitectPage() {
  const router = useRouter();
  const { token } = theme.useToken();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [currentPipeline, setCurrentPipeline] = useState<GeneratedPipeline | null>(null);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [form] = Form.useForm();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 当 currentPipeline 更新时，更新 ReactFlow nodes 和 edges
  useEffect(() => {
    if (currentPipeline) {
      const flowNodes: Node[] = currentPipeline.nodes.map((node: any) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data || {},
      }));

      const flowEdges: Edge[] = currentPipeline.edges.map((edge: any) => ({
        id: edge.id || `edge-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        animated: true,
        style: { stroke: token.colorPrimary },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [currentPipeline, setNodes, setEdges, token.colorPrimary]);

  const handleGenerate = async () => {
    if (!userInput.trim()) {
      message.warning('请输入需求描述');
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setUserInput('');
    setGenerating(true);

    try {
      const response = await api.aiArchitect.generate({
        userRequest: userInput,
      });

      if (response.success && response.data) {
        const { pipeline, attempts, qualityScore, confidence, autoFixCount } = response.data;

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `已成功生成 Pipeline: **${pipeline.meta.name}**\n\n${pipeline.meta.description}`,
          timestamp: new Date(),
          pipeline,
          metadata: {
            attempts,
            qualityScore,
            confidence,
            autoFixCount,
          },
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setCurrentPipeline(pipeline);
        message.success('Pipeline 生成成功！');
      } else {
        throw new Error(response.message || '生成失败');
      }
    } catch (error: any) {
      console.error('生成失败:', error);
      const errorMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `生成失败: ${error.message || '未知错误'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      message.error('生成失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const handleModify = async () => {
    if (!currentPipeline) {
      message.warning('没有可修改的 Pipeline');
      return;
    }

    if (!userInput.trim()) {
      message.warning('请输入修改需求');
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: `[修改] ${userInput}`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setUserInput('');
    setGenerating(true);

    try {
      const response = await api.aiArchitect.modify({
        currentPipeline,
        modificationRequest: userInput,
      });

      if (response.success && response.data) {
        const { pipeline, attempts, qualityScore, confidence, autoFixCount } = response.data;

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `已修改 Pipeline: **${pipeline.meta.name}**\n\n${pipeline.meta.description}`,
          timestamp: new Date(),
          pipeline,
          metadata: {
            attempts,
            qualityScore,
            confidence,
            autoFixCount,
          },
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setCurrentPipeline(pipeline);
        message.success('Pipeline 修改成功！');
      } else {
        throw new Error(response.message || '修改失败');
      }
    } catch (error: any) {
      console.error('修改失败:', error);
      const errorMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `修改失败: ${error.message || '未知错误'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      message.error('修改失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePipeline = async () => {
    if (!currentPipeline) {
      message.warning('没有可保存的 Pipeline');
      return;
    }

    try {
      const values = await form.validateFields();

      const response = await api.pipeline.createSchema({
        schema_name: values.schema_name || currentPipeline.meta.name,
        description: values.description || currentPipeline.meta.description,
        category: values.category || 'ai_generated',
        nodes: currentPipeline.nodes,
        edges: currentPipeline.edges,
        metadata: {
          generated_by: 'ai_architect',
          original_request: messages.find((m) => m.role === 'user')?.content,
          generated_at: new Date().toISOString(),
        },
      });

      if (response.success) {
        message.success('Pipeline 已保存到数据库');
        setSaveModalVisible(false);
        form.resetFields();
      } else {
        throw new Error(response.message || '保存失败');
      }
    } catch (error: any) {
      console.error('保存失败:', error);
      message.error(error.message || '保存失败');
    }
  };

  const handleReset = () => {
    Modal.confirm({
      title: '确认重置',
      content: '这将清空所有对话历史和生成的 Pipeline，确定要继续吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        setMessages([]);
        setCurrentPipeline(null);
        setUserInput('');
        message.success('已重置');
      },
    });
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';

    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            maxWidth: '70%',
            display: 'flex',
            flexDirection: isUser ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: isUser ? token.colorPrimary : token.colorSuccess,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {isUser ? <UserOutlined /> : <RobotOutlined />}
          </div>
          <div>
            <Card
              size="small"
              style={{
                backgroundColor: isUser ? token.colorPrimaryBg : token.colorBgContainer,
                borderColor: isUser ? token.colorPrimaryBorder : token.colorBorder,
              }}
            >
              <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </Paragraph>
              {msg.metadata && (
                <Space size="small" style={{ marginTop: 8 }}>
                  {msg.metadata.attempts && (
                    <Tag color="blue">尝试次数: {msg.metadata.attempts}</Tag>
                  )}
                  {msg.metadata.qualityScore && (
                    <Tag color="green">质量分数: {msg.metadata.qualityScore}</Tag>
                  )}
                  {msg.metadata.confidence && (
                    <Tag color="orange">置信度: {(msg.metadata.confidence * 100).toFixed(1)}%</Tag>
                  )}
                  {msg.metadata.autoFixCount !== undefined && msg.metadata.autoFixCount > 0 && (
                    <Tag color="purple">自动修复: {msg.metadata.autoFixCount}次</Tag>
                  )}
                </Space>
              )}
            </Card>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              {msg.timestamp.toLocaleTimeString()}
            </Text>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶部导航栏 */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: `1px solid ${token.colorBorder}`,
          backgroundColor: token.colorBgContainer,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Button icon={<LeftOutlined />} onClick={() => router.back()}>
            返回
          </Button>
          <Divider type="vertical" />
          <ThunderboltOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
          <Title level={4} style={{ margin: 0 }}>
            AI Architect - 智能 Pipeline 生成器
          </Title>
        </Space>
        <Space>
          <Tooltip title="刷新 Protocol 文档">
            <Button
              icon={<ReloadOutlined />}
              onClick={async () => {
                try {
                  await api.adminPromptTemplates.refreshProtocol();
                  message.success('Protocol 文档已刷新');
                } catch (error) {
                  message.error('刷新失败');
                }
              }}
            >
              刷新 Protocol
            </Button>
          </Tooltip>
          {currentPipeline && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => setSaveModalVisible(true)}
            >
              保存 Pipeline
            </Button>
          )}
          <Button danger icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </div>

      {/* 主体区域 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧：对话区 */}
        <div
          style={{
            width: '50%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${token.colorBorder}`,
            backgroundColor: token.colorBgLayout,
          }}
        >
          {/* 对话历史 */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 24,
            }}
          >
            {messages.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Paragraph>
                      <RobotOutlined style={{ fontSize: 48, color: token.colorPrimary }} />
                    </Paragraph>
                    <Paragraph strong>欢迎使用 AI Architect</Paragraph>
                    <Paragraph type="secondary">
                      用自然语言描述你的需求，AI 将自动生成符合规范的 Pipeline
                    </Paragraph>
                    <Divider />
                    <Paragraph type="secondary">
                      示例：
                      <br />• 生成一张猫的图片，然后用诗歌描述它
                      <br />• 将中文翻译成英文，然后总结内容
                      <br />• 生成图片并分析图片内容
                    </Paragraph>
                  </div>
                }
              />
            ) : (
              <>
                {messages.map(renderMessage)}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* 输入区 */}
          <div
            style={{
              padding: 16,
              borderTop: `1px solid ${token.colorBorder}`,
              backgroundColor: token.colorBgContainer,
            }}
          >
            <Space.Compact style={{ width: '100%' }}>
              <TextArea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={
                  currentPipeline
                    ? '输入修改需求...'
                    : '用自然语言描述你的需求，例如："生成一张猫的图片，然后用诗歌描述它"'
                }
                autoSize={{ minRows: 2, maxRows: 6 }}
                disabled={generating}
                onPressEnter={(e) => {
                  if (e.shiftKey) return;
                  e.preventDefault();
                  currentPipeline ? handleModify() : handleGenerate();
                }}
              />
              <Button
                type="primary"
                icon={generating ? <Spin size="small" /> : <SendOutlined />}
                loading={generating}
                onClick={currentPipeline ? handleModify : handleGenerate}
                style={{ height: 'auto' }}
              >
                {currentPipeline ? '修改' : '生成'}
              </Button>
            </Space.Compact>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              按 Enter 发送，Shift + Enter 换行
              {currentPipeline && ' • 当前处于修改模式'}
            </Text>
          </div>
        </div>

        {/* 右侧：预览区 */}
        <div
          style={{
            width: '50%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: token.colorBgContainer,
          }}
        >
          {currentPipeline ? (
            <Tabs
              defaultActiveKey="visual"
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              items={[
                {
                  key: 'visual',
                  label: (
                    <span>
                      <EyeOutlined />
                      可视化预览
                    </span>
                  ),
                  children: (
                    <div style={{ height: 'calc(100vh - 120px)' }}>
                      <ReactFlowProvider>
                        <ReactFlow
                          nodes={nodes}
                          edges={edges}
                          onNodesChange={onNodesChange}
                          onEdgesChange={onEdgesChange}
                          nodeTypes={nodeTypes}
                          fitView
                        >
                          <Background variant={BackgroundVariant.Dots} />
                          <Controls />
                        </ReactFlow>
                      </ReactFlowProvider>
                    </div>
                  ),
                },
                {
                  key: 'json',
                  label: (
                    <span>
                      <CodeOutlined />
                      JSON 代码
                    </span>
                  ),
                  children: (
                    <div style={{ height: 'calc(100vh - 120px)', overflow: 'auto' }}>
                      <SyntaxHighlighter
                        language="json"
                        style={vscDarkPlus}
                        customStyle={{ margin: 0, height: '100%' }}
                      >
                        {JSON.stringify(currentPipeline, null, 2)}
                      </SyntaxHighlighter>
                    </div>
                  ),
                },
                {
                  key: 'info',
                  label: (
                    <span>
                      <CheckCircleOutlined />
                      详细信息
                    </span>
                  ),
                  children: (
                    <div style={{ padding: 24, height: 'calc(100vh - 120px)', overflow: 'auto' }}>
                      <Card>
                        <Statistic title="Pipeline 名称" value={currentPipeline.meta.name} />
                        <Divider />
                        <Paragraph>
                          <Text strong>描述：</Text>
                          <br />
                          {currentPipeline.meta.description}
                        </Paragraph>
                        <Divider />
                        <Row gutter={16}>
                          <Col span={8}>
                            <Statistic title="节点数量" value={currentPipeline.nodes.length} />
                          </Col>
                          <Col span={8}>
                            <Statistic title="连接数量" value={currentPipeline.edges.length} />
                          </Col>
                          <Col span={8}>
                            <Statistic
                              title="协议版本"
                              value={currentPipeline.version}
                            />
                          </Col>
                        </Row>
                      </Card>
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无生成的 Pipeline"
              style={{ marginTop: 100 }}
            />
          )}
        </div>
      </div>

      {/* 保存 Pipeline Modal */}
      <Modal
        title="保存 Pipeline"
        open={saveModalVisible}
        onOk={handleSavePipeline}
        onCancel={() => setSaveModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            schema_name: currentPipeline?.meta.name,
            description: currentPipeline?.meta.description,
            category: 'ai_generated',
          }}
        >
          <Form.Item
            label="Pipeline 名称"
            name="schema_name"
            rules={[{ required: true, message: '请输入 Pipeline 名称' }]}
          >
            <Input placeholder="输入 Pipeline 名称" />
          </Form.Item>
          <Form.Item
            label="描述"
            name="description"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <TextArea rows={3} placeholder="输入描述" />
          </Form.Item>
          <Form.Item label="分类" name="category">
            <Input placeholder="输入分类（例如：ai_generated）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
