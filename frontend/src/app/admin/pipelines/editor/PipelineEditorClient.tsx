'use client';

/**
 * Pipeline流程编辑器页面 (修复版)
 * 修复了 import 位置错误的 Bug
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, Button, Space, message, Drawer, Input, Modal, Form, Tag, Row, Col, Tooltip, Layout } from 'antd';
import {
  BranchesOutlined,
  SaveOutlined,
  CodeOutlined,
  FolderOpenOutlined,
  FileAddOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
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
  BackgroundVariant,
  Node,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/components/flow/NodeTypes';
import CustomEdge from '@/components/flow/CustomEdge'; // 正确的 import 位置
import NodeConfigDrawer from '@/components/flow/NodeConfigDrawer';
import ValidationPanel, { ValidationResult } from '@/components/flow/ValidationPanel';
import { adminPipelines } from '@/lib/services/adminPipelines';
import { PipelineSchema, PipelineDTO, PipelineEdge, PipelineNode } from '@/lib/types/pipeline';
import { validatePipelineSchema } from '@/lib/validators';
import { validatePipelineTopology } from '@/lib/utils/pipelineTopology';
import ToolboxPanel from './components/ToolboxPanel';

const { Sider, Content } = Layout;

// 注册自定义连线
const edgeTypes = {
  default: CustomEdge,
  custom: CustomEdge,
};

const initialNodes: Node[] = [];
const initialEdges: any[] = [];

const normalizeEdges = (edgeList: any[] = []): any[] =>
  edgeList.map((edge) => ({
    ...edge,
    type: edge.type ?? 'custom'
  }));

const serializeNodes = (rfNodes: Node[]): PipelineNode[] =>
  rfNodes.map((n) => ({
    id: n.id,
    type: n.type || 'provider',
    position: n.position,
    data: n.data as PipelineNode['data'],
  }));

/**
 * Pipeline编辑器内部组件
 */
function PipelineEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [jsonDrawerVisible, setJsonDrawerVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);

  // Pipeline状态
  const [currentPipeline, setCurrentPipeline] = useState<PipelineDTO | null>(null);
  const [pipelineName, setPipelineName] = useState('未命名Pipeline');
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

  // 测试运行状态
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testInput, setTestInput] = useState('{}');
  const [testing, setTesting] = useState(false);

  const [form] = Form.useForm();
  const reactFlowInstance = useReactFlow();

  /**
   * 连线回调
   */
  const onConnect = useCallback(
    (params: Connection) => {
      const edgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      // 强制使用 custom 类型，确保渲染出带删除按钮的线
      setEdges((eds) => addEdge({ ...params, id: edgeId, type: 'custom' }, eds));
    },
    [setEdges]
  );

  /**
   * 节点点击回调
   */
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setConfigDrawerOpen(true);
  }, []);

  /**
   * 保存节点配置
   */
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

  /**
   * 从积木箱添加节点
   */
  const handleAddNode = (feature: any) => {
    const id = `node_${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'provider',
      position: { 
        x: 250 + Math.random() * 50, 
        y: 100 + Math.random() * 50 
      },
      data: { 
        label: feature.name,
        providerRef: feature.feature_key,
        schema: feature.metadata?.form_schema || [],
        apiConfig: feature.metadata?.api_config
      },
    };
    setNodes((nds) => [...nds, newNode]);
    message.success(`已添加: ${feature.name}`);
  };

  /**
   * 计算可用变量
   */
  const availableVariables = useMemo(() => {
    if (!selectedNode) return [];
    const vars: string[] = [];
    nodes.forEach((node) => {
      if (node.id === selectedNode.id) return;
      if (node.type === 'provider') {
        vars.push(`${node.id}.output`);
      }
    });
    return vars;
  }, [selectedNode, nodes]);

  const handleExportJSON = () => {
    const pipelineData = { nodes: serializeNodes(nodes), edges };
    const jsonString = JSON.stringify(pipelineData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipeline-${Date.now()}.json`;
    link.click();
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (json.nodes && json.edges) {
            setNodes(json.nodes);
            setEdges(normalizeEdges(json.edges));
            message.success('Pipeline导入成功');
          } else {
            message.error('无效的Pipeline JSON文件');
          }
        } catch (error) {
          message.error('JSON解析失败');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleValidate = useCallback(() => {
    setValidating(true);
    const pipelineData: PipelineSchema = {
      version: '1.0',
      nodes: serializeNodes(nodes),
      edges: edges as PipelineEdge[],
    };
    const topologyResult = validatePipelineTopology(pipelineData);
    setValidationResult({
      valid: topologyResult.valid,
      errors: topologyResult.errors || [],
      warnings: topologyResult.warnings || [],
    });
    setValidationDrawerVisible(true);
    setValidating(false);
  }, [nodes, edges]);

  const handleErrorClick = useCallback((nodeId?: string) => {
    if (nodeId) {
      reactFlowInstance.fitView({ nodes: [{ id: nodeId }], duration: 800, padding: 2 });
    }
  }, [reactFlowInstance]);

  const handleSaveToBackend = async (name: string) => {
    setSaving(true);
    try {
      const pipelineData: PipelineSchema = {
        version: '1.0',
        nodes: serializeNodes(nodes),
        edges: edges as PipelineEdge[],
      };
      if (currentPipeline?.pipeline_id) {
        await adminPipelines.update(currentPipeline.pipeline_id, {
          pipeline_name: name,
          pipeline_json: pipelineData,
          status: 'draft',
        });
        message.success('Pipeline更新成功');
        setPipelineName(name);
      } else {
        const newPipeline = await adminPipelines.create({
          pipeline_name: name,
          pipeline_json: pipelineData,
          status: 'draft',
        });
        message.success('Pipeline创建成功');
        setCurrentPipeline(newPipeline);
        setPipelineName(name);
      }
      setSaveModalVisible(false);
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (currentPipeline) {
      form.setFieldsValue({ pipeline_name: currentPipeline.pipeline_name });
    } else {
      form.resetFields();
    }
    setSaveModalVisible(true);
  };

  const loadPipelineList = async () => {
    setLoadingPipelines(true);
    try {
      const res = await adminPipelines.list({ page: 1, pageSize: 100 });
      setPipelines(res.items);
    } catch (error) {
      message.error('加载Pipeline列表失败');
    } finally {
      setLoadingPipelines(false);
    }
  };

  const handleLoadPipeline = async (id: string) => {
    try {
      const pipeline = await adminPipelines.get(id);
      setCurrentPipeline(pipeline);
      setPipelineName(pipeline.pipeline_name);
      if (pipeline.pipeline_json) {
        // @ts-ignore
        setNodes(pipeline.pipeline_json.nodes || []);
        // @ts-ignore
        setEdges(normalizeEdges(pipeline.pipeline_json.edges || []));
      }
      setLoadModalVisible(false);
      message.success(`已加载: ${pipeline.pipeline_name}`);
    } catch (error) {
      message.error('加载Pipeline详情失败');
    }
  };

  const handleNewPipeline = () => {
    Modal.confirm({
      title: '确认新建?',
      content: '当前未保存的修改将会丢失',
      onOk: () => {
        setCurrentPipeline(null);
        setPipelineName('未命名Pipeline');
        setNodes([]);
        setEdges([]);
        setValidationResult(null);
      }
    });
  };

  const handleRunTest = async () => {
    try {
      if (!currentPipeline?.pipeline_id) {
        message.warning('请先保存 Pipeline 再进行测试');
        return;
      }
      let inputData = {};
      try {
        inputData = JSON.parse(testInput);
      } catch (e) {
        message.error('输入参数JSON格式错误');
        return;
      }
      setTesting(true);
      const res = await adminPipelines.testRun(currentPipeline.pipeline_id, {
        pipelineId: currentPipeline.pipeline_id,
        input: inputData,
        variables: {},
      });
      if (res.success) {
        message.success(`测试运行成功`);
        setTestModalVisible(false);
      } else {
        message.error(res.error || '测试运行失败');
      }
    } catch (error) {
      console.error('测试运行失败:', error);
      message.error('测试运行失败');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Layout style={{ height: 'calc(100vh - 64px)' }}>
      {/* 左侧积木箱 */}
      <Sider width={280} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <ToolboxPanel onAddNode={handleAddNode} />
      </Sider>

      {/* 中间编辑器 */}
      <Content>
        <div style={{ height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {/* 顶部工具栏 */}
          <div style={{ 
            padding: '12px 24px', 
            background: '#fff', 
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10
          }}>
            <Space>
              <BranchesOutlined style={{ fontSize: '20px' }} />
              <span style={{ fontSize: '18px', fontWeight: 600 }}>{pipelineName}</span>
              {currentPipeline && <Tag color="blue">{currentPipeline.pipeline_id}</Tag>}
            </Space>
            
            <Space>
              <Button.Group>
                <Tooltip title="新建">
                  <Button icon={<FileAddOutlined />} onClick={handleNewPipeline} />
                </Tooltip>
                <Tooltip title="打开">
                  <Button icon={<FolderOpenOutlined />} onClick={() => { loadPipelineList(); setLoadModalVisible(true); }} />
                </Tooltip>
                <Tooltip title="导入JSON">
                  <Button icon={<CloudUploadOutlined />} onClick={handleImportJSON} />
                </Tooltip>
              </Button.Group>

              <Button.Group>
                <Tooltip title="查看JSON">
                  <Button icon={<CodeOutlined />} onClick={() => setJsonDrawerVisible(true)}>JSON</Button>
                </Tooltip>
                <Tooltip title="校验">
                  <Button icon={<CheckCircleOutlined />} onClick={handleValidate}>校验</Button>
                </Tooltip>
              </Button.Group>

              <Button icon={<PlayCircleOutlined />} onClick={() => setTestModalVisible(true)}>运行</Button>
              
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
                保存
              </Button>
            </Space>
          </div>

          {/* 画布区域 */}
          <div style={{ flex: 1, width: '100%' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes} // 注册自定义连线
              fitView
            >
              <Controls />
              <MiniMap />
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            </ReactFlow>
          </div>
        </div>
      </Content>

      {/* 节点配置侧边栏 */}
      <NodeConfigDrawer
        open={configDrawerOpen}
        node={selectedNode}
        onClose={() => setConfigDrawerOpen(false)}
        onSave={handleSaveNodeConfig}
        availableVariables={availableVariables}
      />

      {/* JSON Drawer */}
      <Drawer title="Pipeline JSON" width={600} open={jsonDrawerVisible} onClose={() => setJsonDrawerVisible(false)}>
        <pre style={{ padding: '16px', background: '#f5f5f5', borderRadius: '4px', overflow: 'auto' }}>
          {JSON.stringify({ nodes, edges }, null, 2)}
        </pre>
      </Drawer>

      {/* 保存 Modal */}
      <Modal
        title="保存Pipeline"
        open={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        onOk={() => form.validateFields().then(v => handleSaveToBackend(v.pipeline_name))}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="pipeline_name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* 打开 Modal */}
      <Modal
        title="打开Pipeline"
        open={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        footer={null}
        width={700}
      >
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {pipelines.map((p) => (
            <Card key={p.pipeline_id} size="small" hoverable style={{ marginBottom: 8 }} onClick={() => p.pipeline_id && handleLoadPipeline(p.pipeline_id)}>
              <Space>
                <BranchesOutlined />
                <b>{p.pipeline_name}</b>
                <Tag>{p.status}</Tag>
              </Space>
            </Card>
          ))}
        </div>
      </Modal>

      {/* 校验 Modal */}
      {validationDrawerVisible && validationResult && (
        <Modal title="校验结果" open={validationDrawerVisible} onCancel={() => setValidationDrawerVisible(false)} footer={null}>
          <ValidationPanel validation={validationResult} onErrorClick={handleErrorClick} />
        </Modal>
      )}

      {/* 测试 Modal */}
      <Modal
        title="测试运行"
        open={testModalVisible}
        onOk={handleRunTest}
        onCancel={() => setTestModalVisible(false)}
        confirmLoading={testing}
      >
        <Input.TextArea rows={10} value={testInput} onChange={e => setTestInput(e.target.value)} placeholder='{ "prompt": "test" }' />
      </Modal>
    </Layout>
  );
}

export default function PipelineEditorClient() {
  return (
    <ReactFlowProvider>
      <PipelineEditor />
    </ReactFlowProvider>
  );
}
