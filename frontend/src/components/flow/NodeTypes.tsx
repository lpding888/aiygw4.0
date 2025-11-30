'use client';

/**
 * React Flow节点类型定义 (美化版)
 */

import React from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import type { NodeTypes } from '@xyflow/react';
import { 
  ApiOutlined, 
  BranchesOutlined, 
  ToolOutlined, 
  CheckCircleOutlined, 
  MoreOutlined,
  DeleteOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { Card, Typography, Dropdown, Menu, theme } from 'antd';
import ForkNode from './nodes/ForkNode';
import JoinNode from './nodes/JoinNode';

const { Text } = Typography;

// 通用节点外壳组件
const NodeShell = ({ 
  title, 
  icon, 
  color, 
  children, 
  nodeId, 
  selected 
}: { 
  title: React.ReactNode; 
  icon: React.ReactNode; 
  color: string; 
  children?: React.ReactNode;
  nodeId: string;
  selected?: boolean;
}) => {
  const { setNodes } = useReactFlow();
  const { token } = theme.useToken();

  const handleDelete = () => {
    setNodes((nodes) => nodes.filter((n) => n.id !== nodeId));
  };

  const menu = (
    <Menu>
      <Menu.Item key="delete" icon={<DeleteOutlined />} danger onClick={handleDelete}>
        删除节点
      </Menu.Item>
    </Menu>
  );

  return (
    <div style={{ position: 'relative' }}>
      {/* 输入连接点 */}
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ 
          width: 10, 
          height: 10, 
          background: color,
          border: '2px solid #fff' 
        }} 
      />

      <Card
        size="small"
        bordered={false}
        style={{
          width: 220,
          borderRadius: 12,
          boxShadow: selected ? `0 0 0 2px ${color}, 0 8px 16px rgba(0,0,0,0.1)` : '0 4px 12px rgba(0,0,0,0.05)',
          transition: 'all 0.2s',
          borderTop: `4px solid ${color}`
        }}
        bodyStyle={{ padding: '12px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 8, 
              background: `${color}15`, // 浅色背景
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: color,
              fontSize: 18
            }}>
              {icon}
            </div>
            <div>
              <Text strong style={{ fontSize: 14, display: 'block', lineHeight: 1.2 }}>{title}</Text>
              <Text type="secondary" style={{ fontSize: 10 }}>{nodeId.split('_')[0]}</Text>
            </div>
          </div>
          
          <Dropdown overlay={menu} trigger={['click']}>
            <MoreOutlined style={{ fontSize: 16, color: '#999', cursor: 'pointer' }} />
          </Dropdown>
        </div>
        
        {children && (
          <div style={{ 
            background: '#f9f9f9', 
            borderRadius: 6, 
            padding: '8px',
            fontSize: 12,
            color: '#666'
          }}>
            {children}
          </div>
        )}
      </Card>

      {/* 输出连接点 */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ 
          width: 10, 
          height: 10, 
          background: color,
          border: '2px solid #fff' 
        }} 
      />
    </div>
  );
};

export function ProviderNode({ id, data, selected }: NodeProps) {
  const paramsCount = data.schema ? (data.schema as any[]).length : 0;
  return (
    <NodeShell 
      nodeId={id} 
      selected={selected}
      title={data.label || 'AI 模型'} 
      icon={<ApiOutlined />} 
      color="#1890ff"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{data.providerRef || '未配置'}</span>
        {paramsCount > 0 && <span style={{ color: '#1890ff' }}>{paramsCount} 个参数</span>}
      </div>
    </NodeShell>
  );
}

export function ConditionNode({ id, data, selected }: NodeProps) {
  return (
    <div style={{ position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={{ width: 10, height: 10, background: '#52c41a' }} />
      
      <Card
        size="small"
        bordered={false}
        style={{
          width: 200,
          borderRadius: 20, // 椭圆形状
          border: selected ? '2px solid #52c41a' : '1px solid #d9d9d9',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          textAlign: 'center'
        }}
      >
        <BranchesOutlined style={{ fontSize: 20, color: '#52c41a', marginBottom: 4 }} />
        <div style={{ fontWeight: 600 }}>{data.label || '条件判断'}</div>
      </Card>

      {/* 两个输出口：True 和 False */}
      <div style={{ position: 'absolute', bottom: -10, left: '20%', fontSize: 10, color: '#52c41a' }}>是</div>
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%', background: '#52c41a' }} />
      
      <div style={{ position: 'absolute', bottom: -10, left: '60%', fontSize: 10, color: '#ff4d4f' }}>否</div>
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%', background: '#ff4d4f' }} />
    </div>
  );
}

export function PostProcessNode({ id, data, selected }: NodeProps) {
  return (
    <NodeShell 
      nodeId={id} 
      selected={selected}
      title={data.label || '后处理'} 
      icon={<ToolOutlined />} 
      color="#fa8c16"
    >
      处理逻辑: {data.processor || '无'}
    </NodeShell>
  );
}

export function EndNode({ id, data, selected }: NodeProps) {
  return (
    <NodeShell 
      nodeId={id} 
      selected={selected}
      title={data.label || '流程结束'} 
      icon={<CheckCircleOutlined />} 
      color="#722ed1"
    >
      输出变量: {data.outputKey || 'final_result'}
    </NodeShell>
  );
}

export const nodeTypes: NodeTypes = {
  provider: ProviderNode as any,
  condition: ConditionNode as any,
  postProcess: PostProcessNode as any,
  end: EndNode as any,
  fork: ForkNode,
  join: JoinNode,
};
