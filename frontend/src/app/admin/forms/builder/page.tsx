'use client';

/**
 * 表单设计器页面（新版本 - 对接CMS-105 API）
 * 艹！使用GPT5工业级框架重构，集成版本管理！
 */

import { useState, useMemo, useEffect } from 'react';
import { Card, Button, Space, message, Tabs, Tag, Alert, Input, Modal, Select, Drawer, Spin } from 'antd';
import { FormOutlined, EyeOutlined, CodeOutlined, SaveOutlined, SwapOutlined, HistoryOutlined, RobotOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { convertFormioToUFS } from '@/lib/formio/adapter';
import { FORMIO_OPTIONS } from '@/lib/formio/i18n';
import { validateUFSSchema } from '@/lib/validators';
import { formSchemas, FormSchemaVersion } from '@/lib/services/formSchemas';
import { api } from '@/lib/api';
import type { AIMessage, AISchemaUpdate, FormioSchema } from '@/types';

// 艹，使用next/dynamic关闭SSR，这个tm很关键！
const FormBuilder = dynamic(() => import('@/components/formio/FormBuilder'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: '48px', textAlign: 'center' }}>
      加载Form Builder中...
    </div>
  ),
});

const UfsRenderer = dynamic(() => import('@/components/ufs/UfsRenderer'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: '48px', textAlign: 'center' }}>
      加载UFS渲染器中...
    </div>
  ),
});

export default function FormBuilderPage() {
  const [formSchema, setFormSchema] = useState<any>({
    components: [],
  });
  const [activeTab, setActiveTab] = useState('builder');
  const [submission, setSubmission] = useState<any>(null);

  // CMS-106: 新增状态
  const [schemaId, setSchemaId] = useState<string>('');
  const [versionDescription, setVersionDescription] = useState<string>('');
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [versions, setVersions] = useState<FormSchemaVersion[]>([]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * 转换Formio Schema为UFS
   * 艹，实时转换并缓存结果！
   */
  const ufsSchema = useMemo(() => {
    try {
      if (!formSchema || !formSchema.components || formSchema.components.length === 0) {
        return null;
      }
      return convertFormioToUFS(formSchema);
    } catch (error: any) {
      console.error('[UFS转换失败]', error);
      return null;
    }
  }, [formSchema]);

  /**
   * 校验UFS Schema
   */
  const ufsValidation = useMemo(() => {
    if (!ufsSchema) return null;
    return validateUFSSchema(ufsSchema);
  }, [ufsSchema]);

  /**
   * FormBuilder变化回调
   * 艹，每次拖拽字段都会触发这个回调！
   */
  const handleSchemaChange = (schema: any) => {
    console.log('[FormBuilder] Schema变化:', schema);
    setFormSchema(schema);
  };

  /**
   * UFS表单提交回调
   * 艹，这个tm处理UFS渲染器的提交！
   */
  const handleUfsSubmit = (data: any) => {
    console.log('[UFS渲染器] 表单提交:', data);
    message.success('UFS表单提交成功！');
    setSubmission(data);
  };

  /**
   * CMS-106: 加载Schema版本历史
   */
  const loadVersions = async () => {
    if (!schemaId) return;

    try {
      const data = await formSchemas.getVersions(schemaId);
      setVersions(data.versions);
    } catch (error: any) {
      console.error('[加载版本历史失败]', error);
    }
  };

  /**
   * CMS-106: 打开保存弹窗
   */
  const handleOpenSaveModal = () => {
    if (!formSchema || formSchema.components.length === 0) {
      message.warning('表单为空，无需保存');
      return;
    }
    setSaveModalVisible(true);
  };

  /**
   * CMS-106: 保存表单Schema到后端
   */
  const handleSave = async () => {
    if (!schemaId) {
      message.error('请输入Schema ID');
      return;
    }

    try {
      setLoading(true);

      // 检查schema_id是否已存在
      let isNewSchema = false;
      try {
        await formSchemas.get(schemaId);
        // 已存在，创建新版本
        isNewSchema = false;
      } catch (error) {
        // 不存在，创建新Schema
        isNewSchema = true;
      }

      if (isNewSchema) {
        await formSchemas.create({
          schema_id: schemaId,
          fields: formSchema,
          version_description: versionDescription || '初始版本',
        });
        message.success('Schema创建成功');
        setCurrentVersion(1);
      } else {
        const newSchema = await formSchemas.createVersion(schemaId, {
          fields: formSchema,
          version_description: versionDescription || '新版本',
        });
        message.success(`新版本 v${newSchema.version} 创建成功`);
        setCurrentVersion(newSchema.version);
      }

      setSaveModalVisible(false);
      setVersionDescription('');
      await loadVersions();
    } catch (error: any) {
      message.error(`保存失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * CMS-106: 加载指定版本的Schema
   */
  const handleLoadVersion = async (version: number) => {
    if (!schemaId) return;

    try {
      setLoading(true);
      const data = await formSchemas.get(schemaId, version);
      setFormSchema(data.fields);
      setCurrentVersion(version);
      message.success(`已加载版本 v${version}`);
      setVersionModalVisible(false);
    } catch (error: any) {
      message.error(`加载失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 导出JSON
   */
  const handleExportJSON = () => {
    const json = JSON.stringify(formSchema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form-schema-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('JSON已导出');
  };

  // AI助手相关 - 类型定义见 @/types/index.ts
  const AI_INITIAL_MESSAGE: AIMessage = {
    role: 'assistant',
    content: '你好！我是您的表单设计助手。请告诉我您想创建什么样的表单字段？例如："我需要一个上传图片的按钮" 或 "帮我加一个选择性别的下拉框"。'
  };
  const [aiDrawerVisible, setAiDrawerVisible] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([AI_INITIAL_MESSAGE]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // AI Drawer 关闭处理 - 保留对话历史，提供清空选项
  const handleAiDrawerClose = () => {
    setAiDrawerVisible(false);
    // 保留对话历史，不自动清空
  };

  // 清空 AI 对话历史
  const handleClearAiHistory = () => {
    Modal.confirm({
      title: '清空对话历史',
      content: '确定要清空与 AI 助手的所有对话记录吗？',
      okText: '清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        setAiMessages([AI_INITIAL_MESSAGE]);
        message.success('对话历史已清空');
      },
    });
  };

  const handleAiSend = async () => {
    if (!aiInput.trim()) return;

    const userMsg: AIMessage = { role: 'user', content: aiInput };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput('');
    setAiLoading(true);

    try {
      // 调用后端AI接口 - 返回 AxiosResponse<APIResponse<AIChatResponse>>
      const response = await api.admin.chatWithAI({
        message: userMsg.content,
        context: JSON.stringify(formSchema) // 把当前Schema传给AI
      });

      const result = response.data;
      if (!result.success || !result.data?.reply) {
        throw new Error(result.error?.message || 'AI助手未返回有效结果');
      }

      const { reply, schemaUpdate } = result.data;
      const aiMsg: AIMessage = { role: 'assistant', content: reply };
      setAiMessages((prev) => [...prev, aiMsg]);

      // 如果AI生成了Schema更新建议 - 使用结构化的 AISchemaUpdate
      if (schemaUpdate && schemaUpdate.components?.length > 0) {
        const { action, components, targetIndex, targetKey } = schemaUpdate as AISchemaUpdate;
        const actionText = action === 'append' ? '添加' : action === 'replace' ? '替换' : '删除';

        Modal.confirm({
          title: `AI 建议${actionText}组件`,
          content: `将${actionText} ${components.length} 个字段到表单中，是否应用？`,
          okText: '应用',
          cancelText: '取消',
          onOk: () => {
            setFormSchema((prev: FormioSchema) => {
              const currentComponents = [...(prev.components || [])];

              if (action === 'append') {
                return { ...prev, components: [...currentComponents, ...components] };
              } else if (action === 'replace') {
                // 根据 targetIndex 或 targetKey 定位
                const idx = targetIndex ?? currentComponents.findIndex((c) => c.key === targetKey);
                if (idx >= 0 && idx < currentComponents.length) {
                  currentComponents.splice(idx, 1, ...components);
                }
                return { ...prev, components: currentComponents };
              } else if (action === 'delete') {
                const idx = targetIndex ?? currentComponents.findIndex((c) => c.key === targetKey);
                if (idx >= 0 && idx < currentComponents.length) {
                  currentComponents.splice(idx, 1);
                }
                return { ...prev, components: currentComponents };
              }

              return prev;
            });
            message.success(`表单已${actionText}成功`);
          }
        });
      }
    } catch (error: any) {
      console.error('[AI Chat Error]', error);
      let errorMsg = '抱歉，AI 助手暂时无法响应';
      if (error.code === 4290) errorMsg += ' (请求过于频繁，请稍后再试)';
      else if (error.code >= 5000) errorMsg += ' (服务异常，请联系管理员)';
      else if (error.message) errorMsg += `: ${error.message}`;

      setAiMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      message.error('AI 响应失败');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', position: 'relative' }}>
      <Card
        title={
          <Space>
            <FormOutlined style={{ fontSize: '20px' }} />
            <span style={{ fontSize: '18px', fontWeight: 600 }}>表单设计器</span>
            <Tag color="blue">Form.io集成</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button
              type="primary"
              style={{ background: 'linear-gradient(45deg, #108ee9, #87d068)', border: 'none' }}
              icon={<RobotOutlined />}
              onClick={() => setAiDrawerVisible(true)}
            >
              AI 助手
            </Button>
            <Input
              placeholder="Schema ID (如: user-profile)"
              value={schemaId}
              onChange={(e) => setSchemaId(e.target.value)}
              style={{ width: 200 }}
            />
            {currentVersion > 0 && (
              <Tag color="blue">v{currentVersion}</Tag>
            )}
            <Button
              icon={<HistoryOutlined />}
              onClick={() => {
                if (!schemaId) {
                  message.warning('请先输入Schema ID');
                  return;
                }
                loadVersions();
                setVersionModalVisible(true);
              }}
            >
              版本历史
            </Button>
            <Button icon={<SaveOutlined />} type="primary" onClick={handleOpenSaveModal}>
              保存Schema
            </Button>
            <Button icon={<CodeOutlined />} onClick={handleExportJSON}>
              导出JSON
            </Button>
          </Space>
        }
      >
        {/* Tab切换 */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'builder',
              label: (
                <span>
                  <FormOutlined /> 表单设计器
                </span>
              ),
              children: (
                <div>
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '12px',
                      background: '#f0f2f5',
                      borderRadius: '4px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                      💡 提示：从左侧拖拽字段到右侧画布，点击字段可配置属性
                    </p>
                  </div>
                  <FormBuilder
                    schema={formSchema}
                    onChange={handleSchemaChange}
                    options={FORMIO_OPTIONS}
                  />
                </div>
              ),
            },
            {
              key: 'preview',
              label: (
                <span>
                  <EyeOutlined /> UFS实时预览
                  {ufsSchema && <Tag color="cyan" style={{ marginLeft: '8px' }}>RHF + AntD</Tag>}
                </span>
              ),
              children: (
                <div>
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '12px',
                      background: '#e6f7ff',
                      borderRadius: '4px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '13px', color: '#0050b3' }}>
                      📝 UFS预览模式：使用react-hook-form + AntD渲染转换后的UFS Schema
                    </p>
                  </div>

                  {/* UFS校验状态提示 */}
                  {ufsValidation && !ufsValidation.success && (
                    <Alert
                      type="warning"
                      message="UFS Schema存在错误，无法渲染"
                      description={
                        <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                          {ufsValidation.errors?.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      }
                      style={{ marginBottom: '16px' }}
                      showIcon
                    />
                  )}

                  {/* UFS渲染器 */}
                  {ufsSchema && ufsValidation?.success ? (
                    <div style={{
                      padding: '24px',
                      background: '#fafafa',
                      borderRadius: '8px',
                      border: '1px solid #d9d9d9'
                    }}>
                      <UfsRenderer
                        schema={ufsSchema}
                        onSubmit={handleUfsSubmit}
                        onChange={(changed) => {
                          console.log('[UFS预览] 数据变化:', changed);
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '48px',
                        textAlign: 'center',
                        color: '#999',
                      }}
                    >
                      <FormOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                      <p>表单为空或转换失败，请先在设计器中添加字段</p>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'json',
              label: (
                <span>
                  <CodeOutlined /> Formio JSON
                </span>
              ),
              children: (
                <div>
                  <pre
                    style={{
                      padding: '16px',
                      background: '#f5f5f5',
                      borderRadius: '4px',
                      overflow: 'auto',
                      maxHeight: '600px',
                      fontSize: '12px',
                      lineHeight: '1.6',
                    }}
                  >
                    {JSON.stringify(formSchema, null, 2)}
                  </pre>
                </div>
              ),
            },
            {
              key: 'ufs',
              label: (
                <span>
                  <SwapOutlined /> UFS Schema
                  {ufsSchema && <Tag color="green" style={{ marginLeft: '8px' }}>已转换</Tag>}
                </span>
              ),
              children: (
                <div>
                  {/* UFS校验状态 */}
                  {ufsValidation && (
                    <Alert
                      type={ufsValidation.success ? 'success' : 'error'}
                      message={
                        ufsValidation.success
                          ? `✓ UFS Schema校验通过，包含 ${ufsSchema?.fields.length || 0} 个字段`
                          : '✗ UFS Schema校验失败'
                      }
                      description={
                        !ufsValidation.success && (
                          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                            {ufsValidation.errors?.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        )
                      }
                      style={{ marginBottom: '16px' }}
                    />
                  )}

                  {/* UFS Schema JSON */}
                  {ufsSchema ? (
                    <pre
                      style={{
                        padding: '16px',
                        background: '#f5f5f5',
                        borderRadius: '4px',
                        overflow: 'auto',
                        maxHeight: '600px',
                        fontSize: '12px',
                        lineHeight: '1.6',
                      }}
                    >
                      {JSON.stringify(ufsSchema, null, 2)}
                    </pre>
                  ) : (
                    <div
                      style={{
                        padding: '48px',
                        textAlign: 'center',
                        color: '#999',
                      }}
                    >
                      <SwapOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                      <p>表单为空或转换失败，请先在设计器中添加字段</p>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />

        {/* 提交数据展示 */}
        {submission && (
          <Card
            title="最近提交的数据"
            style={{ marginTop: '24px' }}
            size="small"
          >
            <pre
              style={{
                padding: '12px',
                background: '#f5f5f5',
                borderRadius: '4px',
                fontSize: '12px',
                margin: 0,
              }}
            >
              {JSON.stringify(submission, null, 2)}
            </pre>
          </Card>
        )}
      </Card>

      {/* CMS-106: 保存Schema弹窗 */}
      <Modal
        title="保存表单Schema"
        open={saveModalVisible}
        onOk={handleSave}
        onCancel={() => setSaveModalVisible(false)}
        confirmLoading={loading}
        okText="保存"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>Schema ID:</div>
            <Input
              value={schemaId}
              onChange={(e) => setSchemaId(e.target.value)}
              placeholder="例如: user-profile"
              disabled
            />
          </div>
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 500 }}>版本描述:</div>
            <Input.TextArea
              value={versionDescription}
              onChange={(e) => setVersionDescription(e.target.value)}
              placeholder="描述本次修改的内容..."
              rows={3}
            />
          </div>
        </Space>
      </Modal>

      {/* CMS-106: 版本历史弹窗 */}
      <Modal
        title={`版本历史 - ${schemaId}`}
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        footer={null}
        width={600}
      >
        {versions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            暂无版本历史
          </div>
        ) : (
          <div>
            {versions.map((ver) => (
              <Card
                key={ver.version}
                size="small"
                style={{ marginBottom: '12px' }}
                extra={
                  <Space>
                    {ver.is_current && <Tag color="green">当前</Tag>}
                    <Tag color={
                      ver.publish_status === 'published' ? 'blue' :
                        ver.publish_status === 'draft' ? 'orange' : 'default'
                    }>
                      {ver.publish_status}
                    </Tag>
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => handleLoadVersion(ver.version)}
                      disabled={ver.is_current}
                    >
                      加载
                    </Button>
                  </Space>
                }
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    版本 v{ver.version}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    {ver.version_description || '无描述'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    创建时间: {new Date(ver.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Modal>

      {/* AI助手侧边栏 */}
      <Drawer
        title={
          <Space>
            <RobotOutlined style={{ color: '#1890ff' }} />
            <span>AI 设计助手</span>
          </Space>
        }
        extra={
          <Button
            type="text"
            size="small"
            danger
            onClick={handleClearAiHistory}
            disabled={aiMessages.length <= 1}
          >
            清空记录
          </Button>
        }
        placement="right"
        onClose={handleAiDrawerClose}
        open={aiDrawerVisible}
        width={400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, overflow: 'auto', paddingBottom: '16px' }}>
            {aiMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: '16px',
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: msg.role === 'user' ? '#1890ff' : '#f0f2f5',
                    color: msg.role === 'user' ? '#fff' : '#333',
                    maxWidth: '80%',
                    textAlign: 'left',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div style={{ textAlign: 'left', marginBottom: '16px' }}>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#f0f2f5',
                  }}
                >
                  <span className="typing-indicator">
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#1890ff',
                      margin: '0 2px',
                      animation: 'typing 1.4s infinite',
                      animationDelay: '0s',
                    }} />
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#1890ff',
                      margin: '0 2px',
                      animation: 'typing 1.4s infinite',
                      animationDelay: '0.2s',
                    }} />
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#1890ff',
                      margin: '0 2px',
                      animation: 'typing 1.4s infinite',
                      animationDelay: '0.4s',
                    }} />
                  </span>
                  <span style={{ marginLeft: 8, color: '#86868B', fontSize: 13 }}>AI 正在思考...</span>
                </div>
              </div>
            )}
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
            <Input.TextArea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="输入您的需求..."
              autoSize={{ minRows: 2, maxRows: 4 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleAiSend();
                }
              }}
            />
            <Button
              type="primary"
              block
              style={{ marginTop: '8px' }}
              onClick={handleAiSend}
              loading={aiLoading}
            >
              发送
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
