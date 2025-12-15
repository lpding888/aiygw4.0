'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, message, Tabs, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';

export default function CMSPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.cms.listTexts({ limit: 100 });
            if (res.success) {
                // Backend might return { list: [], total: 0 } or just [] or { data: [] }
                // Need to adjust based on actual response structure. 
                // Assuming res.data.list or res.data
                const list = res.data?.list || (Array.isArray(res.data) ? res.data : []);
                setData(list);
            }
        } catch (error) {
            message.error('加载列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleEdit = (record: any) => {
        setEditingId(record.id);
        form.setFieldsValue(record);
        setModalVisible(true);
    };

    const handleCreate = () => {
        setEditingId(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await api.cms.deleteText(id);
            message.success('删除成功');
            fetchData();
        } catch (e) {
            message.error('删除失败');
        }
    };

    const handleSubmit = async (values: any) => {
        setSubmitting(true);
        try {
            if (editingId) {
                await api.cms.updateText(editingId, values);
                message.success('更新成功');
            } else {
                await api.cms.createText(values);
                message.success('创建成功');
            }
            setModalVisible(false);
            fetchData();
        } catch (error: any) {
            message.error(error.message || '操作失败');
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        { title: '模块 (Module)', dataIndex: 'module', key: 'module', width: 120 },
        { title: '键 (Key)', dataIndex: 'key', key: 'key', width: 150 },
        {
            title: '内容 (Value)',
            dataIndex: 'value',
            key: 'value',
            ellipsis: true,
            render: (text: string) => <span title={text}>{text}</span>
        },
        { title: '描述', dataIndex: 'description', key: 'description' },
        {
            title: '操作',
            key: 'action',
            width: 150,
            render: (_: any, record: any) => (
                <Space>
                    <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
                    <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
                        <Button icon={<DeleteOutlined />} size="small" danger />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card title="CMS 内容配置" extra={
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>添加配置</Button>
                </Space>
            }>
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={data}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal
                title={editingId ? "编辑配置" : "添加配置"}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={form.submit}
                confirmLoading={submitting}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="module" label="模块" rules={[{ required: true }]}>
                        <Input placeholder="例如: login, home" disabled={!!editingId} />
                    </Form.Item>
                    <Form.Item name="key" label="键名" rules={[{ required: true }]}>
                        <Input placeholder="例如: welcome_title" disabled={!!editingId} />
                    </Form.Item>
                    <Form.Item name="value" label="内容" rules={[{ required: true }]}>
                        <Input.TextArea rows={4} />
                    </Form.Item>
                    <Form.Item name="description" label="描述">
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
