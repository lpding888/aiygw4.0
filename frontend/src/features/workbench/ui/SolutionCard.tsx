import React from 'react';
import { Card, Button, Tag, Space, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { DynamicIcon } from '@/shared/ui/DynamicIcon';

const { Title, Text } = Typography;

export interface SolutionFeature {
    label: string;
    isNew?: boolean;
    isHot?: boolean;
}

export interface SolutionCardProps {
    title: string;
    description: string;
    icon: string;
    color: string;
    features: SolutionFeature[];
    buttonText?: string;
    onClick?: () => void;
    className?: string;
    tools?: { label: string; onClick?: () => void }[]; // For frontend tools
}

export const SolutionCard: React.FC<SolutionCardProps> = ({
    title,
    description,
    icon,
    color,
    features,
    buttonText = '立即开始',
    onClick,
    className,
    tools,
}) => {
    return (
        <Card
            className={className}
            hoverable
            onClick={onClick}
            style={{
                height: '100%',
                borderRadius: 24,
                border: 'none',
                background: '#fff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                position: 'relative',
            }}
            styles={{
                body: {
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 32,
                },
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)';
            }}
        >
            {/* Top Accent Line */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 6,
                    background: color,
                }}
            />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 24 }}>
                <div
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: 20,
                        background: `${color}15`, // 15% opacity
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 20,
                        flexShrink: 0,
                    }}
                >
                    <DynamicIcon icon={icon} size={32} color={color} />
                </div>
                <div>
                    <Title level={3} style={{ margin: '0 0 8px 0', fontSize: 24 }}>
                        {title}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 15, lineHeight: 1.6 }}>
                        {description}
                    </Text>
                </div>
            </div>

            {/* Features List */}
            <div style={{ flex: 1, marginBottom: 32 }}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px 12px',
                                background: '#f9fafb',
                                borderRadius: 12,
                            }}
                        >
                            <div
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: color,
                                    marginRight: 12,
                                }}
                            />
                            <Text style={{ fontSize: 15, flex: 1 }}>{feature.label}</Text>
                            {feature.isNew && <Tag color="blue" style={{ borderRadius: 10, border: 'none' }}>NEW</Tag>}
                            {feature.isHot && <Tag color="red" style={{ borderRadius: 10, border: 'none' }}>HOT</Tag>}
                        </div>
                    ))}
                </Space>

                {/* Frontend Tools (Instant Tools) */}
                {tools && tools.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
                            ⚡️ 秒级工具箱 (无需等待)
                        </Text>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {tools.map((tool, index) => (
                                <Tag
                                    key={index}
                                    style={{
                                        padding: '4px 12px',
                                        borderRadius: 16,
                                        border: '1px solid #eee',
                                        background: '#fff',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        margin: 0,
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        tool.onClick?.();
                                    }}
                                >
                                    {tool.label}
                                </Tag>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Action Button */}
            <Button
                type="primary"
                size="large"
                block
                style={{
                    height: 48,
                    borderRadius: 24,
                    background: color,
                    fontSize: 16,
                    fontWeight: 600,
                    border: 'none',
                    boxShadow: `0 8px 20px ${color}40`, // 40% opacity shadow
                }}
            >
                {buttonText} <ArrowRightOutlined />
            </Button>
        </Card>
    );
};
