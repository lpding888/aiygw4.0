import React, { useEffect, useState } from 'react';
import { Card, Collapse, Spin, Typography, theme, Empty } from 'antd';
import {
    AppstoreOutlined,
    ApiOutlined,
    MailOutlined,
    CloudUploadOutlined,
    FileImageOutlined,
    ThunderboltOutlined,
    ToolOutlined,
    DatabaseOutlined,
    BranchesOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';

const { Text } = Typography;
const { Panel } = Collapse;

interface ProviderBlock {
    type: string;
    providerRef: string;
    label: string;
    icon: React.ReactNode;
    category: string;
    description?: string;
    defaultConfig?: any;
}

// 预定义的积木分类
const CATEGORIES = {
    ai: { label: 'AI 能力', icon: <ThunderboltOutlined /> },
    image: { label: '图片处理', icon: <FileImageOutlined /> },
    notification: { label: '通知服务', icon: <MailOutlined /> },
    storage: { label: '存储服务', icon: <DatabaseOutlined /> },
    tools: { label: '基础工具', icon: <ToolOutlined /> },
};

export default function PipelineBlockSidebar() {
    const [blocks, setBlocks] = useState<Record<string, ProviderBlock[]>>({});
    const [loading, setLoading] = useState(false);
    const { token } = theme.useToken();

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        setLoading(true);

        // Initialize with default categories
        const mappedBlocks: {
            ai: ProviderBlock[];
            image: ProviderBlock[];
            notification: ProviderBlock[];
            storage: ProviderBlock[];
            tools: ProviderBlock[];
            [key: string]: ProviderBlock[];
        } = {
            ai: [],
            image: [],
            notification: [],
            storage: [],
            tools: []
        };

        // 1. Add Default System Tools (Always available)
        mappedBlocks.tools.push({
            type: 'condition',
            providerRef: 'system',
            label: '条件判断',
            icon: <BranchesOutlined />,
            category: 'tools',
            description: '根据条件分流',
            defaultConfig: { condition: 'output.quality > 0.8' }
        });
        mappedBlocks.tools.push({
            type: 'postProcess',
            providerRef: 'system',
            label: '结果处理',
            icon: <ToolOutlined />,
            category: 'tools',
            description: '格式化或提取结果',
            defaultConfig: { processor: 'json_extract' }
        });
        mappedBlocks.tools.push({
            type: 'fork',
            providerRef: 'system',
            label: '并行分支',
            icon: <BranchesOutlined rotate={90} />,
            category: 'tools',
            description: '同时执行多个任务',
            defaultConfig: { branches: 2 }
        });
        mappedBlocks.tools.push({
            type: 'join',
            providerRef: 'system',
            label: '汇合',
            icon: <BranchesOutlined rotate={270} />,
            category: 'tools',
            description: '等待任务完成',
            defaultConfig: { strategy: 'ALL' }
        });
        mappedBlocks.tools.push({
            type: 'end',
            providerRef: 'system',
            label: '结束输出',
            icon: <CheckCircleOutlined />,
            category: 'tools',
            description: '流程结束点',
            defaultConfig: {}
        });

        try {
            // 2. Fetch Registered Providers from Backend
            const response = await api.provider.getRegisteredProviders();

            if (response.data.success && response.data.data) {
                const providerIds: string[] = (response.data.data as any).providers || [];

                providerIds.forEach(id => {
                    if (id.includes('runninghub')) {
                        mappedBlocks.ai.push({
                            type: 'provider',
                            providerRef: id,
                            label: 'RunningHub',
                            icon: <ApiOutlined />,
                            category: 'ai',
                            description: 'AI绘画/模特生成',
                            defaultConfig: { providerType: 'runninghub' }
                        });
                    } else if (id.includes('deepseek') || id.includes('llm')) {
                        mappedBlocks.ai.push({
                            type: 'provider',
                            providerRef: id,
                            label: 'DeepSeek LLM',
                            icon: <ApiOutlined />,
                            category: 'ai',
                            description: '智能文本分析',
                            defaultConfig: { providerType: 'llm_deepseek' }
                        });
                    } else if (id.includes('email') || id.includes('smtp')) {
                        mappedBlocks.notification.push({
                            type: 'provider',
                            providerRef: id,
                            label: '邮件通知',
                            icon: <MailOutlined />,
                            category: 'notification',
                            description: '发送邮件通知',
                            defaultConfig: { providerType: 'email' }
                        });
                    } else if (id.includes('cos') || id.includes('oss') || id.includes('storage')) {
                        mappedBlocks.storage.push({
                            type: 'provider',
                            providerRef: id,
                            label: '云存储上传',
                            icon: <CloudUploadOutlined />,
                            category: 'storage',
                            description: '上传文件到云端',
                            defaultConfig: { providerType: 'storage' }
                        });
                    } else if (id.includes('scf') || id.includes('function')) {
                        mappedBlocks.image.push({
                            type: 'provider',
                            providerRef: id,
                            label: '云函数处理',
                            icon: <ThunderboltOutlined />,
                            category: 'image',
                            description: '腾讯云SCF图片处理',
                            defaultConfig: { providerType: 'scf' }
                        });
                    } else if (id.includes('sync_image')) {
                        mappedBlocks.image.push({
                            type: 'provider',
                            providerRef: id,
                            label: '本地图片处理',
                            icon: <FileImageOutlined />,
                            category: 'image',
                            description: '基础图片编辑',
                            defaultConfig: { providerType: 'sync_image' }
                        });
                    } else {
                        mappedBlocks.tools.push({
                            type: 'provider',
                            providerRef: id,
                            label: id,
                            icon: <AppstoreOutlined />,
                            category: 'tools',
                            description: '通用Provider',
                            defaultConfig: { providerType: 'unknown' }
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Failed to fetch providers, using default blocks only:', error);
            // Even if backend fails, we still show the default tools
        } finally {
            setBlocks(mappedBlocks);
            setLoading(false);
        }
    };

    const onDragStart = (event: React.DragEvent, block: ProviderBlock) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify(block));
        event.dataTransfer.effectAllowed = 'move';
    };



    return (
        <div style={{
            width: '280px',
            borderRight: '1px solid rgba(0,0,0,0.06)',
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            <div style={{
                padding: '16px',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                background: '#fafafa'
            }}>
                <Text strong style={{ fontSize: 16 }}>积木箱</Text>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>拖拽积木到右侧画布</div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
                ) : (
                    <Collapse
                        defaultActiveKey={['ai', 'image', 'tools']}
                        ghost
                        expandIconPosition="end"
                        size="small"
                    >
                        {Object.entries(CATEGORIES).map(([key, meta]) => {
                            const categoryBlocks = blocks[key] || [];
                            if (categoryBlocks.length === 0) return null;

                            return (
                                <Panel
                                    header={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {meta.icon}
                                            <span>{meta.label}</span>
                                        </div>
                                    }
                                    key={key}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {categoryBlocks.map((block, index) => (
                                            <div
                                                key={`${block.providerRef}-${index}`}
                                                draggable
                                                onDragStart={(event) => onDragStart(event, block)}
                                                style={{
                                                    padding: '12px',
                                                    background: '#fff',
                                                    border: `1px solid ${token.colorBorderSecondary}`,
                                                    borderRadius: 8,
                                                    cursor: 'grab',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                                }}
                                                className="block-card"
                                            >
                                                <div style={{
                                                    width: 32,
                                                    height: 32,
                                                    background: token.colorPrimaryBg,
                                                    color: token.colorPrimary,
                                                    borderRadius: 6,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: 16
                                                }}>
                                                    {block.icon}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 500, fontSize: 13 }}>{block.label}</div>
                                                    <div style={{ fontSize: 11, color: '#999' }}>{block.description}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            );
                        })}
                    </Collapse>
                )}
            </div>
        </div>
    );
}
