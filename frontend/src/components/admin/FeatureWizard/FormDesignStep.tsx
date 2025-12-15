/**
 * Step 2: 表单设计步骤
 * Visionary Theme: Immersive Template Selection
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Space, Radio, Select, Input, Alert, message, Spin, Tag, Typography } from 'antd';
import { LeftOutlined, RightOutlined, FormOutlined, PlusOutlined, RocketOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { formSchemas } from '@/lib/services/formSchemas';

const { Option } = Select;
const { Title, Text } = Typography;

interface FormDesignStepProps {
  data: any;
  onUpdate: (data: any) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function FormDesignStep({
  data,
  onUpdate,
  onNext,
  onPrev,
}: FormDesignStepProps) {
  const [mode, setMode] = useState<'existing' | 'new' | 'template'>('template');
  const [schemas, setSchemas] = useState<any[]>([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>(
    data.form_schema_id || ''
  );
  const [newSchemaId, setNewSchemaId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 预定义模板
  const TEMPLATES = [
    {
      id: 'image-optimization',
      name: '基础修图',
      enName: 'Image Optimization',
      description: '适用于抠图、去水印、画质增强等场景。包含单张图片上传功能。',
      icon: '🖼️',
      color: 'linear-gradient(135deg, #36D1DC 0%, #5B86E5 100%)',
      schema: {
        components: [
          {
            label: '上传图片',
            key: 'image',
            type: 'file',
            storage: 'url',
            webcam: false,
            fileTypes: [
              {
                label: '',
                value: ''
              }
            ],
            validate: {
              required: true
            }
          }
        ]
      }
    },
    {
      id: 'creative-generation',
      name: '创意生图',
      enName: 'Creative Generation',
      description: '适用于文生图场景。包含提示词输入、风格选择和比例选择。',
      icon: '🎨',
      color: 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)',
      schema: {
        components: [
          {
            label: '画面描述',
            key: 'prompt',
            type: 'textarea',
            rows: 3,
            validate: {
              required: true
            },
            placeholder: '请输入您想要生成的画面描述...'
          },
          {
            label: '风格选择',
            key: 'style',
            type: 'select',
            data: {
              values: [
                { label: '写实摄影', value: 'realistic' },
                { label: '二次元动漫', value: 'anime' },
                { label: '3D渲染', value: '3d' },
                { label: '油画风格', value: 'oil' }
              ]
            },
            defaultValue: 'realistic'
          },
          {
            label: '图片比例',
            key: 'aspect_ratio',
            type: 'radio',
            values: [
              { label: '1:1 (方形)', value: '1:1' },
              { label: '3:4 (竖屏)', value: '3:4' },
              { label: '16:9 (横屏)', value: '16:9' }
            ],
            defaultValue: '1:1'
          }
        ]
      }
    },
    {
      id: 'image-editing',
      name: '智能改图',
      enName: 'Image Editing',
      description: '适用于局部重绘、换装等场景。包含原图上传和修改指令输入。',
      icon: '✨',
      color: 'linear-gradient(135deg, #834d9b 0%, #d04ed6 100%)',
      schema: {
        components: [
          {
            label: '上传原图',
            key: 'image',
            type: 'file',
            storage: 'url',
            validate: {
              required: true
            }
          },
          {
            label: '修改指令',
            key: 'prompt',
            type: 'textarea',
            rows: 2,
            placeholder: '例如：把衣服换成红色的连衣裙',
            validate: {
              required: true
            }
          }
        ]
      }
    }
  ];

  /**
   * 加载Form Schema列表
   */
  useEffect(() => {
    loadSchemas();
  }, []);

  const loadSchemas = async () => {
    try {
      setLoading(true);
      const response = await formSchemas.list({ limit: 100 });
      setSchemas(response.schemas);
    } catch (error: any) {
      console.error('[FormDesignStep] 加载Schema失败:', error);
      message.error('加载Form Schema列表失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 下一步
   */
  const handleNext = async () => {
    if (mode === 'existing') {
      if (!selectedSchemaId) {
        message.warning('请选择一个Form Schema');
        return;
      }
      onUpdate({ form_schema_id: selectedSchemaId });
      onNext();
    } else if (mode === 'template') {
      if (!selectedTemplate) {
        message.warning('请选择一个模板');
        return;
      }

      try {
        setLoading(true);
        const template = TEMPLATES.find(t => t.id === selectedTemplate);
        if (!template) throw new Error('模板不存在');

        // 自动生成Schema ID
        const autoId = `auto-${selectedTemplate}-${Date.now()}`;

        // 创建Schema
        await formSchemas.create({
          schema_id: autoId,
          fields: template.schema,
          version_description: `Created from template: ${template.name}`
        });

        // 发布该版本 (默认发布v1)
        await formSchemas.publish(autoId, 1);

        message.success('已根据模板自动创建表单');
        onUpdate({ form_schema_id: autoId });
        onNext();
      } catch (error: any) {
        message.error(`创建失败: ${error.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      // 创建新Schema模式
      if (!newSchemaId) {
        message.warning('请输入新Schema ID');
        return;
      }
      if (!/^[a-z0-9-]+$/.test(newSchemaId)) {
        message.error('Schema ID只能包含小写字母、数字和连字符');
        return;
      }
      onUpdate({
        form_schema_id: newSchemaId,
        _newSchema: true, // 标记为需要新建
      });
      onNext();
    }
  };

  /**
   * 跳转到Form Builder创建新Schema
   */
  const handleGoToBuilder = () => {
    window.open('/admin/forms/builder', '_blank');
  };

  /**
   * 预览选中的Schema
   */
  const handlePreviewSchema = async () => {
    if (!selectedSchemaId) {
      message.warning('请先选择一个Schema');
      return;
    }
    try {
      const schema = await formSchemas.get(selectedSchemaId);
      console.log('[FormDesignStep] Schema详情:', schema);
      message.info('Schema预览功能即将上线');
    } catch (error: any) {
      message.error(`加载Schema失败: ${error.message}`);
    }
  };

  /**
   * 获取Schema的显示信息
   */
  const getSchemaInfo = (schemaId: string) => {
    const schema = schemas.find((s) => s.schema_id === schemaId);
    if (!schema) return null;
    return {
      version: schema.version,
      status: schema.publish_status,
      description: schema.version_description || '无描述',
      updatedAt: new Date(schema.updated_at).toLocaleString('zh-CN'),
    };
  };

  return (
    <div className="animate-fade-up">
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Title level={2} style={{ marginBottom: 8 }}>设计您的表单</Title>
        <Text type="secondary">
          表单就是用户下单时看到的界面。您可以选择一个模板，或者自己设计用户需要填哪些信息（比如上传图片、输入提示词）。
        </Text>
      </div>

      {/* 模式选择 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
        <Radio.Group
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          buttonStyle="solid"
          size="large"
        >
          <Radio.Button value="template" style={{ padding: '0 32px' }}>
            <RocketOutlined /> 傻瓜模式 (模板)
          </Radio.Button>
          <Radio.Button value="existing" style={{ padding: '0 32px' }}>
            <FormOutlined /> 选择现有表单
          </Radio.Button>
          <Radio.Button value="new" style={{ padding: '0 32px' }}>
            <PlusOutlined /> 高级模式 (新建)
          </Radio.Button>
        </Radio.Group>
      </div>

      <Spin spinning={loading}>
        {/* 傻瓜模式 - 模板选择 */}
        {mode === 'template' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            maxWidth: 1000,
            margin: '0 auto'
          }}>
            {TEMPLATES.map(template => (
              <div
                key={template.id}
                className="bento-card"
                style={{
                  cursor: 'pointer',
                  border: selectedTemplate === template.id ? '2px solid #1D1D1F' : '1px solid rgba(0,0,0,0.05)',
                  transform: selectedTemplate === template.id ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: selectedTemplate === template.id ? '0 20px 40px rgba(0,0,0,0.1)' : undefined,
                  padding: 0,
                  overflow: 'hidden'
                }}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div style={{
                  height: 120,
                  background: template.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 48
                }}>
                  {template.icon}
                </div>
                <div style={{ padding: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{template.name}</div>
                  <div style={{ fontSize: 14, color: '#86868B', marginBottom: 12 }}>{template.enName}</div>
                  <div style={{ fontSize: 14, color: '#1D1D1F', lineHeight: 1.6 }}>{template.description}</div>
                </div>
                {selectedTemplate === template.id && (
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'white',
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1D1D1F'
                  }}>
                    <ThunderboltOutlined />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 现有Schema选择 */}
        {mode === 'existing' && (
          <div className="bento-card" style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>选择Form Schema</div>
              <Select
                style={{ width: '100%' }}
                placeholder="搜索并选择一个Schema"
                value={selectedSchemaId || undefined}
                onChange={setSelectedSchemaId}
                showSearch
                optionFilterProp="children"
                size="large"
              >
                {schemas.map((schema) => (
                  <Option key={schema.schema_id} value={schema.schema_id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{schema.schema_id}</span>
                      <Tag color="blue">v{schema.version}</Tag>
                    </div>
                  </Option>
                ))}
              </Select>
            </div>

            {/* Schema详情展示 */}
            {selectedSchemaId && getSchemaInfo(selectedSchemaId) && (
              <div style={{
                background: '#F5F5F7',
                borderRadius: 12,
                padding: 16,
                fontSize: 14
              }}>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#86868B' }}>版本:</span>
                  <span style={{ fontWeight: 500 }}>v{getSchemaInfo(selectedSchemaId)?.version}</span>
                </div>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#86868B' }}>状态:</span>
                  <Tag color={getSchemaInfo(selectedSchemaId)?.status === 'published' ? 'green' : 'orange'}>
                    {getSchemaInfo(selectedSchemaId)?.status}
                  </Tag>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: '#86868B' }}>描述:</span>
                  <div style={{ marginTop: 4 }}>{getSchemaInfo(selectedSchemaId)?.description}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <span style={{ color: '#86868B' }}>更新时间:</span>
                  <span>{getSchemaInfo(selectedSchemaId)?.updatedAt}</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <Button onClick={handlePreviewSchema} disabled={!selectedSchemaId} block>
                预览Schema内容
              </Button>
            </div>
          </div>
        )}

        {/* 新建Schema */}
        {mode === 'new' && (
          <div className="bento-card" style={{ maxWidth: 600, margin: '0 auto' }}>
            <Alert
              message="高级模式"
              description="此模式允许您创建一个全新的空白Schema，然后跳转到表单设计器进行详细配置。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>新Schema ID</div>
              <Input
                placeholder="例如: user-profile-form"
                value={newSchemaId}
                onChange={(e) => setNewSchemaId(e.target.value)}
                size="large"
              />
              <div style={{ fontSize: 12, color: '#86868B', marginTop: 4 }}>
                只能包含小写字母、数字和连字符
              </div>
            </div>

            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleGoToBuilder}
              block
              size="large"
              style={{ height: 56 }}
            >
              前往Form Builder创建Schema
            </Button>
          </div>
        )}
      </Spin>

      {/* 底部操作栏 */}
      <div style={{
        marginTop: 40,
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 24,
        borderTop: '1px solid rgba(0,0,0,0.05)'
      }}>
        <Button size="large" icon={<LeftOutlined />} onClick={onPrev} className="btn-vision-secondary">
          上一步
        </Button>
        <Button
          type="primary"
          size="large"
          icon={<RightOutlined />}
          onClick={handleNext}
          loading={loading}
          className="btn-vision"
        >
          下一步：流程编排
        </Button>
      </div>
    </div>
  );
}
