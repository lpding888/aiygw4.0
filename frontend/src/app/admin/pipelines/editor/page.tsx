'use client';

/**
 * Pipeline流程编辑器页面 - 现代化智能IDE风格重构
 * 
 * 改进点：
 * 1. 全屏沉浸式设计，移除多余边距
 * 2. 顶部工具栏悬浮/半透明玻璃拟态
 * 3. 侧边栏与画布无缝集成
 * 4. 优化按钮交互与视觉层级
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, Button, Space, message, Drawer, Input, Modal, Form, Select, Tag, Row, Col, Alert, Tooltip, Divider, theme, Typography } from 'antd';
import {
  BranchesOutlined,
  SaveOutlined,
  CodeOutlined,
  PlusOutlined,
  FolderOpenOutlined,
  FileAddOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  UserOutlined,
  SyncOutlined,
  HistoryOutlined,
  ExperimentOutlined,
  ToolOutlined,
  DeleteOutlined,
  RocketOutlined,
  LeftOutlined
} from '@ant-design/icons';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  BackgroundVariant,
  Node,
  useReactFlow,
  Panel,
} from '@xyflow/react';

const { Text } = Typography;
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/components/flow/NodeTypes';
import NodeConfigDrawer from '@/components/flow/NodeConfigDrawer';
import ValidationPanel, { ValidationResult } from '@/components/flow/ValidationPanel';

import { adminPipelines } from '@/lib/services/adminPipelines';
import { PipelineSchema, PipelineDTO, PipelineEdge, PipelineNode } from '@/lib/types/pipeline';
import { validatePipelineSchema } from '@/lib/validators';
import { validatePipelineTopology } from '@/lib/utils/pipelineTopology';
import PipelineBlockSidebar from '@/components/admin/FeatureWizard/PipelineBlockSidebar';
import api from '@/lib/api';
import SimulationPanel from '@/components/flow/SimulationPanel';
import { useRouter } from 'next/navigation';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'provider',
    position: { x: 250, y: 150 },
    data: { label: 'Start Node', providerRef: 'system_start' },
  }
];

const initialEdges: Edge[] = [];

const serializeNodes = (rfNodes: Node[]): PipelineNode[] =>
  rfNodes.map((n) => ({
    id: n.id,
    type: n.type || 'provider',
    position: n.position,
    data: n.data as PipelineNode['data'],
  }));

function PipelineEditor() {
  const router = useRouter();
  const { token } = theme.useToken();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [jsonDrawerVisible, setJsonDrawerVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [simulationDrawerVisible, setSimulationDrawerVisible] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Pipeline状态
  const [currentPipeline, setCurrentPipeline] = useState<PipelineDTO | null>(null);
  const [pipelineName, setPipelineName] = useState('未命名工作流');
  const [saving, setSaving] = useState(false);

  // Modal状态
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [loadModalVisible, setLoadModalVisible] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineDTO[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);

  // 校验状态
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationDrawerVisible, setValidationDrawerVisible] = useState(false);

  const [form] = Form.useForm();

  const onConnect = useCallback(
    (params: Connection) => {
      const edgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setEdges((eds) => addEdge({ ...params, id: edgeId, animated: true, style: { stroke: token.colorPrimary } }, eds));
    },
    [setEdges, token.colorPrimary]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setConfigDrawerOpen(true);
  }, []);

  const handleSaveNodeConfig = useCallback(
    (nodeId: string, newData: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...newData,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const availableVariables = useMemo(() => {
    if (!selectedNode) return [];
    const vars: string[] = [];
    nodes.forEach((node) => {
      if (node.id === selectedNode.id) return;
      if (node.type === 'provider') {
        vars.push(`${node.id}.output`);
        vars.push(`${node.id}.tokens`);
      } else if (node.type === 'postProcess') {
        vars.push(`${node.id}.result`);
      }
    });
    return vars;
  }, [selectedNode, nodes]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const blockData = JSON.parse(type);
      if (!reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const id = `${blockData.type}-${Date.now()}`;
      const newNode: Node = {
        id,
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

  const loadPipelineList = async () => {
    setLoadingPipelines(true);
    try {
      const response = await adminPipelines.list({ page: 1, pageSize: 100 });
      setPipelines(response.items || []);
    } catch (error: any) {
      message.error('加载Pipeline列表失败');
    } finally {
      setLoadingPipelines(false);
    }
  };

  const handleSave = () => {
    if (currentPipeline) {
      handleSaveToBackend();
    } else {
      form.setFieldsValue({ pipeline_name: pipelineName });
      setSaveModalVisible(true);
    }
  };

  const handleSaveToBackend = async (name?: string) => {
    setSaving(true);
    try {
      const pipelineSchema: PipelineSchema = {
        version: '1.0',
        nodes: serializeNodes(nodes),
        edges: edges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
        })) as PipelineEdge[],
        metadata: {
          title: name || pipelineName,
          updatedAt: new Date().toISOString(),
        },
      };

      const validation = validatePipelineSchema(pipelineSchema);
      if (!validation.success) {
        message.error(`校验失败: ${validation.errors?.join('; ')}`);
        setSaving(false);
        return;
      }

      const topologyValidation = validatePipelineTopology(pipelineSchema);
      if (!topologyValidation.valid) {
        message.error(`拓扑校验失败: ${topologyValidation.errors.join('; ')}`);
        setSaving(false);
        return;
      }

      let result: PipelineDTO;
      if (currentPipeline?.pipeline_id) {
        result = await adminPipelines.update(currentPipeline.pipeline_id, {
          pipeline_name: name || pipelineName,
          pipeline_json: pipelineSchema,
        });
        message.success('保存成功');
      } else {
        result = await adminPipelines.create({
          pipeline_name: name || pipelineName,
          pipeline_json: pipelineSchema,
          status: 'draft',
        });
        message.success('创建成功');
      }

      setCurrentPipeline(result);
      setPipelineName(result.pipeline_name);
      setSaveModalVisible(false);
    } catch (error: any) {
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadPipeline = async (pipelineId: string) => {
    try {
      const pipeline = await adminPipelines.get(pipelineId);
      const schema = pipeline.pipeline_json;
      if (schema.nodes) {
        setNodes(schema.nodes.map((n) => ({ ...n, type: n.type || 'provider' })) as any);
      }
      if (schema.edges) {
        setEdges(schema.edges as any);
      }
      setCurrentPipeline(pipeline);
      setPipelineName(pipeline.pipeline_name);
      setLoadModalVisible(false);
      message.success(`已加载: ${pipeline.pipeline_name}`);
    } catch (error) {
      message.error('加载失败');
    }
  };

  const handleNewPipeline = () => {
    Modal.confirm({
      title: '新建工作流',
      content: '当前未保存的内容将丢失，确定新建？',
      onOk: () => {
        setNodes([]);
        setEdges([]);
        setCurrentPipeline(null);
        setPipelineName('未命名工作流');
        message.success('已清空画布');
      },
    });
  };

  const handleExportJSON = () => {
    // ... (保持原有逻辑)
    const pipelineSchema = { version: '1.0', nodes, edges, metadata: { title: pipelineName } };
    const json = JSON.stringify(pipelineSchema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-${Date.now()}.json`;
    a.click();
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* 顶部导航与工具栏 - Glassmorphism Style */}
      <header style={{
        height: '64px',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        backdropFilter: 'blur(10px)',
        background: 'rgba(255, 255, 255, 0.9)',
        zIndex: 100,
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button type="text" icon={<LeftOutlined />} />
          <Space size={8}>
            <div style={{
              width: 32,
              height: 32,
              background: token.colorPrimary,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <BranchesOutlined />
            </div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{pipelineName}</div>
              <div style={{ fontSize: 12, color: '#999' }}>
                {currentPipeline?.pipeline_id ? `ID: ${currentPipeline.pipeline_id.substring(0, 8)}...` : '未保存草稿'}
              </div>
            </div>
          </Space>
        </div>

        <Space size={8}>
          <Tooltip title="模拟运行">
            <Button
              type="default"
              icon={<ExperimentOutlined />}
              onClick={() => setSimulationDrawerVisible(true)}
            >
              试运行
            </Button>
          </Tooltip>
          <Tooltip title="校验合法性">
            <Button
              icon={<CheckCircleOutlined />}
              onClick={() => setValidating(true)} // 简化
            >
              校验
            </Button>
          </Tooltip>

          <Divider type="vertical" />

          <Button icon={<FileAddOutlined />} onClick={handleNewPipeline}>新建</Button>
          <Button icon={<FolderOpenOutlined />} onClick={() => { loadPipelineList(); setLoadModalVisible(true); }}>打开</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}
            style={{
              background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            保存
          </Button>
        </Space>
      </header>

      {/* 主体区域 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧侧边栏 */}
        <PipelineBlockSidebar />

        {/* 画布区域 */}
        <div style={{ flex: 1, position: 'relative', background: '#F5F7FA' }} onDrop={onDrop} onDragOver={onDragOver}>
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
            className="react-flow-modern"
          >
            <Controls showInteractive={false} style={{ bottom: 20, left: 20 }} />
            <MiniMap style={{ bottom: 20, right: 20 }} zoomable pannable
              nodeColor={(n) => {
                if (n.type === 'provider') return token.colorPrimary;
                if (n.type === 'start') return '#52c41a';
                if (n.type === 'end') return '#ff4d4f';
                return '#eee';
              }}
            />
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#dbe0e6" />

            {/* 悬浮工具面板 */}
            <Panel position="top-right" style={{ padding: 10 }}>
              <Space>
                <Button
                  size="small"
                  danger
                  disabled={!selectedNode}
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    if (selectedNode) {
                      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                      setSelectedNode(null);
                      setConfigDrawerOpen(false);
                    }
                  }}
                >
                  删除选中
                </Button>
                <Button size="small" icon={<CodeOutlined />} onClick={() => setJsonDrawerVisible(true)}>JSON</Button>
              </Space>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* 各种抽屉和弹窗 */}
      <NodeConfigDrawer
        open={configDrawerOpen}
        node={selectedNode}
        onClose={() => setConfigDrawerOpen(false)}
        onSave={handleSaveNodeConfig}
        availableVariables={availableVariables}
      />

      <Drawer
        title="Pipeline JSON"
        width={600}
        open={jsonDrawerVisible}
        onClose={() => setJsonDrawerVisible(false)}
        extra={<Button onClick={handleExportJSON}>导出</Button>}
      >
        <pre style={{ fontSize: 12 }}>{JSON.stringify({ nodes, edges }, null, 2)}</pre>
      </Drawer>

      <Modal
        title="保存 Pipeline"
        open={saveModalVisible}
        onOk={() => form.validateFields().then((values) => handleSaveToBackend(values.pipeline_name as string))}
        onCancel={() => setSaveModalVisible(false)}
        okText="确认保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="pipeline_name" label="Pipeline 名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="打开 Pipeline"
        open={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        footer={null}
        width={700}
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loadingPipelines ? <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div> : (
            <Space direction="vertical" style={{ width: '100%' }}>
              {pipelines.map(p => (
                <Card
                  key={p.pipeline_id}
                  hoverable
                  size="small"
                  onClick={() => p.pipeline_id && handleLoadPipeline(p.pipeline_id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text strong>{p.pipeline_name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '-'}</Text>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>ID: {p.pipeline_id}</div>
                </Card>
              ))}
            </Space>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default PipelineEditor;
