import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Card, Collapse, Spin, Typography, theme, Empty, Button, Modal, Input, message } from 'antd';
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
    CheckCircleOutlined,
    RobotOutlined,
    SearchOutlined
} from '@ant-design/icons';
import { api, type APIResponse } from '@/lib/api';

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
    useCount?: number;  // 使用次数
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
    const [allBlocks, setAllBlocks] = useState<ProviderBlock[]>([]);  // 所有积木（用于搜索）
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [aiModalVisible, setAiModalVisible] = useState(false);
    const [docText, setDocText] = useState('');
    const [generating, setGenerating] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { token } = theme.useToken();

    useEffect(() => {
        fetchProviders();
    }, []);

    // 监听滚动加载更多
    const handleScroll = useCallback(() => {
        if (!scrollContainerRef.current || loading || loadingMore || !hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            loadMoreBlocks();
        }
    }, [loading, loadingMore, hasMore]);

    const fetchProviders = async (pageNum = 1) => {
        if (pageNum === 1) {
            setLoading(true);
            setPage(1);
        } else {
            setLoadingMore(true);
        }

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

            // 3. Fetch feature_definitions (积木库) - 支持分页
            try {
                const offset = (pageNum - 1) * 50;  // 每页50个
                const featuresResponse = await api.admin.getFeatures({
                    limit: 50,  // 每次加载50个
                    offset: offset,
                    sort_by: 'name',
                    sort_order: 'asc'
                });

                if (featuresResponse.data.success) {
                    const features = featuresResponse.data.data?.features || [];
                    const total = featuresResponse.data.data?.pagination?.total || 0;

                    // 检查是否还有更多数据
                    setHasMore(offset + features.length < total);

                    features.forEach((feature: any) => {
                        const category = feature.category || 'tools';
                        const mappedCategory = category in mappedBlocks ? category : 'tools';

                        mappedBlocks[mappedCategory].push({
                            type: 'provider',
                            providerRef: feature.feature_key || feature.feature_id,
                            label: feature.display_name || feature.name || '未命名',
                            icon: <AppstoreOutlined />,
                            category: mappedCategory,
                            description: feature.description || '',
                            defaultConfig: feature.metadata || {},
                            useCount: feature.use_count || 0  // 使用次数（用于常用排序）
                        });
                    });
                }
            } catch (error) {
                console.error('Failed to fetch feature_definitions:', error);
                setHasMore(false);
            }
        } catch (error) {
            console.error('Failed to fetch providers, using default blocks only:', error);
            // Even if backend fails, we still show the default tools
        } finally {
            // 合并所有积木到allBlocks（用于搜索）
            const allBlocksList: ProviderBlock[] = [];
            Object.values(mappedBlocks).forEach(categoryBlocks => {
                allBlocksList.push(...categoryBlocks);
            });

            // 按使用次数排序（常用优先）
            allBlocksList.sort((a, b) => {
                const aCount = (a as any).useCount || 0;
                const bCount = (b as any).useCount || 0;
                return bCount - aCount;
            });

            if (pageNum === 1) {
                setAllBlocks(allBlocksList);
                setBlocks(mappedBlocks);
            } else {
                // 分页加载：追加到现有数据
                setAllBlocks(prev => [...prev, ...allBlocksList]);
                setBlocks(prev => {
                    const updated = { ...prev };
                    Object.keys(mappedBlocks).forEach(category => {
                        updated[category] = [...(prev[category] || []), ...mappedBlocks[category]];
                    });
                    return updated;
                });
            }

            setLoading(false);
            setLoadingMore(false);
        }
    };

    // 加载更多积木
    const loadMoreBlocks = useCallback(() => {
        if (!hasMore || loading || loadingMore) return;
        const nextPage = page + 1;
        setPage(nextPage);
        fetchProviders(nextPage);
    }, [page, hasMore, loading, loadingMore]);

    const onDragStart = (event: React.DragEvent, block: ProviderBlock) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify(block));
        event.dataTransfer.effectAllowed = 'move';
    };

    // 搜索过滤（实时搜索）
    const filteredBlocks = useMemo(() => {
        if (!searchText.trim()) {
            return blocks;  // 没有搜索词，返回所有
        }

        const keyword = searchText.toLowerCase();
        const filtered: Record<string, ProviderBlock[]> = {
            ai: [],
            image: [],
            notification: [],
            storage: [],
            tools: []
        };

        // 从所有积木中搜索
        allBlocks.forEach(block => {
            const matchLabel = block.label.toLowerCase().includes(keyword);
            const matchDesc = block.description?.toLowerCase().includes(keyword);
            const matchRef = block.providerRef.toLowerCase().includes(keyword);

            if (matchLabel || matchDesc || matchRef) {
                const category = block.category in filtered ? block.category : 'tools';
                filtered[category].push(block);
            }
        });

        return filtered;
    }, [blocks, allBlocks, searchText]);

    // AI学习新技能
    const handleAiGenerate = async () => {
        if (!docText.trim()) {
            message.warning('请先粘贴API文档内容');
            return;
        }
        setGenerating(true);
        try {
            const res = await api.client.post<APIResponse>('/admin/tools/generate', {
                docText: docText,
                category: 'custom_tool'
            });

            if (res?.success) {
                const feature = res.data as { name?: string };
                message.success(`成功学会新技能: ${feature?.name ?? '新工具'}`);
                setAiModalVisible(false);
                setDocText('');
                // 重新加载积木列表
                setSearchText('');  // 清空搜索
                setPage(1);
                fetchProviders(1);
            } else {
                message.error(res.data?.error?.message || '学习失败');
            }
        } catch (error) {
            console.error('AI生成失败:', error);
            message.error('AI解析失败，请重试');
        } finally {
            setGenerating(false);
        }
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                        <Text strong style={{ fontSize: 16 }}>积木箱</Text>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>拖拽积木到右侧画布</div>
                    </div>
                    <Button
                        type="primary"
                        size="small"
                        icon={<RobotOutlined />}
                        onClick={() => setAiModalVisible(true)}
                    >
                        AI学习
                    </Button>
                </div>
                {/* 搜索框 */}
                <Input
                    placeholder="搜索积木名称或描述..."
                    prefix={<SearchOutlined style={{ color: '#999' }} />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    allowClear
                    size="small"
                />
            </div>

            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                style={{ flex: 1, overflowY: 'auto', padding: '12px' }}
            >
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>
                ) : (
                    <>
                        <Collapse
                            defaultActiveKey={['ai', 'image', 'tools']}
                            ghost
                            expandIconPosition="end"
                            size="small"
                        >
                            {Object.entries(CATEGORIES).map(([key, meta]) => {
                                const categoryBlocks = filteredBlocks[key] || [];
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

                    {/* 加载更多提示 */}
                    {loadingMore && (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <Spin size="small" />
                            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>加载更多...</Text>
                        </div>
                    )}

                    {/* 没有更多数据提示 */}
                    {!hasMore && !searchText && allBlocks.length > 0 && (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>已加载全部积木</Text>
                        </div>
                    )}
                    </>
                )}
            </div>

            {/* AI学习新技能Modal */}
            <Modal
                title="AI学习新技能"
                open={aiModalVisible}
                onCancel={() => setAiModalVisible(false)}
                onOk={handleAiGenerate}
                okText="开始学习"
                cancelText="取消"
                confirmLoading={generating}
                width={600}
            >
                <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">
                        粘贴API文档或cURL示例，AI将自动学习并生成新的积木
                    </Text>
                </div>
                <Input.TextArea
                    value={docText}
                    onChange={(e) => setDocText(e.target.value)}
                    placeholder="例如：POST https://api.example.com/generate ..."
                    rows={10}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
            </Modal>
        </div>
    );
}
