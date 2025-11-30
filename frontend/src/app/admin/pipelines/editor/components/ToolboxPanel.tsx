import React, { useEffect, useState } from 'react';
import { Card, Button, List, Tooltip, Modal, Input, message, Tag, Space } from 'antd';
import {
  AppstoreAddOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  CameraOutlined,
  EditOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import api from '@/lib/api';

interface ToolFeature {
  feature_id: string;
  feature_key: string;
  name: string;
  description: string;
  category: string;
  type: string; // 'api_tool' | 'basic' | ...
}

interface ToolboxPanelProps {
  onAddNode: (feature: ToolFeature) => void;
}

export default function ToolboxPanel({ onAddNode }: ToolboxPanelProps) {
  const [tools, setTools] = useState<ToolFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [docText, setDocText] = useState('');
  const [generating, setGenerating] = useState(false);

  // 加载后端积木库
  const loadTools = async () => {
    setLoading(true);
    try {
      // 调用我们在 admin.routes.ts 里定义的接口
      // 假设 GET /admin/features 返回所有积木
      const res = await api.get('/admin/features?limit=100');
      if (res.data?.success) {
        // 过滤掉非工具类的 feature (比如套餐包)
        // 这里假设我们只关心 'api_tool' 和 'pipeline_node' 类型的 feature
        const allFeatures = res.data.data.items || [];
        setTools(allFeatures);
      }
    } catch (error) {
      console.error('加载工具箱失败:', error);
      message.error('加载积木库失败');
    } finally {
      setLoading(false);
    }
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
      const res = await api.post('/admin/tools/generate', {
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
                    <span style={{ fontSize: '13px' }}>{item.name}</span>
                    {item.type === 'api_tool' && <Tag color="purple" style={{marginRight:0, transform:'scale(0.8)'}}>AI生成</Tag>}
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
            placeholder={`例如：\ncurl -X POST https://api.example.com/v1/images \n-H 