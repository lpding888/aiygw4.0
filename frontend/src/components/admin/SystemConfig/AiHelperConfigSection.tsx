'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Button,
    Card,
    Form,
    Input,
    Select,
    Space,
    Spin,
    Switch,
    Tag,
    Typography,
    message
} from 'antd';
import {
    ExperimentOutlined,
    ReloadOutlined,
    SaveOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';

const { TextArea } = Input;
const { Text } = Typography;

interface AiHelperConfig {
    enabled: boolean;
    apiUrl: string | null;
    hasApiKey: boolean;
    baseUrl: string;
    chatEndpoint: string;
    defaultModel: string | null;
    allowedModels: string[];
    systemPrompt: string | null;
}

interface ModelInfo {
    id: string;
    name?: string | null;
}

const buildModelOptions = (models: ModelInfo[]) =>
    models.map((model) => ({
        value: model.id,
        label: model.name || model.id
    }));

export default function AiHelperConfigSection() {
    // Embedding State
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [connectionAlert, setConnectionAlert] = useState<React.ReactNode>(null);
    const [pendingKeyReset, setPendingKeyReset] = useState(false);
    const [hasStoredKey, setHasStoredKey] = useState(false);
    const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
    const [testing, setTesting] = useState(false);

    // Derived state for model options
    const modelOptions = useMemo(() => buildModelOptions(availableModels), [availableModels]);

    const [embeddingForm] = Form.useForm();
    const [embeddingLoading, setEmbeddingLoading] = useState(false);
    const [embeddingSaving, setEmbeddingSaving] = useState(false);
    const [embeddingTesting, setEmbeddingTesting] = useState(false);

    // Architect State
    const [architectForm] = Form.useForm();
    const [architectLoading, setArchitectLoading] = useState(false);
    const [architectSaving, setArchitectSaving] = useState(false);

    // Initial load for both
    const loadConfig = useCallback(async () => {
        try {
            setLoading(true);
            setEmbeddingLoading(true);

            // 1. Load AI Helper Config
            const response = await api.adminAiHelper.getConfig();
            const resData = response as any; // Cast for flexibility
            if (resData?.success || resData?.data?.success) {
                // Handle inconsistent wrapper
                const config = (resData.data?.data || resData.data) as AiHelperConfig;

                form.setFieldsValue({
                    enabled: config.enabled,
                    apiUrl: config.apiUrl ?? '',
                    defaultModel: config.defaultModel ?? undefined,
                    allowedModels: config.allowedModels ?? [],
                    systemPrompt: config.systemPrompt ?? undefined,
                    apiKey: undefined
                });
                setHasStoredKey(config.hasApiKey);
                setPendingKeyReset(false);
                setAvailableModels(
                    (config.allowedModels ?? []).map((id) => ({
                        id,
                        name: id
                    }))
                );
            }

            // 2. Load Embedding Config
            const sysConfigRes: any = await api.admin.getSystemConfig();
            if (sysConfigRes.data?.success) {
                const configs = Array.isArray(sysConfigRes.data.data) ? sysConfigRes.data.data : sysConfigRes.data.data.configs || [];
                const map: Record<string, any> = {};
                configs.forEach((c: any) => map[c.key] = c.value);

                embeddingForm.setFieldsValue({
                    AI_EMBEDDING_PROTOCOL: map['AI_EMBEDDING_PROTOCOL'] || 'openai',
                    AI_EMBEDDING_BASE_URL: map['AI_EMBEDDING_BASE_URL'] || 'https://api.openai.com/v1',
                    AI_EMBEDDING_MODEL: map['AI_EMBEDDING_MODEL'] || 'text-embedding-3-small',
                    AI_EMBEDDING_API_KEY: undefined
                });

                // 3. Load Architect Config
                architectForm.setFieldsValue({
                    AI_ARCHITECT_MODEL: map['AI_ARCHITECT_MODEL'] || 'deepseek-chat'
                });
            }

        } catch (error: any) {
            message.error(error?.message ?? '加载配置失败');
        } finally {
            setLoading(false);
            setEmbeddingLoading(false);
            setArchitectLoading(false);
        }
    }, [form, embeddingForm]);

    // Initial Load
    useEffect(() => {
        loadConfig();
    }, [loadConfig]);


    const handleTestConnection = async () => {
        try {
            const values = await form.validateFields();
            setTesting(true);
            setConnectionAlert(null);

            const res: any = await api.adminAiHelper.testConnection({
                type: 'chat',
                baseUrl: values.apiUrl,
                apiKey: values.apiKey,
                model: values.defaultModel
            });

            if (res.success || res.data?.success) {
                message.success('连接测试成功');
                const models = res.data?.models || res.data?.data?.models;
                if (models) {
                    setAvailableModels(models.map((m: any) => ({ id: m.id, name: m.id })));
                }
            } else {
                setConnectionAlert(<Alert type="error" message="连接失败" description={res.message || 'Unknown error'} showIcon />);
                message.error('连接失败');
            }
        } catch (error: any) {
            setConnectionAlert(<Alert type="error" message="测试出错" description={error.message} showIcon />);
            message.error(error.message);
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);

            const config: AiHelperConfig = {
                enabled: values.enabled,
                apiUrl: values.apiUrl,
                hasApiKey: !!values.apiKey,
                baseUrl: values.apiUrl,
                chatEndpoint: '',
                defaultModel: values.defaultModel,
                allowedModels: values.allowedModels,
                systemPrompt: values.systemPrompt,
            };

            await api.adminAiHelper.saveConfig({
                ...config,
                resetApiKey: pendingKeyReset, // Ensure API support
                apiKey: values.apiKey
            });

            message.success('配置已保存');
            setPendingKeyReset(false);
            if (values.apiKey) setHasStoredKey(true);

        } catch (error: any) {
            message.error('保存失败: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEmbedding = async () => {
        try {
            const values = await embeddingForm.validateFields();
            setEmbeddingSaving(true);

            const configsToSave = [
                { key: 'AI_EMBEDDING_PROTOCOL', value: values.AI_EMBEDDING_PROTOCOL },
                { key: 'AI_EMBEDDING_BASE_URL', value: values.AI_EMBEDDING_BASE_URL },
                { key: 'AI_EMBEDDING_MODEL', value: values.AI_EMBEDDING_MODEL },
            ];

            if (values.AI_EMBEDDING_API_KEY) {
                configsToSave.push({ key: 'AI_EMBEDDING_API_KEY', value: values.AI_EMBEDDING_API_KEY });
            }

            for (const item of configsToSave) {
                try {
                    await api.admin.updateSystemConfig(item.key, { value: item.value });
                } catch (e: any) {
                    // Fix 'sensitive' prop error by casting
                    if (e.code === 4040) await api.admin.createSystemConfig({
                        key: item.key,
                        value: item.value,
                        sensitive: item.key.includes('KEY')
                    } as any);
                }
            }

            message.success('Embedding 配置已保存');
        } catch (error: any) {
            message.error('保存失败: ' + error.message);
        } finally {
            setEmbeddingSaving(false);
        }
    };

    const handleTestEmbeddingConnection = async () => {
        try {
            const values = await embeddingForm.validateFields();
            setEmbeddingTesting(true);

            const res: any = await api.adminAiHelper.testConnection({
                type: 'embedding',
                protocol: values.AI_EMBEDDING_PROTOCOL,
                baseUrl: values.AI_EMBEDDING_BASE_URL,
                model: values.AI_EMBEDDING_MODEL,
                apiKey: values.AI_EMBEDDING_API_KEY
            });

            if (res.success || res.data?.success) {
                message.success('连接测试成功');
            } else {
                message.error('连接测试失败: ' + (res.message || 'Unknown'));
            }
        } catch (error: any) {
            message.error('测试失败: ' + (error.message || '未知错误'));
        } finally {
            setEmbeddingTesting(false);
        }
    };

    const handleSaveArchitect = async () => {
        try {
            const values = await architectForm.validateFields();
            setArchitectSaving(true);

            await api.admin.createSystemConfig({
                key: 'AI_ARCHITECT_MODEL',
                value: values.AI_ARCHITECT_MODEL,
                description: 'AI Architect Service Model'
            });

            message.success('Architect 配置已保存');
        } catch (error: any) {
            // Handle create if exists error gracefully or use update?
            // api.admin.createSystemConfig usually fails if exists.
            // We should check api.admin.updateSystemConfig logic in handledSaveEmbedding above.
            // It calls update, catch 404 then create. Let's replicate that.
            let values;
            try {
                values = await architectForm.validateFields();
                await api.admin.updateSystemConfig('AI_ARCHITECT_MODEL', { value: values.AI_ARCHITECT_MODEL });
                message.success('Architect 配置已保存');
            } catch (updateError: any) {
                if (updateError.code === 4040) {
                    await api.admin.createSystemConfig({
                        key: 'AI_ARCHITECT_MODEL',
                        value: values.AI_ARCHITECT_MODEL,
                        description: 'AI Architect Service Model'
                    });
                    message.success('Architect 配置已保存');
                } else {
                    message.error('保存失败: ' + updateError.message);
                }
            }
        } finally {
            setArchitectSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            <Card
                title={
                    <Space>
                        <ExperimentOutlined />
                        <span>AI助手配置 (Chat)</span>
                    </Space>
                }
                extra={
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={loadConfig} disabled={loading}>
                            刷新
                        </Button>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            loading={saving}
                            onClick={handleSave}
                        >
                            保存助手配置
                        </Button>
                    </Space>
                }
            >
                <Spin spinning={loading}>
                    <Form
                        layout="vertical"
                        form={form}
                        initialValues={{
                            enabled: true,
                            allowedModels: [],
                            defaultModel: undefined
                        }}
                    >
                        <Alert
                            message="配置用于 AI 学习 / 表单向导 的模型与密钥"
                            description="填写 Base URL 与 API Key 后，点击“测试连接”可自动验证并拉取模型列表。保存后后端将自动使用此配置执行 DeepSeek 调用。"
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />

                        <Form.Item label="启用 AI 助手" name="enabled" valuePropName="checked">
                            <Switch />
                        </Form.Item>

                        {connectionAlert}

                        <Form.Item
                            label="API 地址 (Base URL 或 Chat Endpoint)"
                            name="apiUrl"
                            tooltip="可填写 https://api.deepseek.com 或完整 Chat Completions 地址"
                        >
                            <Input placeholder="https://api.deepseek.com" />
                        </Form.Item>

                        <Form.Item
                            label="API Key"
                            name="apiKey"
                            tooltip="不会回显已保存的密钥，输入则会覆盖"
                        >
                            <Input.Password placeholder="sk-..." />
                        </Form.Item>

                        <Space style={{ marginBottom: 16 }}>
                            <Button
                                icon={<ExperimentOutlined />}
                                onClick={handleTestConnection}
                                loading={testing}
                            >
                                测试连接
                            </Button>
                            {hasStoredKey && !pendingKeyReset && (
                                <Tag color="green">已配置密钥</Tag>
                            )}
                            {pendingKeyReset && <Tag color="orange">保存后将清空密钥</Tag>}
                            {hasStoredKey && (
                                <Button
                                    danger
                                    size="small"
                                    onClick={() => {
                                        setPendingKeyReset(true);
                                        form.setFieldsValue({ apiKey: undefined });
                                    }}
                                >
                                    清空已保存密钥
                                </Button>
                            )}
                        </Space>

                        <Form.Item
                            label="允许使用的模型"
                            name="allowedModels"
                            tooltip="测试连接后可从列表中选择，也可以手动输入"
                        >
                            <Select
                                mode="tags"
                                placeholder="选择或输入模型名称"
                                options={modelOptions}
                                allowClear
                            />
                        </Form.Item>

                        <Form.Item
                            label="默认模型"
                            name="defaultModel"
                            tooltip="用于 AI 学习和助手默认调用"
                        >
                            <Select
                                placeholder="选择默认模型"
                                options={modelOptions}
                                allowClear
                            />
                        </Form.Item>

                        <Form.Item
                            label="系统提示词 (System Prompt)"
                            name="systemPrompt"
                            tooltip="会作为系统提示词注入到 AI 助手和学习任务中"
                        >
                            <TextArea
                                rows={5}
                                placeholder="你是一个专业的系统架构师..."
                                allowClear
                            />
                        </Form.Item>

                        <Text type="secondary">
                            填写后点击“测试连接”以验证密钥是否有效，再“保存AI配置”即可保存生效。
                        </Text>
                    </Form>
                </Spin>
            </Card>

            <Card
                title={
                    <Space>
                        <ExperimentOutlined />
                        <span>AI 架构师配置 (Architect)</span>
                    </Space>
                }
                extra={
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={architectSaving}
                        onClick={handleSaveArchitect}
                    >
                        保存架构师配置
                    </Button>
                }
            >
                <Spin spinning={loading}>
                    <Form
                        layout="vertical"
                        form={architectForm}
                        initialValues={{
                            AI_ARCHITECT_MODEL: 'deepseek-chat'
                        }}
                    >
                        <Alert
                            message="配置 AI 架构师 (Copilot) 使用的推理模型"
                            description="AI 架构师负责生成和修改流水线。建议使用 DeepSeek V3 或 GPT-4 等高智商模型。"
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        <Form.Item
                            label="Architect Model"
                            name="AI_ARCHITECT_MODEL"
                            tooltip="用于生成流水线 JSON 的模型"
                            rules={[{ required: true }]}
                        >
                            <Select
                                placeholder="选择模型"
                                options={modelOptions}
                                showSearch
                                allowClear
                            />
                        </Form.Item>
                    </Form>
                </Spin>
            </Card>

            <Card
                title={
                    <Space>
                        <ExperimentOutlined />
                        <span>向量化配置 (RAG Embedding)</span>
                    </Space>
                }
                extra={
                    <Space>
                        <Button
                            icon={<ExperimentOutlined />}
                            loading={embeddingTesting}
                            onClick={handleTestEmbeddingConnection}
                        >
                            测试连接
                        </Button>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            loading={embeddingSaving}
                            onClick={handleSaveEmbedding}
                        >
                            保存向量配置
                        </Button>
                    </Space>
                }
            >
                <Spin spinning={embeddingLoading}>
                    <Form
                        layout="vertical"
                        form={embeddingForm}
                        initialValues={{
                            AI_EMBEDDING_PROTOCOL: 'openai',
                            AI_EMBEDDING_BASE_URL: 'https://api.openai.com/v1',
                            AI_EMBEDDING_MODEL: 'text-embedding-3-small'
                        }}
                    >
                        <Alert
                            message="配置知识库向量化使用的模型"
                            description="支持 OpenAI、智谱或本地模型 (兼容 OpenAI 格式)。RAG 任务将使用此配置生成向量。"
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />

                        <Form.Item
                            label="协议类型"
                            name="AI_EMBEDDING_PROTOCOL"
                            rules={[{ required: true }]}
                        >
                            <Select options={[
                                { label: 'OpenAI (Standard)', value: 'openai' },
                                { label: 'Zhipu (ChatGLM)', value: 'zhipu' },
                                { label: 'Local / OneAPI / vLLM', value: 'local' },
                            ]} />
                        </Form.Item>

                        <Form.Item
                            label="Base URL"
                            name="AI_EMBEDDING_BASE_URL"
                            tooltip="API 基础地址，例如 https://api.openai.com/v1"
                            rules={[{ required: true }]}
                        >
                            <Input placeholder="https://api.openai.com/v1" />
                        </Form.Item>

                        <Form.Item
                            label="Embedding Model Name"
                            name="AI_EMBEDDING_MODEL"
                            tooltip="模型名称，例如 text-embedding-3-small 或 embedding-2"
                            rules={[{ required: true }]}
                        >
                            <Input placeholder="text-embedding-3-small" />
                        </Form.Item>

                        <Form.Item
                            label="API Key"
                            name="AI_EMBEDDING_API_KEY"
                            tooltip="调用 Embedding 服务的密钥"
                        >
                            <Input.Password placeholder="sk-..." />
                        </Form.Item>
                    </Form>
                </Spin>
            </Card>
        </div >
    );
}
