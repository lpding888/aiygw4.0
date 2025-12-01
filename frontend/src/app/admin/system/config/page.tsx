'use client';

import { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Switch, Button, Tabs, message, Spin, Divider, Alert } from 'antd';
import { SaveOutlined, RobotOutlined, GlobalOutlined, SafetyOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';

const { TextArea } = Input;

export default function SystemConfigPage() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            // 获取配置列表，转换为表单值
            try {
                const response: any = await api.admin.getSystemConfig();
                if (response.data.success && response.data.data) {
                    // 后端返回配置数组，转换为 key-value 对象
                    const configs = Array.isArray(response.data.data) ? response.data.data : response.data.data.configs || [];
                    const formValues: Record<string, any> = {};
                    configs.forEach((item: { key: string; value: any }) => {
                        formValues[item.key] = item.value;
                    });
                    form.setFieldsValue(formValues);
                }
            } catch (e) {
                console.warn('加载配置失败，使用默认值');
                form.setFieldsValue({
                    site_name: 'AI照 - 智能图像处理平台',
                    site_description: '专业的电商图片AI处理工具',
                    ai_guide_enabled: true,
                    ai_guide_model: 'gpt-3.5-turbo',
                    free_quota_daily: 5,
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (values: any) => {
        try {
            setSaving(true);
            // 逐个配置项更新/创建
            const entries = Object.entries(values).filter(([, v]) => v !== undefined && v !== '');
            let successCount = 0;

            for (const [key, value] of entries) {
                try {
                    await api.admin.updateSystemConfig(key, { value });
                    successCount++;
                } catch (err: any) {
                    // 如果是 404，说明配置不存在，尝试创建
                    if (err.code === 4040) {
                        await api.admin.createSystemConfig({ key, value });
                        successCount++;
                    } else {
                        console.error(`配置 ${key} 更新失败:`, err);
                    }
                }
            }

            message.success(`系统配置已更新 (${successCount}/${entries.length} 项)`);
        } catch (error: any) {
            message.error(`保存失败: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />;
    }

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <Card
                title="系统配置"
                extra={
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={form.submit}>
                        保存配置
                    </Button>
                }
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    initialValues={{
                        ai_guide_enabled: true,
                        ai_guide_model: 'gpt-3.5-turbo',
                    }}
                >
                    <div style={{ marginBottom: 24, padding: 16, background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h4 style={{ margin: '0 0 8px 0', color: '#1d39c4' }}>系统初始化</h4>
                                <p style={{ margin: 0, color: '#595959' }}>
                                    如果是首次部署，请点击此按钮初始化系统数据（包括 RunningHub、DeepSeek 等积木配置）。
                                </p>
                            </div>
                            <Button
                                type="primary"
                                danger
                                onClick={async () => {
                                    try {
                                        const res: any = await api.admin.initializeSystem();
                                        if (res.data.success) {
                                            message.success(res.data.message);
                                        }
                                    } catch (e: any) {
                                        message.error('初始化失败: ' + (e.message || '未知错误'));
                                    }
                                }}
                            >
                                一键初始化系统
                            </Button>
                        </div>
                    </div>

                    <Tabs
                        items={[
                            {
                                key: 'general',
                                label: (
                                    <span>
                                        <GlobalOutlined /> 基础设置
                                    </span>
                                ),
                                children: (
                                    <div style={{ paddingTop: 16 }}>
                                        <Form.Item
                                            label="平台名称"
                                            name="site_name"
                                            rules={[{ required: true, message: '请输入平台名称' }]}
                                        >
                                            <Input placeholder="例如：AI照" />
                                        </Form.Item>
                                        <Form.Item label="平台描述" name="site_description">
                                            <TextArea rows={3} placeholder="用于SEO和首页展示" />
                                        </Form.Item>
                                        <Form.Item label="客服联系方式" name="contact_info">
                                            <Input placeholder="邮箱或微信号" />
                                        </Form.Item>
                                    </div>
                                ),
                            },
                            {
                                key: 'ai',
                                label: (
                                    <span>
                                        <RobotOutlined /> AI助手配置
                                    </span>
                                ),
                                children: (
                                    <div style={{ paddingTop: 16 }}>
                                        <Alert
                                            message="AI助手功能"
                                            description="配置用于表单设计器智能指导的AI模型。建议使用通义千问或ChatGPT。"
                                            type="info"
                                            showIcon
                                            style={{ marginBottom: 24 }}
                                        />
                                        <Form.Item label="启用AI助手" name="ai_guide_enabled" valuePropName="checked">
                                            <Switch />
                                        </Form.Item>
                                        <Form.Item label="API地址 (Base URL)" name="ai_guide_api_url">
                                            <Input placeholder="例如：https://api.openai.com/v1" />
                                        </Form.Item>
                                        <Form.Item label="API Key" name="ai_guide_api_key">
                                            <Input.Password placeholder="sk-..." />
                                        </Form.Item>
                                        <Form.Item label="模型名称" name="ai_guide_model">
                                            <Input placeholder="例如：gpt-3.5-turbo 或 qwen-turbo" />
                                        </Form.Item>
                                        <Form.Item label="系统提示词 (System Prompt)" name="ai_guide_system_prompt">
                                            <TextArea
                                                rows={5}
                                                placeholder="你是一个专业的表单设计助手..."
                                                defaultValue="你是一个专业的Formio表单设计专家。请根据用户的自然语言描述，生成对应的JSON Schema配置。请直接返回JSON，不要包含多余的解释。"
                                            />
                                        </Form.Item>
                                    </div>
                                ),
                            },
                            {
                                key: 'security',
                                label: (
                                    <span>
                                        <SafetyOutlined /> 安全与限流
                                    </span>
                                ),
                                children: (
                                    <div style={{ paddingTop: 16 }}>
                                        <Form.Item label="免费用户每日配额" name="free_quota_daily">
                                            <InputNumber min={0} style={{ width: 200 }} addonAfter="次/天" />
                                        </Form.Item>
                                        <Form.Item label="单IP最大注册数" name="max_registrations_per_ip">
                                            <InputNumber min={1} style={{ width: 200 }} />
                                        </Form.Item>
                                        <Divider orientation="left">敏感词过滤</Divider>
                                        <Form.Item label="启用敏感词过滤" name="content_filter_enabled" valuePropName="checked">
                                            <Switch />
                                        </Form.Item>
                                        <Form.Item label="敏感词列表 (逗号分隔)" name="sensitive_words">
                                            <TextArea rows={4} placeholder="例如：赌博,暴力,色情" />
                                        </Form.Item>
                                    </div>
                                ),
                            },
                        ]}
                    />
                </Form>
            </Card>
        </div>
    );
}
