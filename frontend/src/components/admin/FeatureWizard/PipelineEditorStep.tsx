/**
 * Step 3: 流程编排步骤（CMS-208核心）
 * Visionary Theme: Visual Pipeline Editor
 */

'use client';

import { useState, useCallback } from 'react';
import { Button, Space, message, Alert, Typography, Modal } from 'antd';
import { SaveOutlined, EyeOutlined, PlusOutlined, LeftOutlined, RightOutlined, PlayCircleOutlined } from '@ant-design/icons';
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
  const [nodes, setNodes, onNodesChange] = useNodesState(
    data.pipeline_schema_data?.nodes || initialNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    data.pipeline_schema_data?.edges || initialEdges
  );
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);

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
      return;
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
      } else {
        throw new Error(response.message || '保存失败');
      }
    } catch (error: any) {
      message.error(`保存Pipeline失败: ${error.message || '未知错误'}`);
      console.error('保存Pipeline错误:', error);
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
            throw new Error(response.message || '执行失败');
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
    await handleSavePipeline();
    onNext();
  };

  return (
    <div className="animate-fade-up">
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Title level={2} style={{ marginBottom: 8 }}>流程编排</Title>
        <Text type="secondary">可视化编排AI处理流程，连接不同的处理节点。</Text>
      </div>

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
            <Button icon={<PlusOutlined />} onClick={handleAddProviderNode}>添加Provider节点</Button>
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
          </Space>
          <Alert
            message="从左侧添加节点，拖拽连线构建流程。点击节点配置参数。保存后可执行测试。"
            type="info"
            showIcon
            style={{ padding: '4px 12px', border: 'none', background: 'transparent' }}
          />
        </div>

        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          {/* React Flow画布 */}
          <div style={{ flex: 1, position: 'relative' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
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
    </div>
  );
}
