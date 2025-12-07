import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Card, Collapse, Spin, Typography, theme, Empty, Button, Modal, Input, message, Tag, Tooltip } from 'antd';
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
    SearchOutlined,
    ExperimentOutlined,
    MoreOutlined
} from '@ant-design/icons';
import { api, type APIResponse } from '@/lib/api';
import { adminProviders } from '@/lib/services/adminProviders';

const { Text } = Typography;

interface ProviderBlock {
    type: string;
    providerRef: string;
    label: string;
    icon: React.ReactNode;
    category: string;
    description?: string;
    defaultConfig?: any;
    useCount?: number;  // 使用次数
    tags?: string[];    // 标签
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

    const getProviderIcon = (category: string) => {
        switch (category) {
            case 'ai': return <ThunderboltOutlined />;
            case 'image': return <FileImageOutlined />;
            case 'notification': return <MailOutlined />;
            case 'storage': return <CloudUploadOutlined />;
            default: return <ApiOutlined />;
        }
    };

    const getDefaultSchema = (category: string) => {
        switch (category) {
            case 'ai':
                return [
                    { name: 'system_prompt', label: '系统提示词', type: 'text', description: 'AI的角色设定', default: 'You are a helpful assistant.' },
                    { name: 'prompt', label: '用户提示词', type: 'text', description: '发送给AI的内容', required: true },
                    { name: 'temperature', label: '随机性', type: 'number', description: '0-2之间，越高越随机', default: 0.7 },
                    { name: 'model', label: '模型名称', type: 'string', description: '指定特定模型版本', default: 'gpt-3.5-turbo' }
                ];
            case 'image':
                return [
                    { name: 'prompt', label: '绘图提示词', type: 'text', description: '描述画面内容', required: true },
                    { name: 'negative_prompt', label: '反向提示词', type: 'text', description: '不想出现的元素' },
                    { name: 'aspect_ratio', label: '图片比例', type: 'string', description: '如 1:1, 16:9', default: '1:1' },
                    { name: 'imageUrl', label: '参考图URL', type: 'string', description: '图生图时使用(RunningHub等需要)' }
                ];
            case 'notification':
                return [
                    { name: 'recipient', label: '接收人', type: 'string', description: '手机号或邮箱', required: true },
                    { name: 'subject', label: '标题', type: 'string', description: '邮件标题', default: '系统通知' },
                    { name: 'content', label: '消息内容', type: 'text', required: true }
                ];
            case 'storage':
                return [
                    { name: 'bucket', label: '存储桶', type: 'string', required: true },
                    { name: 'file_path', label: '文件路径', type: 'string', required: true },
                    { name: 'content_type', label: '文件类型', type: 'string', default: 'image/png' }
                ];
            default:
                return [
                    { name: 'input_params', label: '输入参数', type: 'text', description: 'JSON格式的参数' }
                ];
        }
    };



    const fetchProviders = async (pageNum = 1) => {
        if (pageNum === 1) {
            setLoading(true);
            setPage(1);
        } else {
            setLoadingMore(true);
        }

        // Safety break
        if (pageNum > 5) {
            setHasMore(false);
            setLoadingMore(false);
            setLoading(false);
            return;
        }

        // 使用Map进行严格去重，Key为 providerRef 或 feature_key
        const uniqueBlocks = new Map<string, ProviderBlock>();

        // 1. 系统内置工具 (仅在第一页加载时添加)
        if (pageNum === 1) {
            const systemTools: ProviderBlock[] = [
                {
                    type: 'condition',
                    providerRef: 'system_condition',
                    label: '条件判断',
                    icon: <BranchesOutlined />,
                    category: 'tools',
                    description: '根据条件分流',
                    defaultConfig: { condition: 'output.quality > 0.8' }
                },
                {
                    type: 'postProcess',
                    providerRef: 'system_post_process',
                    label: '结果处理',
                    icon: <ToolOutlined />,
                    category: 'tools',
                    description: '格式化或提取结果',
                    defaultConfig: { processor: 'json_extract' }
                },
                {
                    type: 'fork',
                    providerRef: 'system_fork',
                    label: '并行分支',
                    icon: <BranchesOutlined rotate={90} />,
                    category: 'tools',
                    description: '同时执行多个任务',
                    defaultConfig: { branches: 2 }
                },
                {
                    type: 'join',
                    providerRef: 'system_join',
                    label: '汇合',
                    icon: <BranchesOutlined rotate={270} />,
                    category: 'tools',
                    description: '等待任务完成',
                    defaultConfig: { strategy: 'ALL' }
                },
                {
                    type: 'end',
                    providerRef: 'system_end',
                    label: '结束输出',
                    icon: <CheckCircleOutlined />,
                    category: 'tools',
                    description: '流程结束点',
                    defaultConfig: {}
                }
            ];

            systemTools.forEach(tool => uniqueBlocks.set(tool.providerRef, tool));
        }

        try {
            // 2. 加载后端Provider (adminProviders服务)
            // 关键修复：仅在第一页加载 Providers，避免重复调用导致 429
            const providers = (pageNum === 1) ? (await adminProviders.list({ limit: 100, offset: 0 })).items || [] : [];

            providers.forEach(p => {
                // 用户要求彻底删除预设的 RunningHub (img_runninghub)
                if (p.provider_ref === 'img_runninghub') return;

                if (p.enabled === false) return; // 忽略禁用的

                // 严格去重
                if (uniqueBlocks.has(p.provider_ref)) return;

                // 智能分类逻辑
                let category = 'tools';
                const lowerName = (p.provider_name || '').toLowerCase();
                const lowerRef = (p.provider_ref || '').toLowerCase();

                if (lowerName.includes('ai') || lowerName.includes('gpt') || lowerName.includes('llm') || lowerName.includes('deepseek') || lowerName.includes('runninghub') || lowerRef.includes('deepseek')) {
                    category = 'ai';
                } else if (lowerName.includes('image') || lowerName.includes('pic') || lowerRef.includes('img') || lowerRef.includes('camera')) {
                    category = 'image';
                } else if (lowerName.includes('email') || lowerName.includes('sms') || lowerName.includes('notification')) {
                    category = 'notification';
                } else if (lowerName.includes('storage') || lowerName.includes('oss') || lowerName.includes('cos') || lowerName.includes('s3')) {
                    category = 'storage';
                }

                // 垃圾数据过滤：如果被归类为'tools'且没有明确描述或看起来像原始ID，则过滤掉
                // 例如: "provider_12345" 且无描述 -> 过滤
                if (category === 'tools') {
                    const isRawId = /^provider_[\w-]{8,}$/.test(lowerRef) || /^[0-9a-f-]{30,}$/.test(lowerRef);
                    const hasDescription = p.endpoint_url && p.endpoint_url.length > 5;
                    const hasFriendlyName = p.provider_name && p.provider_name !== p.provider_ref;

                    if (isRawId && !hasFriendlyName && !hasDescription) {
                        return; // 过滤垃圾数据
                    }
                }

                uniqueBlocks.set(p.provider_ref, {
                    type: 'provider',
                    providerRef: p.provider_ref,
                    label: p.provider_name || p.provider_ref,
                    icon: getProviderIcon(category),
                    category: category,
                    description: p.endpoint_url || '外部服务能力',
                    defaultConfig: {
                        providerRef: p.provider_ref,
                        providerName: p.provider_name,
                        endpoint: p.endpoint_url,
                        schema: getDefaultSchema(category)
                    },
                    tags: p.quality_tier ? [p.quality_tier] : []
                });
            });

            // 3. 加载Packaged Features (getFeatures)
            // 通常这里会有更高质量的封装，所以我们尝试合并
            const offset = (pageNum - 1) * 50;
            const featuresResponse = await api.admin.getFeatures({
                limit: 50,
                offset: offset,
                sort_by: 'name',
                sort_order: 'asc'
            });

            if (featuresResponse.data.success) {
                const features = featuresResponse.data.data?.features || [];
                const total = featuresResponse.data.data?.pagination?.total || 0;
                setHasMore(offset + features.length < total);

                features.forEach((feature: any) => {
                    const ref = feature.feature_key || feature.feature_id;
                    if (feature.enabled === false) return;

                    // 如果已存在（可能是provider那边加进来的），我们尝试用Feature的信息更新它（因为Feature通常有更好的描述）
                    const existing = uniqueBlocks.get(ref);

                    const category = feature.category || (existing ? existing.category : 'tools');

                    // Feature usually has its own metadata/schema, but if missing, fallback to default
                    const existingConfig = existing ? existing.defaultConfig : {};
                    const featureConfig = feature.metadata || {};
                    const finalConfig = {
                        ...existingConfig,
                        ...featureConfig
                    };

                    if (!finalConfig.schema) {
                        finalConfig.schema = getDefaultSchema(category);
                    }

                    uniqueBlocks.set(ref, {
                        type: 'provider',
                        providerRef: ref,
                        label: feature.display_name || feature.name || (existing ? existing.label : '未命名'),
                        icon: getProviderIcon(category),
                        category: category,
                        description: feature.description || (existing ? existing.description : ''),
                        defaultConfig: finalConfig,
                        useCount: feature.use_count || 0,
                        tags: existing ? existing.tags : []
                    });
                });
            }

            // 4. 加载 MCP Tools (SaaS Phase 2)
            if (pageNum === 1) {
                try {
                    const mcpRes = await api.mcp.listEndpoints({ enabled: true, healthy: true, limit: 100 }) as unknown as APIResponse;
                    if (mcpRes.success && mcpRes.data) {
                        const endpoints = mcpRes.data as any[];
                        endpoints.forEach((ep: any) => {
                            (ep.supportedTools || []).forEach((tool: any) => {
                                const ref = `${ep.id}:${tool.name}`;
                                if (uniqueBlocks.has(ref)) return;

                                uniqueBlocks.set(ref, {
                                    type: 'provider',
                                    providerRef: ref,
                                    label: tool.name,
                                    icon: <ApiOutlined />,
                                    category: 'tools', // 暂时归类为工具，后续可优化
                                    description: tool.description || ep.name,
                                    defaultConfig: {
                                        provider_type: 'mcp',
                                        provider_ref: ref,
                                        schema: tool.parameters || [], // 直接使用解析好的参数
                                        providerName: tool.name,
                                        endpoint: ep.endpointUrl
                                    },
                                    tags: ['mcp', ep.name]
                                });
                            });
                        });
                    }
                } catch (err) {
                    console.warn('Failed to load MCP tools', err);
                }
            }

        } catch (error) {
            console.error('Failed to fetch providers or features:', error);
            message.error('加载技能模块失败');
        } finally {
            // 重新构建分类列表
            const newMappedBlocks: Record<string, ProviderBlock[]> = {
                ai: [],
                image: [],
                notification: [],
                storage: [],
                tools: []
            };

            const allBlocksList = Array.from(uniqueBlocks.values());

            allBlocksList.forEach(block => {
                const cat = block.category in newMappedBlocks ? block.category : 'tools';
                if (!newMappedBlocks[cat]) newMappedBlocks[cat] = [];
                newMappedBlocks[cat].push(block);
            });

            // 排序
            allBlocksList.sort((a, b) => {
                if (a.category === 'ai' && b.category !== 'ai') return -1;
                if (a.category === 'image' && b.category !== 'image') return -1;
                return 0;
            });

            if (pageNum === 1) {
                setAllBlocks(allBlocksList);
                setBlocks(newMappedBlocks);
            } else {
                // 如果是分页加载（虽然我们其实限制了provider只加载一次），合并逻辑
                setAllBlocks(prev => {
                    const mergedMap = new Map<string, ProviderBlock>();
                    prev.forEach(p => mergedMap.set(p.providerRef, p));
                    allBlocksList.forEach(p => mergedMap.set(p.providerRef, p));
                    return Array.from(mergedMap.values());
                });

                // 这里简单处理，直接使用本次的全量构建结果（假设第一页涵盖了主要内容）
                setBlocks(prev => {
                    const next = { ...prev };
                    Object.entries(newMappedBlocks).forEach(([key, newItems]) => {
                        const existingItems = next[key] || [];
                        const existingRefs = new Set(existingItems.map(item => item.providerRef));
                        const uniqueNewItems = newItems.filter(item => !existingRefs.has(item.providerRef));
                        next[key] = [...existingItems, ...uniqueNewItems];
                    });
                    return next;
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

    // 监听滚动加载更多
    const handleScroll = useCallback(() => {
        if (!scrollContainerRef.current || loading || loadingMore || !hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            loadMoreBlocks();
        }
    }, [loading, loadingMore, hasMore, loadMoreBlocks]);

    const onDragStart = (event: React.DragEvent, block: ProviderBlock) => {
        event.dataTransfer.setData('application/reactflow', JSON.stringify(block));
        event.dataTransfer.effectAllowed = 'move';
    };

    // 搜索过滤（实时搜索）
    const filteredBlocks = useMemo(() => {
        if (!searchText.trim()) {
            return blocks;
        }

        const keyword = searchText.toLowerCase();
        const filtered: Record<string, ProviderBlock[]> = {
            ai: [],
            image: [],
            notification: [],
            storage: [],
            tools: []
        };

        allBlocks.forEach(block => {
            const matchLabel = block.label.toLowerCase().includes(keyword);
            const matchDesc = block.description?.toLowerCase().includes(keyword);
            const matchRef = block.providerRef.toLowerCase().includes(keyword);

            if (matchLabel || matchDesc || matchRef) {
                const category = (block.category in filtered) ? block.category : 'tools';
                if (!filtered[category]) filtered[category] = [];
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

            if (res?.data?.success) {
                const feature = res.data.data as { name?: string };
                message.success(`成功学会新技能: ${feature?.name ?? '新工具'}`);
                setAiModalVisible(false);
                setDocText('');
                setSearchText('');
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
                    <Tooltip title="让AI阅读API文档，自动学习新技能">
                        <Button
                            type="primary"
                            size="small"
                            icon={<RobotOutlined />}
                            onClick={() => setAiModalVisible(true)}
                            style={{ background: 'linear-gradient(135deg, #1890ff, #722ed1)', border: 'none' }}
                        >
                            AI 学习
                        </Button>
                    </Tooltip>
                </div>
                {/* 搜索框 */}
                <Input
                    placeholder="搜索技能、API或描述..."
                    prefix={<SearchOutlined style={{ color: '#999' }} />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    allowClear
                    size="middle"
                    style={{ borderRadius: 6 }}
                />
            </div>

            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                style={{ flex: 1, overflowY: 'auto', padding: '12px' }}
            >
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Spin size="large" />
                        <Text type="secondary">正在加载技能库...</Text>
                    </div>
                ) : (
                    <>
                        <Collapse
                            defaultActiveKey={['ai', 'image', 'tools']}
                            ghost
                            expandIconPosition="end"
                            size="small"
                            items={Object.keys(filteredBlocks).map(key => {
                                const categoryBlocks = filteredBlocks[key] || [];
                                if (categoryBlocks.length === 0) return null;

                                let title = '基础工具';
                                let icon = <ToolOutlined />;

                                switch (key) {
                                    case 'ai': title = 'AI 能力'; icon = <ThunderboltOutlined />; break;
                                    case 'image': title = '图像处理'; icon = <FileImageOutlined />; break;
                                    case 'notification': title = '通知服务'; icon = <MailOutlined />; break;
                                    case 'storage': title = '存储服务'; icon = <CloudUploadOutlined />; break;
                                    case 'tools': title = '逻辑控制'; icon = <BranchesOutlined />; break;
                                }

                                return {
                                    key,
                                    label: (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                                            {icon}
                                            <span>{title}</span>
                                            <Tag style={{ marginLeft: 'auto', marginRight: 0, fontSize: 10 }}>{categoryBlocks.length}</Tag>
                                        </div>
                                    ),
                                    children: (
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
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                                                        position: 'relative',
                                                        overflow: 'hidden'
                                                    }}
                                                    className="block-card hover:shadow-md hover:border-blue-400"
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = token.colorPrimary;
                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = token.colorBorderSecondary;
                                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.01)';
                                                    }}
                                                >
                                                    <div style={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: 8,
                                                        background: token.colorFillTertiary,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                        color: token.colorTextSecondary
                                                    }}>
                                                        {block.icon}
                                                    </div>
                                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>{block.label}</div>
                                                        <div style={{ fontSize: 11, color: token.colorTextTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {block.description}
                                                        </div>
                                                    </div>
                                                    <MoreOutlined style={{ color: token.colorTextQuaternary }} />
                                                </div>
                                            ))}
                                        </div>
                                    )
                                };
                            }).filter(Boolean) as any}
                        />


                        {loadingMore && (
                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <Spin size="small" />
                            </div>
                        )}

                        {!hasMore && !searchText && allBlocks.length > 0 && (
                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>已加载全部技能</Text>
                            </div>
                        )}

                        {!loading && allBlocks.length === 0 && (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无技能积木" />
                        )}
                    </>
                )
                }
            </div >

            {/* AI学习新技能Modal */}
            < Modal
                title={
                    < div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <RobotOutlined style={{ color: '#1890ff' }} />
                        <span>AI 学习新技能</span>
                    </div >
                }
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
                        只需粘贴 API 文档、cURL 命令或 SDK 示例，DeepSeek AI 将自动分析参数并生成可用的积木节点。
                    </Text>
                </div>
                <Input.TextArea
                    value={docText}
                    onChange={(e) => setDocText(e.target.value)}
                    placeholder={`例如：\ncurl -X POST https://api.example.com/v1/chat/completions \\\n-H "Content-Type: application/json" \\\n-d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "Hello!"}]}'`}
                    rows={12}
                    style={{ fontFamily: 'monospace', fontSize: 12, background: '#fafafa' }}
                />
            </Modal >
        </div >
    );
}
