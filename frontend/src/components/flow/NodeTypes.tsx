'use client';

/**
 * React Flow节点类型定义 (美化版 - n8n style)
 */

import React from 'react';
import { Position, NodeProps } from '@xyflow/react';
import type { NodeTypes } from '@xyflow/react';
import {
  ApiOutlined,
  BranchesOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  MailOutlined,
  CloudUploadOutlined,
  FileImageOutlined,
  PlayCircleFilled
} from '@ant-design/icons';
import NodeCard from './NodeCard';
import ForkNode from './nodes/ForkNode';
import JoinNode from './nodes/JoinNode';

export function StartNode({ id, data, selected }: NodeProps) {
  return (
    <NodeCard
      id={id}
      selected={selected}
      type="start"
      label={(data.label as string) || '开始'}
      status={data.status as any}
      handles={[{ type: 'source', position: Position.Bottom }]}
    />
  );
}

export function ProviderNode({ id, data, selected }: NodeProps) {
  const paramsCount = data.schema ? (data.schema as any[]).length : 0;
  const providerRef = data.providerRef as string;

  // 根据providerRef决定图标
  const getIcon = (ref: string) => {
    if (!ref) return <ApiOutlined style={{ color: 'white' }} />;
    if (ref.includes('runninghub')) return <ThunderboltOutlined style={{ color: 'white' }} />;
    if (ref.includes('deepseek') || ref.includes('llm')) return <span style={{ fontSize: 14, fontWeight: 'bold', color: 'white' }}>AI</span>;
    if (ref.includes('email') || ref.includes('notification')) return <MailOutlined style={{ color: 'white' }} />;
    if (ref.includes('storage') || ref.includes('cos')) return <CloudUploadOutlined style={{ color: 'white' }} />;
    if (ref.includes('image')) return <FileImageOutlined style={{ color: 'white' }} />;
    return <ApiOutlined style={{ color: 'white' }} />;
  };

  const stats: Record<string, string | number> = {};
  if (providerRef) {
    stats['Provider'] = providerRef.length > 20 ? providerRef.substring(0, 18) + '..' : providerRef;
  }
  if (paramsCount > 0) {
    stats['Params'] = paramsCount;
  }

  return (
    <NodeCard
      id={id}
      selected={selected}
      type="provider"
      label={(data.label as string) || 'AI 模型'}
      status={data.status as any}
      icon={getIcon(providerRef)}
      stats={stats}
      handles={[
        { type: 'target', position: Position.Top },
        { type: 'source', position: Position.Bottom }
      ]}
    />
  );
}

export function ConditionNode({ id, data, selected }: NodeProps) {
  return (
    <NodeCard
      id={id}
      selected={selected}
      type="condition"
      label={(data.label as string) || '条件判断'}
      status={data.status as any}
      handles={[
        { type: 'target', position: Position.Top },
        { type: 'source', position: Position.Bottom, id: 'true' }, // True path (Left/Center usually, but simpler to stack for now)
        // For condition nodes, we often want custom handles. 
        // NodeCard handles prop is flexible, but visual layout of text "True/False" needs to be inside or absolute.
      ]}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px' }}>
        <span style={{ color: '#52c41a', fontSize: 12 }}>True ↓</span>
        <span style={{ color: '#ff4d4f', fontSize: 12 }}>False ↓</span>
      </div>
      {/* Custom handles for specific positioning if needed, overriding NodeCard's default strict list if we wanted, 
             but here passing handles to NodeCard puts them in center. 
             Let's use a custom implementation for handles here to match the text. */}
      <div style={{ position: 'absolute', bottom: -6, left: '30%', width: 10, height: 10, background: '#52c41a', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: -6, left: '70%', width: 10, height: 10, background: '#ff4d4f', borderRadius: '50%' }} />
    </NodeCard>
  );
}
// Overriding ConditionNode to match the exact Handle logic of NodeTypes which used custom positioning
export function ConditionNodeFixed({ id, data, selected }: NodeProps) {
  return (
    <NodeCard
      id={id}
      selected={selected}
      type="condition"
      label={(data.label as string) || '条件判断'}
      status={data.status as any}
      handles={[{ type: 'target', position: Position.Top }]} // Only input handle is standard
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ color: '#52c41a', fontSize: 12, marginLeft: 10 }}>是</span>
        <span style={{ color: '#ff4d4f', fontSize: 12, marginRight: 10 }}>否</span>
      </div>
      {/* Custom Output Handles */}
      <div className="react-flow__handle react-flow__handle-bottom source" style={{ left: '30%', background: '#52c41a', bottom: -5, position: 'absolute', width: 8, height: 8, borderRadius: '50%' }} data-handleid="true"></div>
      <div className="react-flow__handle react-flow__handle-bottom source" style={{ left: '70%', background: '#ff4d4f', bottom: -5, position: 'absolute', width: 8, height: 8, borderRadius: '50%' }} data-handleid="false"></div>
    </NodeCard>
  )
}


export function PostProcessNode({ id, data, selected }: NodeProps) {
  return (
    <NodeCard
      id={id}
      selected={selected}
      type="postProcess"
      label={(data.label as string) || '数据处理'}
      status={data.status as any}
      icon={<ToolOutlined style={{ color: 'white' }} />}
      stats={{
        'Processor': (data.processor as string) || 'None'
      }}
      handles={[
        { type: 'target', position: Position.Top },
        { type: 'source', position: Position.Bottom }
      ]}
    />
  );
}

export function EndNode({ id, data, selected }: NodeProps) {
  return (
    <NodeCard
      id={id}
      selected={selected}
      type="end"
      label={(data.label as string) || '流程结束'}
      status={data.status as any}
      icon={<CheckCircleOutlined style={{ color: 'white' }} />}
      handles={[
        { type: 'target', position: Position.Top }
      ]}
    >
      <div style={{ fontSize: 12, color: '#666' }}>
        输出变量: <span style={{ fontFamily: 'monospace' }}>{(data.outputKey as string) || 'final_result'}</span>
      </div>
    </NodeCard>
  );
}

export function AgentNode({ id, data, selected }: NodeProps) {
  const toolCount = data.tools ? (data.tools as any[]).length : 0;
  const goal = data.goal as string;

  return (
    <NodeCard
      id={id}
      selected={selected}
      type="agent"
      label={(data.label as string) || '智能体 (Agent)'}
      status={data.status as any}
      icon={<ApiOutlined style={{ color: 'white' }} />}
      stats={{
        'Goal': goal ? (goal.length > 15 ? goal.substring(0, 15) + '...' : goal) : 'Pending',
        'Tools': toolCount
      }}
      handles={[
        { type: 'target', position: Position.Top },
        { type: 'source', position: Position.Bottom }
      ]}
    />
  );
}

export const nodeTypes: NodeTypes = {
  start: StartNode,
  provider: ProviderNode as any,
  condition: ConditionNodeFixed as any,
  postProcess: PostProcessNode as any,
  end: EndNode as any,
  fork: ForkNode,
  join: JoinNode,
  agent: AgentNode as any,
};
