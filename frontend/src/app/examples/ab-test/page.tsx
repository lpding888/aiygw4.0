'use client';

/**
 * A/B实验示例页面 - 模板排序实验
 * 艹！这个页面展示如何在真实组件中使用A/B实验！
 *
 * 实验说明：
 * - 对照组（control）：按创建时间倒序
 * - 实验组A（variant_a）：按热门度排序
 * - 实验组B（variant_b）：按用户偏好推荐
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Tag, Typography, Space, message, Alert } from 'antd';
import {
  ExperimentOutlined,
  ThunderboltOutlined,
  HeartOutlined,
  ClockCircleOutlined,
  FireOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { useExperiment } from '@/hooks/useExperiment';

const { Title, Text } = Typography;

/**
 * 模板数据
 */
interface Template {
  id: string;
  name: string;
  thumbnail: string;
  created_at: string;
  popularity_score: number; // 热门度评分
  recommendation_score: number; // 推荐评分
}

/**
 * 模拟模板数据
 */
const MOCK_TEMPLATES: Template[] = [
  {
    id: 't1',
    name: '商业海报模板',
    thumbnail: '🎨',
    created_at: '2025-01-01',
    popularity_score: 85,
    recommendation_score: 90,
  },
  {
    id: 't2',
    name: '节日促销模板',
    thumbnail: '🎉',
    created_at: '2025-01-05',
    popularity_score: 95,
    recommendation_score: 75,
  },
  {
    id: 't3',
    name: '产品展示模板',
    thumbnail: '📦',
    created_at: '2025-01-10',
    popularity_score: 70,
    recommendation_score: 85,
  },
  {
    id: 't4',
    name: '品牌推广模板',
    thumbnail: '🚀',
    created_at: '2025-01-15',
    popularity_score: 60,
    recommendation_score: 95,
  },
  {
    id: 't5',
    name: '社交媒体模板',
    thumbnail: '📱',
    created_at: '2025-01-20',
    popularity_score: 80,
    recommendation_score: 70,
  },
];

/**
 * A/B实验示例页面
 */
export default function ABTestExamplePage() {
  // 使用A/B实验Hook
  const { variantId, loading, trackConversion, getConfig, isControl, isVariant } =
    useExperiment('template_sort_experiment');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [sortMethod, setSortMethod] = useState<string>('');

  /**
   * 根据实验变体排序模板
   */
  useEffect(() => {
    if (loading) return;

    let sorted = [...MOCK_TEMPLATES];
    let method = '';

    if (variantId === 'control') {
      // 对照组：按创建时间倒序
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      method = '按创建时间排序';
    } else if (variantId === 'variant_a') {
      // 实验组A：按热门度排序
      sorted.sort((a, b) => b.popularity_score - a.popularity_score);
      method = '按热门度排序';
    } else if (variantId === 'variant_b') {
      // 实验组B：按推荐评分排序
      sorted.sort((a, b) => b.recommendation_score - a.recommendation_score);
      method = '按推荐评分排序';
    } else {
      // 未参与实验：默认排序
      method = '默认排序';
    }

    setTemplates(sorted);
    setSortMethod(method);
  }, [variantId, loading]);

  /**
   * 点击模板（转化事件）
   */
  const handleTemplateClick = (template: Template) => {
    // 记录转化事件
    trackConversion('template_click', 1);

    message.success(`点击了模板：${template.name}`);
  };

  /**
   * 使用模板（高价值转化事件）
   */
  const handleUseTemplate = (template: Template) => {
    // 记录高价值转化事件
    trackConversion('template_use', 10);

    message.success(`开始使用模板：${template.name}`);
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Text>加载中...</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>
          <ExperimentOutlined style={{ marginRight: 8 }} />
          A/B实验示例 - 模板排序实验
        </Title>
      </div>

      {/* 实验信息提示 */}
      <Alert
        message={
          <Space>
            <Text strong>当前变体：</Text>
            {variantId ? (
              <Tag color="blue" icon={<ExperimentOutlined />}>
                {variantId === 'control'
                  ? '对照组'
                  : variantId === 'variant_a'
                    ? '实验组A'
                    : '实验组B'}
              </Tag>
            ) : (
              <Tag>未参与实验</Tag>
            )}
            <Text>|</Text>
            <Text>排序方式：{sortMethod}</Text>
          </Space>
        }
        description={
          <div style={{ marginTop: 8 }}>
            <div>
              <strong>实验目的：</strong>测试不同排序方式对用户模板点击率和使用率的影响
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>变体说明：</strong>
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li>
                  <ClockCircleOutlined /> 对照组：按创建时间倒序（最新优先）
                </li>
                <li>
                  <FireOutlined /> 实验组A：按热门度排序（最热门优先）
                </li>
                <li>
                  <StarOutlined /> 实验组B：按推荐评分排序（最匹配优先）
                </li>
              </ul>
            </div>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* 模板列表 */}
      <Row gutter={[16, 16]}>
        {templates.map((template, index) => (
          <Col xs={24} sm={12} md={8} lg={6} key={template.id}>
            <Card
              hoverable
              onClick={() => handleTemplateClick(template)}
              cover={
                <div
                  style={{
                    height: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    fontSize: 80,
                  }}
                >
                  {template.thumbnail}
                </div>
              }
            >
              <Card.Meta
                title={
                  <Space>
                    <Text strong>{template.name}</Text>
                    <Tag color="blue">#{index + 1}</Tag>
                  </Space>
                }
                description={
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <Space size="small">
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <FireOutlined /> {template.popularity_score}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <StarOutlined /> {template.recommendation_score}
                        </Text>
                      </Space>
                    </div>

                    <Button
                      type="primary"
                      size="small"
                      block
                      icon={<ThunderboltOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseTemplate(template);
                      }}
                    >
                      使用模板
                    </Button>
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 使用说明 */}
      <Card title="💡 如何使用A/B实验" style={{ marginTop: 24 }}>
        <Title level={5}>1. 在组件中引入Hook</Title>
        <pre
          style={{
            background: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            overflow: 'auto',
          }}
        >
          {`import { useExperiment } from '@/hooks/useExperiment';

function TemplatePage() {
  const { variantId, trackConversion, getConfig } = useExperiment('template_sort_experiment');

  // 根据variantId调整业务逻辑
  const sortMethod = variantId === 'control'
    ? 'time'
    : variantId === 'variant_a'
      ? 'popularity'
      : 'recommendation';

  // 记录转化事件
  const handleClick = () => {
    trackConversion('template_click');
  };

  return <div>...</div>;
}`}
        </pre>

        <Title level={5} style={{ marginTop: 16 }}>
          2. 配置实验（在A/B实验管理后台）
        </Title>
        <pre
          style={{
            background: '#f5f5f5',
            padding: '12px',
            borderRadius: '4px',
            overflow: 'auto',
          }}
        >
          {`{
  "id": "template_sort_experiment",
  "name": "模板排序实验",
  "status": "running",
  "traffic_allocation": 100,
  "variants": [
    { "id": "control", "name": "对照组", "weight": 34 },
    { "id": "variant_a", "name": "实验组A", "weight": 33 },
    { "id": "variant_b", "name": "实验组B", "weight": 33 }
  ]
}`}
        </pre>

        <Title level={5} style={{ marginTop: 16 }}>
          3. 查看实验数据
        </Title>
        <Text>
          访问 <Text code>/admin/experiments</Text> 查看实验数据，包括曝光数、转化数、转化率等指标。
        </Text>
      </Card>
    </div>
  );
}
