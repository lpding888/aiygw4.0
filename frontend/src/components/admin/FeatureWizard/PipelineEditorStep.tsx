/**
 * Step 3: 流程编排步骤（CMS-208核心）
 * Visionary Theme: Visual Pipeline Editor
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button, Space, message, Alert, Typography, Modal, Select, Radio, Spin, Tag, Card } from 'antd';
import { SaveOutlined, EyeOutlined, PlusOutlined, LeftOutlined, RightOutlined, PlayCircleOutlined, RocketOutlined, BranchesOutlined } from '@ant-design/icons';
import api from '@/lib/api';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/components/flow/NodeTypes';
import NodeInspector from '@/app/admin/pipelines/editor/components/NodeInspector';
import PipelineBlockSidebar from './PipelineBlockSidebar';
import { adminPipelines } from '@/lib/services/adminPipelines';

const { Title, Text } = Typography;

interface PipelineEditorStepProps {
  data: any;
  onUpdate: (data: any) => void;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * 初始节点
 */
const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'start',
    position: { x: 250, y: 50 },
    data: { label: '开始' },
  },
];

const initialEdges: any[] = [];

export default function PipelineEditorStep({
  data,
  onUpdate,
  onNext,
  onPrev,
}: PipelineEditorStepProps) {
  const [mode, setMode] = useState<'new' | 'existing'>('existing'); // Default to existing
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(
    data.pipeline_schema_id && !data.pipeline_schema_id.startsWith('pipeline-') ? data.pipeline_schema_id : ''
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(
    data.pipeline_schema_data?.nodes || initialNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    data.pipeline_schema_data?.edges || initialEdges
  );
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Load pipelines on mount
  useEffect(() => {
    loadPipelineList();
  }, []);

  const loadPipelineList = async () => {
    setLoadingPipelines(true);
    try {
      const response = await adminPipelines.list({ page: 1, pageSize: 100 });
      setPipelines(response.items || []);
    } catch (error) {
      console.error('Failed to load pipelines:', error);
      message.error('加载Pipeline列表失败');
    } finally {
      setLoadingPipelines(false);
    }
  };

  /**
   * 连线回调
   */
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  /**
   * 节点点击回调
   */
  const onNodeClick = useCallback((_event: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  /**
   * 添加Provider节点
   */
  const handleAddProviderNode = () => {
    const newNode: Node = {
      id: `provider-${Date.now()}`,
      type: 'provider',
      position: { x: 250, y: nodes.length * 150 + 50 },
      data: { label: '新Provider节点', providerRef: '' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 保存Pipeline Schema
   */
  const handleSavePipeline = async () => {
    if (nodes.length === 0) {
      message.warning('Pipeline为空，请至少添加一个节点');
      return false;
    }

    setSaving(true);
    try {
      const pipelineData = {
        schema_name: data.display_name || data.feature_id,
        description: data.description || `${data.feature_id}的处理流程`,
        category: data.category || 'custom',
        nodes,
        edges,
        metadata: {
          feature_id: data.feature_id,
          created_from: 'wizard',
          version: '1.0'
        }
      };

      let response;
      if (data.pipeline_schema_id && !data.pipeline_schema_id.startsWith('pipeline-')) {
        // 已存在schema，执行更新
        response = await api.pipeline.updateSchema(data.pipeline_schema_id, pipelineData);
      } else {
        // 创建新schema
        response = await api.pipeline.createSchema(pipelineData);
      }

      if (response.data.success && response.data.data) {
        // 更新Feature数据
        onUpdate({
          pipeline_schema_id: response.data.data.schema_id,
          pipeline_schema_data: {
            nodes,
            edges,
          },
        });

        message.success('Pipeline已保存');
        return true;
      } else {
        throw new Error(response.data.message || '保存失败');
      }
    } catch (error: any) {
      message.error(`保存Pipeline失败: ${error.message || '未知错误'}`);
      console.error('保存Pipeline错误:', error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  /**
   * 测试执行Pipeline
   */
  const handleTestPipeline = async () => {
    if (nodes.length === 0) {
      message.warning('Pipeline为空，无法执行');
      return;
    }

    if (!data.pipeline_schema_id || data.pipeline_schema_id.startsWith('pipeline-')) {
      message.warning('请先保存Pipeline后再执行测试');
      return;
    }

    Modal.confirm({
      title: '测试执行Pipeline',
      content: '确定要测试执行这个Pipeline吗？将使用默认输入数据。',
      okText: '开始测试',
      cancelText: '取消',
      onOk: async () => {
        setExecuting(true);
        try {
          const response = await api.pipeline.createAndStartExecution({
            schema_id: data.pipeline_schema_id,
            input_data: {},
            metadata: {
              test_mode: true,
              triggered_from: 'wizard'
            }
          });

          if (response.data.success && response.data.data) {
            message.success(`Pipeline执行已启动，执行ID: ${response.data.data.execution_id}`);

            // 可选：打开新窗口查看执行详情
            Modal.info({
              title: '执行已启动',
              content: (
                <div>
                  <p>执行ID: {response.data.data.execution_id}</p>
                  <p>状态: {response.data.data.status}</p>
                  <p>您可以在Pipeline执行记录中查看详细进度。</p>
                </div>
              ),
            });
          } else {
            throw new Error(response.data.message || '执行失败');
          }
        } catch (error: any) {
          message.error(`执行Pipeline失败: ${error.message || '未知错误'}`);
          console.error('执行Pipeline错误:', error);
        } finally {
          setExecuting(false);
        }
      }
    });
  };

  /**
   * 下一步（保存并继续）
   */
  const handleNext = async () => {
    if (mode === 'existing') {
      if (!selectedPipelineId) {
        message.warning('请选择一个Pipeline');
        return;
      }
      // Save the selected ID to feature data
      onUpdate({
        pipeline_schema_id: selectedPipelineId,
        // We might want to fetch the schema data too for preview, but ID is enough for linking
        pipeline_schema_data: null // Clear custom data if selecting existing
      });
      onNext();
    } else {
      // New mode: Save and continue
      const success = await handleSavePipeline();
      if (success) {
        onNext();
      }
    }
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');

      // check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const blockData = JSON.parse(type);
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${blockData.type}-${Date.now()}`,
        type: blockData.type,
        position,
        data: {
          label: blockData.label,
          providerRef: blockData.providerRef,
          ...blockData.defaultConfig
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const [smartBuildModalVisible, setSmartBuildModalVisible] = useState(false);
  const [smartBuildPrompt, setSmartBuildPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * 智能生成处理
   */
  const handleSmartBuild = async () => {
    if (!smartBuildPrompt.trim()) {
      message.warning('请输入您的需求');
      return;
    }

    setIsGenerating(true);
    try {
      // @ts-ignore
      const response = await api.pipeline.generatePipeline(smartBuildPrompt);
      if (response.data && response.data.nodes) {
        setNodes(response.data.nodes);
        setEdges(response.data.edges || []);
        message.success('已为您生成流程草稿');
        setSmartBuildModalVisible(false);
        // 自动切换到“新建”模式以便编辑
        setMode('new');
        setSmartBuildPrompt('');
      } else {
        message.error('生成失败，请稍后重试');
      }
    } catch (error: any) {
      message.error(`生成失败: ${error.message || '未知错误'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Title level={2} style={{ marginBottom: 8 }}>流程编排</Title>
        <Text type="secondary">
          {mode === 'existing'
            ? '从“AI智能工厂”中选择已研发好的Pipeline直接使用。'
            : '从左侧积木箱拖拽积木，现场手搓一个新的AI处理流程。'}
        </Text>
      </div>

      {/* Mode Selection */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
        <Radio.Group
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          buttonStyle="solid"
          size="large"
        >
          <Radio.Button value="existing" style={{ padding: '0 32px' }}>
            <RocketOutlined /> 选择已有产品 (推荐)
          </Radio.Button>
          <Radio.Button value="new" style={{ padding: '0 32px' }}>
            <PlusOutlined /> 现场手搓 (新建)
          </Radio.Button>
        </Radio.Group>
      </div>

      {mode === 'existing' ? (
        <div className="bento-card" style={{ maxWidth: 800, margin: '0 auto', padding: '40px' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 16 }}>选择 Pipeline</div>
            <Select
              style={{ width: '100%' }}
              placeholder="搜索并选择一个 Pipeline"
              size="large"
              showSearch
              optionFilterProp="children"
              loading={loadingPipelines}
              value={selectedPipelineId || undefined}
              onChange={setSelectedPipelineId}
            >
              {pipelines.map(p => (
                <Select.Option key={p.pipeline_id} value={p.pipeline_id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <BranchesOutlined />
                      <span style={{ fontWeight: 500 }}>{p.pipeline_name}</span>
                    </Space>
                    <Tag color={p.status === 'published' ? 'green' : 'orange'}>
                      {p.status === 'published' ? '已发布' : '草稿'}
                    </Tag>
                  </div>
                </Select.Option>
              ))}
            </Select>
            <div style={{ marginTop: 12, color: '#666', fontSize: 13 }}>
              <Space>
                <RocketOutlined />
                <span>没有找到想要的？去</span>
                <a href="/admin/pipelines/editor" target="_blank">AI智能工厂</a>
                <span>研发一个新的。</span>
              </Space>
            </div>
          </div>

          {selectedPipelineId && (
            <div style={{
              background: '#F5F5F7',
              borderRadius: 12,
              padding: 24,
              marginTop: 24
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  background: 'white',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  color: '#1890ff',
                  marginRight: 16
                }}>
                  <RocketOutlined />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>
                    {pipelines.find(p => p.pipeline_id === selectedPipelineId)?.pipeline_name}
                  </div>
                  <div style={{ color: '#666' }}>
                    ID: {selectedPipelineId}
                  </div>
                </div>
              </div>
              <div style={{ color: '#666', lineHeight: 1.6 }}>
                {pipelines.find(p => p.pipeline_id === selectedPipelineId)?.pipeline_json?.metadata?.description || '暂无描述'}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bento-card" style={{ padding: 0, overflow: 'hidden', height: '800px', display: 'flex', flexDirection: 'column' }}>
          {/* 工具栏 */}
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#FAFAFA'
          }}>
            <Space>
              <Button
                icon={<SaveOutlined />}
                onClick={handleSavePipeline}
                loading={saving}
                type="primary"
              >
                保存
              </Button>
              <Button
                icon={<PlayCircleOutlined />}
                onClick={handleTestPipeline}
                loading={executing}
                disabled={!data.pipeline_schema_id || data.pipeline_schema_id.startsWith('pipeline-')}
              >
                测试执行
              </Button>
              {/* Smart Build Button */}
              <Button
                icon={<RocketOutlined />} // Fallback icon if bulb is not available, or use BulbOutlined if imported
                onClick={() => setSmartBuildModalVisible(true)}
                className="btn-vision"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  color: 'white'
                }}
              >
                AI 智能生成
              </Button>
            </Space>
            <Alert
              message="从左侧积木箱拖拽积木到画布，连线构建流程。点击节点配置参数。"
              type="info"
              showIcon
              style={{ padding: '4px 12px', border: 'none', background: 'transparent' }}
            />
          </div>

          <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
            {/* 左侧积木箱 */}
            <PipelineBlockSidebar />

            {/* React Flow画布 */}
            <div style={{ flex: 1, position: 'relative' }} onDrop={onDrop} onDragOver={onDragOver}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onInit={setReactFlowInstance}
                nodeTypes={nodeTypes}
                fitView
                style={{ background: '#F5F5F7' }}
              >
                <Controls style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: 'none', borderRadius: 8 }} />
                <MiniMap style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: 'none', borderRadius: 8 }} />
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#E0E0E0" />
              </ReactFlow>
            </div>

            {/* 节点配置面板 - 浮动式 */}
            {selectedNode && (
              <div style={{
                width: '350px',
                borderLeft: '1px solid rgba(0,0,0,0.05)',
                background: 'white',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-4px 0 16px rgba(0,0,0,0.02)',
                zIndex: 10
              }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)', fontWeight: 600 }}>
                  节点配置
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <NodeInspector
                    nodeId={selectedNode.id}
                    nodeType={selectedNode.type}
                    nodeData={selectedNode.data}
                    onChange={(nodeId, newData) => {
                      setNodes((nds) =>
                        nds.map((node) =>
                          node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
                        )
                      );
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 底部操作栏 */}
      <div style={{
        marginTop: 40,
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 24,
        borderTop: '1px solid rgba(0,0,0,0.05)'
      }}>
        <Button size="large" icon={<LeftOutlined />} onClick={onPrev} className="btn-vision-secondary">
          上一步
        </Button>
        <Button
          type="primary"
          size="large"
          icon={<RightOutlined />}
          onClick={handleNext}
          className="btn-vision"
        >
          下一步：预览发布
        </Button>
      </div>

      {/* Smart Build Modal */}
      <Modal
        title={
          <Space>
            <RocketOutlined style={{ color: '#764ba2' }} />
            <span>AI 智能编排</span>
          </Space>
        }
        open={smartBuildModalVisible}
        onCancel={() => setSmartBuildModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ fontSize: 16, marginBottom: 24, color: '#666' }}>
            告诉我您想要什么样的流程，AI 架构师帮您生成草稿。
          </p>
          <div style={{ marginBottom: 24 }}>
            <textarea
              style={{
                width: '100%',
                height: 120,
                padding: 12,
                borderRadius: 8,
                border: '1px solid #d9d9d9',
                resize: 'none',
                fontSize: 14
              }}
              placeholder="例如：先让用户上传一张模特图，然后用 RunningHub 生成 3 张不同风格的衣服展示图，最后打包发邮件给用户。"
              value={smartBuildPrompt}
              onChange={(e) => setSmartBuildPrompt(e.target.value)}
            />
          </div>
          <Button
            type="primary"
            size="large"
            icon={<RocketOutlined />}
            loading={isGenerating}
            onClick={handleSmartBuild}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              width: '100%',
              height: 48,
              fontSize: 16
            }}
          >
            {isGenerating ? 'AI 正在思考架构...' : '开始生成'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
