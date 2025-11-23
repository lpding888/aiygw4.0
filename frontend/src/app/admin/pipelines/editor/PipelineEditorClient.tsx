'use client';

/**
 * Pipeline流程编辑器页面
 * 艹，这个tm是拖拽构建AI Pipeline的核心页面！
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, Button, Space, message, Drawer, Input, Modal, Form, Select, Tag, Row, Col, Tooltip, Dropdown, Menu } from 'antd';
import {
  BranchesOutlined,
  SaveOutlined,
  CodeOutlined,
  PlusOutlined,
  FolderOpenOutlined,
  FileAddOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  SyncOutlined,
  DownOutlined,
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/components/flow/NodeTypes';
import NodeConfigDrawer from '@/components/flow/NodeConfigDrawer';
import ValidationPanel, { ValidationResult } from '@/components/flow/ValidationPanel';
import { adminPipelines } from '@/lib/services/adminPipelines';
import { PipelineSchema, PipelineDTO, PipelineEdge, PipelineNode } from '@/lib/types/pipeline';
import { validatePipelineSchema } from '@/lib/validators';
import { validatePipelineTopology } from '@/lib/utils/pipelineTopology';
import api from '@/lib/api';

/**
 * 初始节点示例
 */
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'provider',
    position: { x: 250, y: 50 },
    data: { label: 'OpenAI GPT-4', providerRef: 'openai-gpt4' },
  },
  {
    id: '2',
    type: 'condition',
    position: { x: 250, y: 200 },
    data: { label: '判断结果质量', condition: 'output.quality > 0.8' },
  },
  {
    id: '3',
    type: 'postProcess',
    position: { x: 100, y: 350 },
    data: { label: '结果优化', processor: 'enhance' },
  },
  {
    id: '4',
    type: 'end',
    position: { x: 400, y: 350 },
    data: { label: '直接输出' },
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3', sourceHandle: 'true' },
  { id: 'e2-4', source: '2', target: '4', sourceHandle: 'false' },
];

const serializeNodes = (rfNodes: Node[]): PipelineNode[] =>
  rfNodes.map((n) => ({
    id: n.id,
    type: n.type || 'provider',
    position: n.position,
    data: n.data as PipelineNode['data'],
  }));

/**
 * Pipeline编辑器内部组件
 * 艹！使用React Flow的hooks，必须在ReactFlowProvider内部！
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

  // 校验状态 (CMS-209)
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
      setEdges((eds) => addEdge({ ...params, id: edgeId }, eds));
    },
    [setEdges]
  );

  /**
   * 节点点击回调
   * 艹，点击节点时打开配置侧边栏！
   */
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    console.log('[点击节点]', node);
    setSelectedNode(node);
    setConfigDrawerOpen(true);
  }, []);

  /**
   * 保存节点配置
   * 艹，更新节点的data！
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
   * 计算可用变量
   * 艹，根据节点拓扑顺序，找出当前节点之前的所有节点输出！
   */
  const availableVariables = useMemo(() => {
    if (!selectedNode) return [];

    // 找出所有在当前节点之前的节点
    const vars: string[] = [];

    // 简化版：遍历所有节点，添加变量
    nodes.forEach((node) => {
      if (node.id === selectedNode.id) return; // 跳过当前节点

      // 根据节点类型添加输出变量
      if (node.type === 'provider') {
        vars.push(`${node.id}.output`);
        vars.push(`${node.id}.tokens`);
      } else if (node.type === 'postProcess') {
        vars.push(`${node.id}.result`);
      }
    });

    return vars;
  }, [selectedNode, nodes]);

  /**
   * 添加Provider节点
   */
  const addProviderNode = () => {
    const id = `provider-${Date.now()}`;
    const newNode = {
      id,
      type: 'provider',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: '新Provider', providerRef: '' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 添加条件节点
   */
  const addConditionNode = () => {
    const id = `condition-${Date.now()}`;
    const newNode = {
      id,
      type: 'condition',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: '新条件', condition: '' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 添加后处理节点
   */
  const addPostProcessNode = () => {
    const id = `postprocess-${Date.now()}`;
    const newNode = {
      id,
      type: 'postProcess',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: '新后处理', processor: '' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 添加结束节点
   */
  const addEndNode = () => {
    const id = `end-${Date.now()}`;
    const newNode = {
      id,
      type: 'end',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: '结束' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 添加Fork节点
   */
  const addForkNode = () => {
    const id = `fork-${Date.now()}`;
    const newNode = {
      id,
      type: 'fork',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: 'Fork' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 添加Join节点
   */
  const addJoinNode = () => {
    const id = `join-${Date.now()}`;
    const newNode = {
      id,
      type: 'join',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: { label: 'Join' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 导出JSON
   */
  const handleExportJSON = () => {
    const pipelineData = {
      nodes: serializeNodes(nodes),
      edges,
    };
    const jsonString = JSON.stringify(pipelineData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipeline-${Date.now()}.json`;
    link.click();
  };

  /**
   * 导入JSON
   */
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
            setEdges(json.edges);
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

  /**
   * 校验Pipeline (CMS-209)
   */
  const handleValidate = useCallback(() => {
    setValidating(true);
    setValidationDrawerVisible(true);

    // 1. 基础Schema校验
    const pipelineData: PipelineSchema = {
      version: '1.0',
      nodes: serializeNodes(nodes),
      edges: edges as PipelineEdge[],
    };

    const schemaResult = validatePipelineSchema(pipelineData);
    // 转换为 ValidationResult 格式
    const schemaValidation: ValidationResult = {
      valid: schemaResult.success,
      errors: schemaResult.errors || [],
      warnings: schemaResult.warnings || [],
    };

    if (!schemaValidation.valid) {
      setValidationResult(schemaValidation);
      setValidating(false);
      return;
    }

    // 2. 拓扑结构校验 - TopologyValidationResult 已有 valid 属性
    const topologyResult = validatePipelineTopology(pipelineData);
    const topologyValidation: ValidationResult = {
      valid: topologyResult.valid,
      errors: topologyResult.errors || [],
      warnings: topologyResult.warnings || [],
    };

    setValidationResult(topologyValidation);
    setValidating(false);

    if (topologyValidation.valid) {
      message.success('Pipeline校验通过');
    } else {
      message.warning('Pipeline存在问题，请查看详情');
    }
  }, [nodes, edges]);

  /**
   * 点击错误定位节点
   */
  const handleErrorClick = useCallback((nodeId?: string) => {
    if (nodeId) {
      reactFlowInstance.fitView({ nodes: [{ id: nodeId }], duration: 800, padding: 2 });
      // 高亮节点逻辑可以后续添加
    }
  }, [reactFlowInstance]);

  /**
   * 保存Pipeline到后端
   */
  const handleSaveToBackend = async (name: string) => {
    setSaving(true);
    try {
      const pipelineData: PipelineSchema = {
        version: '1.0',
        nodes: serializeNodes(nodes),
        edges: edges as PipelineEdge[],
      };

      // 自动校验
      const topologyResult = validatePipelineTopology(pipelineData);
      if (!topologyResult.valid) {
        message.error('Pipeline校验未通过，无法保存');
        setValidationResult(topologyResult);
        setValidationDrawerVisible(true);
        setSaving(false);
        return;
      }

      if (currentPipeline?.pipeline_id) {
        // 更新
        await adminPipelines.update(currentPipeline.pipeline_id, {
          pipeline_name: name,
          pipeline_json: pipelineData,
          status: 'draft', // 保存为草稿
        });
        message.success('Pipeline更新成功');
        setPipelineName(name);
      } else {
        // 新建
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

  /**
   * 点击保存按钮
   */
  const handleSave = () => {
    if (currentPipeline) {
      form.setFieldsValue({ pipeline_name: currentPipeline.pipeline_name });
    } else {
      form.resetFields();
    }
    setSaveModalVisible(true);
  };

  /**
   * 加载Pipeline列表
   */
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

  /**
   * 加载指定Pipeline
   */
  const handleLoadPipeline = async (id: string) => {
    try {
      const pipeline = await adminPipelines.get(id);
      setCurrentPipeline(pipeline);
      setPipelineName(pipeline.pipeline_name);

      if (pipeline.pipeline_json) {
        // @ts-ignore
        setNodes(pipeline.pipeline_json.nodes || []);
        // @ts-ignore
        setEdges(pipeline.pipeline_json.edges || []);
      }

      setLoadModalVisible(false);
      message.success(`已加载: ${pipeline.pipeline_name}`);
    } catch (error) {
      message.error('加载Pipeline详情失败');
    }
  };

  /**
   * 新建Pipeline
   */
  const handleNewPipeline = () => {
    Modal.confirm({
      title: '确认新建?',
      content: '当前未保存的修改将会丢失',
      onOk: () => {
        setCurrentPipeline(null);
        setPipelineName('未命名Pipeline');
        setNodes(initialNodes);
        setEdges(initialEdges);
        setValidationResult(null);
      }
    });
  };

  /**
   * 运行测试
   */
  const handleRunTest = async () => {
    try {
      // 检查 Pipeline 是否已保存
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

      // 调用后端测试接口
      const res = await adminPipelines.testRun(currentPipeline.pipeline_id, {
        pipelineId: currentPipeline.pipeline_id,
        input: inputData,
        variables: {},
      });

      if (res.success) {
        message.success(`测试运行成功，耗时: ${res.duration}ms`);
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
    <div style={{ padding: '24px' }}>
      <Row gutter={16}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <BranchesOutlined style={{ fontSize: '20px' }} />
                <span style={{ fontSize: '18px', fontWeight: 600 }}>Pipeline编辑器</span>
                <Tag color={currentPipeline ? 'green' : 'default'}>
                  {pipelineName}
                </Tag>
                {currentPipeline && (
                  <Tag color="blue">ID: {currentPipeline.pipeline_id}</Tag>
                )}
              </Space>
            }
            extra={
              <Space>
                <Button.Group>
                  <Tooltip title="新建空白Pipeline">
                    <Button icon={<FileAddOutlined />} onClick={handleNewPipeline}>
                      新建
                    </Button>
                  </Tooltip>
                  <Tooltip title="打开已有Pipeline">
                    <Button
                      icon={<FolderOpenOutlined />}
                      onClick={() => {
                        loadPipelineList();
                        setLoadModalVisible(true);
                      }}
                    >
                      打开
                    </Button>
                  </Tooltip>
                  <Tooltip title="导入JSON文件">
                    <Button icon={<CloudUploadOutlined />} onClick={handleImportJSON}>
                      导入
                    </Button>
                  </Tooltip>
                </Button.Group>

                <Dropdown
                  overlay={
                    <Menu>
                      <Menu.Item key="provider" onClick={addProviderNode}>
                        Provider节点 (AI模型)
                      </Menu.Item>
                      <Menu.Item key="condition" onClick={addConditionNode}>
                        条件节点 (逻辑判断)
                      </Menu.Item>
                      <Menu.Item key="postProcess" onClick={addPostProcessNode}>
                        后处理节点 (结果优化)
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item key="fork" onClick={addForkNode}>
                        FORK (并行分支)
                      </Menu.Item>
                      <Menu.Item key="join" onClick={addJoinNode}>
                        JOIN (汇合分支)
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item key="end" onClick={addEndNode}>
                        结束节点
                      </Menu.Item>
                    </Menu>
                  }
                >
                  <Button icon={<PlusOutlined />}>
                    添加节点 <DownOutlined />
                  </Button>
                </Dropdown>

                <Button.Group>
                  <Tooltip title="查看Pipeline JSON结构">
                    <Button icon={<CodeOutlined />} onClick={() => setJsonDrawerVisible(true)}>
                      JSON
                    </Button>
                  </Tooltip>
                  <Tooltip title="校验Pipeline拓扑结构">
                    <Button
                      icon={<CheckCircleOutlined />}
                      onClick={handleValidate}
                      loading={validating}
                      type={validationResult?.valid ? 'default' : 'dashed'}
                    >
                      {validating ? '校验中' : '校验'}
                    </Button>
                  </Tooltip>
                </Button.Group>

                <Tooltip title="运行测试">
                  <Button
                    icon={<PlayCircleOutlined />}
                    onClick={() => setTestModalVisible(true)}
                    style={{ borderColor: '#52c41a', color: '#52c41a' }}
                  >
                    运行
                  </Button>
                </Tooltip>

                <Tooltip title={currentPipeline ? '保存修改' : '保存为新Pipeline'}>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                  >
                    保存
                  </Button>
                </Tooltip>
              </Space>
            }
            bodyStyle={{ padding: 0, height: 'calc(100vh - 200px)' }}
          >
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
              >
                <Controls />
                <MiniMap />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
              </ReactFlow>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 节点配置侧边栏 */}
      <NodeConfigDrawer
        open={configDrawerOpen}
        node={selectedNode}
        onClose={() => setConfigDrawerOpen(false)}
        onSave={handleSaveNodeConfig}
        availableVariables={availableVariables}
      />

      {/* JSON Drawer */}
      <Drawer
        title="Pipeline JSON"
        width={600}
        open={jsonDrawerVisible}
        onClose={() => setJsonDrawerVisible(false)}
        extra={
          <Button icon={<CodeOutlined />} onClick={handleExportJSON}>
            导出JSON
          </Button>
        }
      >
        <pre
          style={{
            padding: '16px',
            background: '#f5f5f5',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '12px',
            lineHeight: '1.6',
          }}
        >
          {JSON.stringify({ nodes, edges }, null, 2)}
        </pre>
      </Drawer>

      {/* 保存Pipeline Modal */}
      <Modal
        title={<Space><SaveOutlined /> 保存Pipeline</Space>}
        open={saveModalVisible}
        onCancel={() => setSaveModalVisible(false)}
        onOk={() => {
          form.validateFields().then((values) => {
            handleSaveToBackend(values.pipeline_name);
          });
        }}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Pipeline名称"
            name="pipeline_name"
            rules={[
              { required: true, message: '请输入Pipeline名称' },
              { min: 2, message: '名称至少2个字符' },
            ]}
          >
            <Input placeholder="例如：用户问答Pipeline" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 打开Pipeline Modal */}
      <Modal
        title={<Space><FolderOpenOutlined /> 打开Pipeline</Space>}
        open={loadModalVisible}
        onCancel={() => setLoadModalVisible(false)}
        footer={null}
        width={700}
      >
        {loadingPipelines ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <p>加载中...</p>
          </div>
        ) : pipelines.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px',
              color: '#999',
            }}
          >
            <BranchesOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <p>暂无Pipeline</p>
          </div>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {pipelines.map((pipeline) => (
              <Card
                key={pipeline.pipeline_id}
                size="small"
                hoverable
                style={{ marginBottom: '12px', cursor: 'pointer' }}
                onClick={() => pipeline.pipeline_id && handleLoadPipeline(pipeline.pipeline_id)}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <BranchesOutlined />
                    <span style={{ fontWeight: 600 }}>{pipeline.pipeline_name}</span>
                    <Tag color={pipeline.status === 'published' ? 'green' : 'default'}>
                      {pipeline.status === 'published' ? '已发布' : '草稿'}
                    </Tag>
                  </Space>
                  {pipeline.pipeline_json?.metadata?.description && (
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {pipeline.pipeline_json.metadata.description}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    更新时间: {pipeline.updated_at || '未知'}
                  </div>
                </Space>
              </Card>
            ))}
          </div>
        )}
      </Modal>

      {/* 校验面板 */}
      {validationDrawerVisible && validationResult && (
        <Modal
          title="校验结果"
          open={validationDrawerVisible}
          onCancel={() => setValidationDrawerVisible(false)}
          footer={null}
          width={600}
        >
          <ValidationPanel
            validation={validationResult}
            onErrorClick={(error) => {
              handleErrorClick(error);
              setValidationDrawerVisible(false);
            }}
          />
        </Modal>
      )}

      {/* 测试运行弹窗 */}
      <Modal
        title="测试运行Pipeline"
        open={testModalVisible}
        onOk={handleRunTest}
        onCancel={() => setTestModalVisible(false)}
        confirmLoading={testing}
        okText="开始运行"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <p>请输入测试用的输入参数 (JSON格式):</p>
          <Input.TextArea
            rows={10}
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder='{ "prompt": "a cute cat", "style": "anime" }'
            style={{ fontFamily: 'monospace' }}
          />
        </div>
        <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '8px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>
            注意：测试运行将创建一个临时的任务记录，并立即触发Pipeline执行。
            执行结果请前往任务列表查看。
          </p>
        </div>
      </Modal>
    </div>
  );
}

/**
 * 外部包装组件
 * 艹！必须包裹在ReactFlowProvider中！
 */
export default function PipelineEditorClient() {
  return (
    <ReactFlowProvider>
      <PipelineEditor />
    </ReactFlowProvider>
  );
}
