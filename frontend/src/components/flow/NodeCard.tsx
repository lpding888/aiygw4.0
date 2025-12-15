import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, Typography, Tooltip, Badge } from 'antd';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    SyncOutlined,
    ThunderboltOutlined,
    CodeOutlined,
    BranchesOutlined,
    FileTextOutlined
} from '@ant-design/icons';

const { Text } = Typography;

export interface NodeCardProps {
    id: string;
    selected?: boolean;
    type: string;
    label: string;
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    icon?: React.ReactNode;
    stats?: Record<string, string | number>;
    children?: React.ReactNode;
    handles?: {
        type: 'source' | 'target';
        position: Position;
        id?: string;
    }[];
}

const StatusIndicator = ({ status }: { status?: string }) => {
    if (!status || status === 'pending') return <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d9d9d9' }} />;
    if (status === 'running') return <SyncOutlined spin style={{ color: '#1890ff' }} />;
    if (status === 'completed') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (status === 'failed') return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    return <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d9d9d9' }} />;
};

const NodeIcon = ({ type }: { type: string }) => {
    const iconStyle = { fontSize: 16, color: 'white' };
    let bg = '#1890ff';
    let icon = <ThunderboltOutlined style={iconStyle} />;

    switch (type) {
        case 'start':
            bg = '#52c41a';
            icon = <PlayCircleFilled style={iconStyle} />; // Need to import
            break;
        case 'end': // Fallback if no specific icon
            bg = '#8c8c8c';
            break;
        case 'deepseek':
        case 'llm':
            bg = '#722ed1';
            icon = <span style={{ fontSize: 14, fontWeight: 'bold', color: 'white' }}>AI</span>;
            break;
        case 'condition':
            bg = '#faad14';
            icon = <BranchesOutlined style={iconStyle} />;
            break;
        default:
            break;
    }

    return (
        <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
        }}>
            {icon}
        </div>
    );
};

// Simple internal icon component since imports might be missing
const PlayCircleFilled = (props: any) => (
    <svg viewBox="64 64 896 896" focusable="false" data-icon="play-circle" width="1em" height="1em" fill="currentColor" aria-hidden="true" {...props}>
        <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm144.1 454.9L437.7 677.8a8.02 8.02 0 01-12.7-6.5V353.7a8 8 0 0112.7-6.5l218.4 158.9a7.9 7.9 0 010 12.8z"></path>
    </svg>
);

export const NodeCard = memo(({ id, selected, type, label, status, icon, stats, children, handles }: NodeCardProps) => {
    return (
        <div
            style={{
                position: 'relative',
                width: 280,
                borderRadius: 12,
                background: 'white',
                border: `1px solid ${selected ? '#1890ff' : '#f0f0f0'}`,
                boxShadow: selected ? '0 0 0 2px rgba(24, 144, 255, 0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
                transition: 'all 0.2s ease',
            }}
            className="node-card"
        >
            {/* Handles */}
            {handles?.map((h, i) => (
                <Handle
                    key={i}
                    type={h.type}
                    position={h.position}
                    id={h.id}
                    style={{
                        width: 10,
                        height: 10,
                        background: selected ? '#1890ff' : '#bfbfbf',
                        border: '2px solid white'
                    }}
                />
            ))}

            {/* Header */}
            <div style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                borderBottom: children || (stats && Object.keys(stats).length > 0) ? '1px solid #f5f5f5' : 'none'
            }}>
                <div style={{ marginRight: 12 }}>
                    {icon || <NodeIcon type={type} />}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <Text strong style={{ display: 'block', fontSize: 14 }} ellipsis>{label}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{type.toUpperCase()}</Text>
                </div>
                <div style={{ marginLeft: 8 }}>
                    <StatusIndicator status={status} />
                </div>
            </div>

            {/* Body / Stats */}
            {((stats && Object.keys(stats).length > 0) || children) && (
                <div style={{ padding: '8px 16px 12px', background: '#fafafa', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                    {children}
                    {stats && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {Object.entries(stats).map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                    <Text type="secondary">{k}:</Text>
                                    <Text style={{ fontFamily: 'monospace' }}>{v}</Text>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export default NodeCard;
