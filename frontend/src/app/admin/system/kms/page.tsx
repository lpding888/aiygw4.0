'use client';

import { useState, useEffect } from 'react';
import {
    Card,
    Table,
    Button,
    Space,
    Modal,
    Form,
    Input,
    message,
    Typography,
    Popconfirm,
} from 'antd';
import {
    KeyOutlined,
    ReloadOutlined,
    PlusOutlined,
    CopyOutlined,
} from '@ant-design/icons';
import axios from '@/lib/api';
import dayjs from 'dayjs';

const { Text } = Typography;

export default function KMSPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [creating, setCreating] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/kms');
            // Assume array response
            setData(Array.isArray(response.data.data) ? response.data.data : []);
        } catch (error) {
            console.error('Fetch error:', error);
            message.error('获取密钥列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = async (values: any) => {
        setCreating(true);
        try {
            await axios.post('/api/kms', values);
            message.success('创建成功');
            setIsModalVisible(false);
            form.resetFields();
            fetchData();
        } catch (error) {
            message.error('创建失败');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await axios.delete(`/api/kms/${id}`);
            message.success('密钥已删除');
            fetchData();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 100,
            render: (text: string) => <Text copyable={{ text }}>{text.substring(0, 8)}...</Text>
        },
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>,
        },
        {
            title: '用途',
            dataIndex: 'purpose', // Predicting field name based on standard KMS
            key: 'purpose',
            render: (text: string) => text || '通用加密',
        },
        {
            title: '创建时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="small">
                    <Popconfirm title="确定要删除此密钥吗？这可能导致加密数据无法解密！" onConfirm={() => handleDelete(record.id)} okType="danger">
                        <Button type="link" danger size="small">删除</Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto animate-fade-up">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gradient mb-2">密钥管理 (KMS)</h1>
                    <p className="text-gray-500">安全地管理和轮换系统加密密钥。</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        size="large"
                        icon={<ReloadOutlined spin={loading} />}
                        onClick={fetchData}
                        className="rounded-full"
                    >
                        刷新
                    </Button>
                    <Button
                        type="primary"
                        size="large"
                        icon={<PlusOutlined />}
                        onClick={() => setIsModalVisible(true)}
                        className="rounded-full shadow-lg"
                    >
                        创建新密钥
                    </Button>
                </div>
            </div>

            <div className="glass-card-strong p-6">
                <Table
                    columns={columns}
                    dataSource={data}
                    rowKey="id"
                    loading={loading}
                    className="bg-transparent"
                />
            </div>

            <Modal
                title={<span className="text-lg font-semibold">创建新密钥</span>}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={null}
                className="rounded-2xl overflow-hidden"
            >
                <Form
                    name="kms_form"
                    form={form}
                    layout="vertical"
                    onFinish={handleCreate}
                    className="mt-4"
                >
                    <Form.Item
                        name="name"
                        label="密钥名称"
                        rules={[{ required: true, message: '请输入名称' }]}
                    >
                        <Input placeholder="例如: UserDataEncryptionKey" size="large" className="rounded-lg" />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="描述"
                    >
                        <Input.TextArea rows={4} className="rounded-lg" />
                    </Form.Item>

                    <Form.Item>
                        <div className="flex justify-end gap-3 mt-4">
                            <Button size="large" onClick={() => setIsModalVisible(false)} className="rounded-lg">取消</Button>
                            <Button type="primary" htmlType="submit" loading={creating} size="large" className="rounded-lg">
                                创建密钥
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
