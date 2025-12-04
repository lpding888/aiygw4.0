import React, { useEffect, useState } from 'react';
import { Card, Button, List, Modal, Input, message, Tag, Space } from 'antd';
import {
  AppstoreAddOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  CameraOutlined,
  EditOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import api from '@/lib/api';
import { adminProviders } from '@/lib/services/adminProviders';

interface ToolFeature {
  feature_id: string;
  feature_key: string;
  name: string;
  display_name?: string;
  description?: string;
  category: string;
  type: string; // 'api_tool' | 'basic' | ...
  metadata?: Record<string, any>;
}

interface ToolboxPanelProps {
  onAddNode: (feature: ToolFeature) => void;
}

// 缓存配置
const CACHE_KEY = 'pipeline_toolbox_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

export default function ToolboxPanel({ onAddNode }: ToolboxPanelProps) {
  const [tools, setTools] = useState<ToolFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [docText, setDocText] = useState('');
  const [generating, setGenerating] = useState(false);

  // 加载后端积木库
  const loadTools = async () => {
    // 先尝试从缓存读取
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setTools(data);
          return; // 使用缓存，直接返回
        }
      }
    } catch (error) {
      console.warn('读取缓存失败:', error);
    }

    setLoading(true);
    try {
      // 1. 加载 feature_definitions 积木
      const response = await api.admin.getFeatures({
        limit: 100,  // 后端限制最大100
        sort_by: 'name',
        sort_order: 'asc'
      });

      // response是AxiosResponse<APIResponse>，需要访问response.data
      if (!response.data.success) {
        throw new Error(response.data.message || '获取积木列表失败');
      }

      const rawFeatures =
        (Array.isArray(response.data.data?.features) && response.data.data.features) ||
        (Array.isArray(response.data.data) ? (response.data.data as ToolFeature[]) : []) ||
        [];

      const normalizedFeatures = rawFeatures.map((feature: any) => ({
        ...feature,
        feature_id: feature?.feature_id || feature?.feature_key,
        feature_key: feature?.feature_key || feature?.feature_id,
        name: feature?.display_name || feature?.name || feature?.feature_key || '未命名积木',
        description: feature?.description || ''
      }));

      // 2. 加载 Provider 积木
      const providerTools = await loadProviderTools();

      // 3. 合并两个数据源
      const merged = mergeTools(normalizedFeatures, providerTools);

      setTools(merged);

      // 保存到缓存
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          data: merged,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.warn('保存缓存失败:', error);
      }
    } catch (error) {
      console.error('加载工具箱失败:', error);
      message.error(
        error instanceof Error ? error.message : '加载积木库失败，请稍后再试'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadProviderTools = async (): Promise<ToolFeature[]> => {
    try {
      const response = await adminProviders.list({ limit: 500 });
      const providers = Array.isArray(response?.items) ? response.items : [];
      return providers
        .filter((provider) => provider.enabled !== false)
        .map((provider) => ({
          feature_id: `provider:${provider.provider_ref}`,
          feature_key: `provider_${provider.provider_ref}`,
          name: provider.provider_name || provider.provider_ref,
          display_name: provider.provider_name || provider.provider_ref,
          description: provider.endpoint_url || '第三方服务商',
          category: 'provider',
          type: 'api_tool',
          metadata: {
            provider_ref: provider.provider_ref,
            endpoint_url: provider.endpoint_url,
            auth_type: provider.auth_type,
            quality_tier: provider.quality_tier,
            cost_per_1k_tokens: provider.cost_per_1k_tokens
          }
        }));
    } catch (error) {
      console.warn('加载Provider积木失败:', error);
      return [];
    }
  };

  const mergeTools = (featureTools: ToolFeature[], providerTools: ToolFeature[]) => {
    const merged: ToolFeature[] = [...featureTools];
    const existingKeys = new Set(featureTools.map((item) => item.feature_key));
    for (const providerTool of providerTools) {
      if (!existingKeys.has(providerTool.feature_key)) {
        merged.push(providerTool);
      }
    }
    return merged;
  };

  useEffect(() => {
    loadTools();
  }, []);

  // 处理 AI 导入
  const handleAiGenerate = async () => {
    if (!docText.trim()) {
      message.warning('请先粘贴API文档内容');
      return;
    }
    setGenerating(true);
    try {
      // 修复：使用正确的API调用方式
      const res = await api.client.post('/admin/tools/generate', {
        docText: docText,
        category: 'custom_tool'
      });

      if (res.data?.success) {
        message.success(`成功学会新技能: ${res.data.data.name}`);
        setAiModalVisible(false);
        setDocText('');
        // 重新加载列表，让新积木显示出来
        loadTools();
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

  // 根据分类获取图标
  const getIcon = (category: string) => {
    if (category.includes('image')) return <CameraOutlined />;
    if (category.includes('text') || category.includes('llm')) return <FileTextOutlined />;
    if (category.includes('video')) return <AppstoreAddOutlined />;
    return <ThunderboltOutlined />;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部操作栏 */}
      <div style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
        <Button 
          type="primary" 
          icon={<RobotOutlined />} 
          block
          onClick={() => setAiModalVisible(true)}
          style={{ background: 'linear-gradient(45deg, #1890ff, #722ed1)', border: 'none' }}
        >
          AI 学习新技能
        </Button>
      </div>

      {/* 积木列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        <List
          loading={loading}
          dataSource={tools}
          renderItem={(item) => (
            <Card 
              size="small" 
              hoverable 
              style={{ marginBottom: 8, cursor: 'move', userSelect: 'none' }}
              // 这里只是点击添加，后续可以支持拖拽 (React DnD)
              onClick={() => onAddNode(item)}
            >
              <Card.Meta
                avatar={getIcon(item.category)}
                title={
                  <Space>
                    <span style={{ fontSize: '13px' }}>{item.display_name || item.name}</span>
                    {item.category === 'provider' && (
                      <Tag color="geekblue" style={{ marginRight: 0, transform: 'scale(0.8)' }}>
                        服务商
                      </Tag>
                    )}
                    {item.type === 'api_tool' && (
                      <Tag color="purple" style={{ marginRight: 0, transform: 'scale(0.8)' }}>
                        AI生成
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <div style={{ fontSize: '12px', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.description || '暂无描述'}
                  </div>
                }
              />
            </Card>
          )}
        />
      </div>

      {/* AI 导入弹窗 */}
      <Modal
        title={
          <Space>
            <RobotOutlined style={{ color: '#722ed1' }} />
            <span>教系统学习新 API</span>
          </Space>
        }
        open={aiModalVisible}
        onCancel={() => setAiModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setAiModalVisible(false)}>取消</Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={generating} 
            onClick={handleAiGenerate}
            style={{ background: '#722ed1', borderColor: '#722ed1' }}
          >
            {generating ? '正在阅读文档...' : '开始学习'}
          </Button>
        ]}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <p>请将 API 文档（或 curl 命令）粘贴到下方。AI 会自动分析参数并生成积木。</p>
          <Input.TextArea
            rows={10}
            value={docText}
            onChange={e => setDocText(e.target.value)}
            placeholder={`例如：
curl -X POST https://api.example.com/v1/images \\
-H "Content-Type: application/json" \\
-H "Authorization: Bearer YOUR_API_KEY" \\
-d '{"prompt": "a cat", "size": "1024x1024"}'

或直接粘贴 API 文档说明...`}
          />
        </div>
      </Modal>
    </div>
  );
}
