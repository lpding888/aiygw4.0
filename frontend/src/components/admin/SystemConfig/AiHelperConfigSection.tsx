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
    CheckCircleOutlined,
    DisconnectOutlined,
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

interface TestResult {
    success: boolean;
    message: string;
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
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
    const [hasStoredKey, setHasStoredKey] = useState(false);
    const [pendingKeyReset, setPendingKeyReset] = useState(false);
    const [testStatus, setTestStatus] = useState<TestResult | null>(null);

    const loadConfig = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.adminAiHelper.getConfig();
            if (response?.success) {
                const config = response.data as AiHelperConfig;
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
        } catch (error: any) {
            message.error(error?.message ?? '加载AI助手配置失败');
        } finally {
            setLoading(false);
        }
    }, [form]);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    const handleTestConnection = async () => {
        try {
            setTesting(true);
            setTestStatus(null);
            const values = form.getFieldsValue();
            const payload: { apiUrl?: string; apiKey?: string } = {};
            if (values.apiUrl) payload.apiUrl = values.apiUrl;
            if (values.apiKey) payload.apiKey = values.apiKey;

            const response = await api.adminAiHelper.testConnection(payload);
            if (response?.success) {
                const models = ((response.data as { models?: ModelInfo[] })?.models ?? []) as ModelInfo[];
                setAvailableModels(models);
                setTestStatus({
                    success: true,
                    message: `已连接成功，共获取 ${models.length} 个模型`
                });
                if (!values.allowedModels || values.allowedModels.length === 0) {
                    form.setFieldsValue({
                        allowedModels: models.map((m) => m.id),
                        defaultModel: models[0]?.id
                    });
                }
            } else {
                setTestStatus({
                    success: false,
                    message: (response?.error as { message?: string })?.message ?? '连接测试失败'
                });
            }
        } catch (error: any) {
            setTestStatus({
                success: false,
                message: error?.message ?? '连接测试失败'
            });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            await api.adminAiHelper.saveConfig({
                enabled: Boolean(values.enabled),
                apiUrl: values.apiUrl || null,
                apiKey: values.apiKey || undefined,
                defaultModel: values.defaultModel || null,
                allowedModels: values.allowedModels || [],
                systemPrompt: values.systemPrompt || null,
                resetApiKey: pendingKeyReset && !values.apiKey
            });

            if (values.apiKey) {
                message.success('已保存并更新AI密钥');
                form.setFieldsValue({ apiKey: undefined });
                setHasStoredKey(true);
            } else if (pendingKeyReset) {
                message.success('已清空AI密钥');
                setHasStoredKey(false);
                setPendingKeyReset(false);
            } else {
                message.success('AI助手配置已保存');
            }

            setTestStatus(null);
            loadConfig();
        } catch (error: any) {
            message.error(error?.message ?? '保存AI配置失败');
        } finally {
            setSaving(false);
        }
    };

    const modelOptions = useMemo(() => buildModelOptions(availableModels), [availableModels]);

    const connectionAlert = testStatus ? (
        <Alert
            type={testStatus.success ? 'success' : 'error'}
            showIcon
            message={testStatus.success ? '连接成功' : '连接失败'}
            description={testStatus.message}
            style={{ marginBottom: 16 }}
            icon={testStatus.success ? <CheckCircleOutlined /> : <DisconnectOutlined />}
        />
    ) : null;

    return (
        <Card
            title={
                <Space>
                    <ExperimentOutlined />
                    <span>AI助手配置</span>
                </Space>
            }
            style={{ marginTop: 24 }}
            extra={
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={loadConfig} disabled={loading}>
                        重新加载
                    </Button>
                    <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={saving}
                        onClick={handleSave}
                    >
                        保存AI配置
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
                        填写后点击“测试连接”以验证密钥是否有效，再“保存AI配置”即可全局生效。
                    </Text>
                </Form>
            </Spin>
        </Card>
    );
}
