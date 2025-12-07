'use client';

import { useState, useEffect } from 'react';
import {
    Card,
    Table,
    Button,
    Tag,
    Space,
    Modal,
    Form,
    Input,
    InputNumber,
    Select,
    Typography,
    Tooltip,
    message,
    DatePicker,
    Row,
    Col,
} from 'antd';
import {
    PlusOutlined,
    ReloadOutlined,
    CopyOutlined,
    GiftOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from '@/lib/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface InviteCode {
    id: string;
    code: string;
    type: 'general' | 'vip' | 'special' | 'limited';
    status: 'active' | 'used' | 'expired' | 'disabled';
    max_uses: number;
    used_count: number;
    expires_at: string | null;
    created_at: string;
    batch_name?: string;
    description?: string;
}

export default function InviteCodesPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<InviteCode[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [generating, setGenerating] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/invite-codes', {
                params: {
                    page,
                    limit: pageSize,
                    sortBy: 'created_at',
                    sortOrder: 'desc',
                },
            });
            // Adjust structure based on actual API response
            const list = response.data.data?.list || response.data.data || [];
            const totalCount = response.data.data?.total || list.length;

            setData(list);
            setTotal(totalCount);
        } catch (error) {
            console.error('Fetch error:', error);
            message.error('获取邀请码列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page, pageSize]);

    const handleGenerate = async (values: any) => {
        setGenerating(true);
        try {
            await axios.post('/invite-codes/generate', {
                ...values,
                validDays: values.validDays || 30, // Default to 30 days if not set
            });
            message.success(`成功生成 ${values.count} 个邀请码`);
            setIsModalVisible(false);
            form.resetFields();
            fetchData();
        } catch (error) {
            console.error('Generate error:', error);
            message.error('生成邀请码失败');
        } finally {
            setGenerating(false);
        }
    };

    const handleDisable = async (code: string) => {
        try {
            await axios.put(`/invite-codes/disable/${code}`);
            message.success('邀请码已禁用');
            fetchData();
        } catch (error) {
            console.error('Disable error:', error);
            message.error('禁用失败');
        }
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        message.success('已复制到剪贴板');
    };

    const columns = [
        {
            title: '邀请码',
            dataIndex: 'code',
            key: 'code',
            render: (text: string) => (
                <Space>
                    <div className="font-mono text-lg font-medium text-gray-800 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200">
                        {text}
                    </div>
                    <Button type="text" icon={<CopyOutlined />} onClick={() => copyCode(text)} />
                </Space>
            ),
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => {
                const colors: Record<string, string> = {
                    general: 'blue',
                    vip: 'gold',
                    special: 'purple',
                    limited: 'red',
                };
                const labels: Record<string, string> = {
                    general: '普通',
                    vip: 'VIP',
                    special: '特殊',
                    limited: '限量',
                };
                return <Tag color={colors[type] || 'default'}>{labels[type] || type}</Tag>;
            },
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                let dotClass = 'bg-gray-400';
                let text = '未知';
                switch (status) {
                    case 'active': dotClass = 'bg-green-500'; text = '有效'; break;
                    case 'used': dotClass = 'bg-blue-500'; text = '已用完'; break;
                    case 'expired': dotClass = 'bg-amber-500'; text = '已过期'; break;
                    case 'disabled': dotClass = 'bg-red-500'; text = '已禁用'; break;
                }
                return (
                    <div className="flex items-center">
                        <span className={`status-dot ${dotClass}`}></span>
                        <span className="text-gray-600">{text}</span>
                    </div>
                );
            }
        },
        {
            title: '使用进度',
            key: 'usage',
            render: (_: any, record: InviteCode) => {
                const percent = Math.min((record.used_count / record.max_uses) * 100, 100);
                return (
                    <div className="w-24">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{record.used_count} / {record.max_uses}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                        </div>
                    </div>
                );
            },
        },
        {
            title: '过期时间',
            dataIndex: 'expires_at',
            key: 'expires_at',
            render: (text: string) => text ? <span className="text-gray-500 text-sm">{dayjs(text).format('YYYY-MM-DD')}</span> : <Tag>永久</Tag>,
        },
        {
            title: '描述',
            dataIndex: 'batch_name',
            key: 'batch_name',
            render: (text: string, record: InviteCode) => (
                <div className="flex flex-col">
                    {text && <span className="font-medium text-gray-700">{text}</span>}
                    {record.description && <span className="text-xs text-gray-400">{record.description}</span>}
                </div>
            )
        },
        {
            title: '',
            key: 'action',
            width: 80,
            render: (_: any, record: InviteCode) => (
                record.status === 'active' && (
                    <Button type="text" danger size="small" onClick={() => handleDisable(record.code)}>
                        禁用
                    </Button>
                )
            ),
        },
    ];

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto animate-fade-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gradient mb-2">邀请码管理</h1>
                    <p className="text-gray-500">管理系统的邀请码分发、监控使用情况及控制访问权限。</p>
                </div>
                <Space size="middle">
                    <Button size="large" className="rounded-full" icon={<ReloadOutlined />} onClick={fetchData}>
                        刷新
                    </Button>
                    <Button type="primary" size="large" className="rounded-full shadow-lg shadow-blue-500/30" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
                        生成邀请码
                    </Button>
                </Space>
            </div>

            <div className="glass-card-strong p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-6">
                    <div className="p-4 rounded-2xl bg-white/50 border border-white/60 shadow-sm">
                        <div className="text-gray-500 text-sm mb-1">总邀请码</div>
                        <div className="text-3xl font-semibold text-gray-800">{total}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/50 border border-white/60 shadow-sm">
                        <div className="text-gray-500 text-sm mb-1">有效 (Active)</div>
                        <div className="text-3xl font-semibold text-green-600">
                            {data.filter(i => i.status === 'active').length}
                        </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/50 border border-white/60 shadow-sm">
                        <div className="text-gray-500 text-sm mb-1">已用完 (Used)</div>
                        <div className="text-3xl font-semibold text-blue-600">
                            {data.filter(i => i.status === 'used').length}
                        </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/50 border border-white/60 shadow-sm">
                        <div className="text-gray-500 text-sm mb-1">本页数量</div>
                        <div className="text-3xl font-semibold text-gray-800">{data.length}</div>
                    </div>
                </div>

                <Table
                    columns={columns}
                    dataSource={data}
                    rowKey="id"
                    pagination={{
                        current: page,
                        pageSize: pageSize,
                        total,
                        onChange: (p, ps) => {
                            setPage(p);
                            setPageSize(ps);
                        },
                        showSizeChanger: true,
                    }}
                    loading={loading}
                    className="bg-transparent"
                />
            </div>

            <Modal
                title={<span className="text-lg font-bold">生成邀请码</span>}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={null}
                width={500}
                styles={{ content: { borderRadius: 24, padding: 24 } }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleGenerate}
                    initialValues={{
                        count: 1,
                        type: 'general',
                        maxUses: 1,
                        validDays: 30,
                    }}
                    className="mt-4"
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="count" label="生成数量" rules={[{ required: true }]}>
                                <InputNumber min={1} max={100} className="w-full" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                                <Select>
                                    <Option value="general">普通</Option>
                                    <Option value="vip">VIP</Option>
                                    <Option value="special">特殊</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="maxUses" label="最大使用次数" rules={[{ required: true }]}>
                                <InputNumber min={1} max={1000} className="w-full" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="validDays" label="有效期 (天)" rules={[{ required: true }]}>
                                <InputNumber min={1} max={365} className="w-full" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="batchName" label="批次名称">
                        <Input placeholder="营销活动 A" />
                    </Form.Item>

                    <Form.Item name="description" label="备注">
                        <Input.TextArea rows={2} placeholder="备注信息..." />
                    </Form.Item>

                    <Form.Item className="mb-0 pt-4">
                        <Button type="primary" htmlType="submit" loading={generating} block size="large" className="rounded-xl h-12 text-base font-semibold shadow-lg shadow-blue-500/20">
                            立即生成
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
