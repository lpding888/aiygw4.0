'use client';

import React, { useState } from 'react';
import { Drawer, Avatar, Tabs, Descriptions, Tag, Timeline, List, Typography, Space, Button } from 'antd';
import {
    UserOutlined,
    ClockCircleOutlined,
    RocketOutlined,
    DollarOutlined,
    SafetyOutlined,
    EditOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface UserDetailDrawerProps {
    visible: boolean;
    onClose: () => void;
    user: any; // Using any for now, should be User type
}

export default function UserDetailDrawer({ visible, onClose, user }: UserDetailDrawerProps) {
    if (!user) return null;

    const getStatusColor = (status: string) => {
        return status === 'active' ? 'green' : 'red';
    };

    const TABS = [
        {
            key: 'overview',
            label: '概览',
            icon: <UserOutlined />,
            content: (
                <div className="space-y-6">
                    <Descriptions title="基础信息" bordered column={1} size="small">
                        <Descriptions.Item label="用户ID">{user.user_id}</Descriptions.Item>
                        <Descriptions.Item label="邮箱">{user.email || '-'}</Descriptions.Item>
                        <Descriptions.Item label="手机号">{user.phone || '-'}</Descriptions.Item>
                        <Descriptions.Item label="注册时间">{new Date(user.created_at).toLocaleString()}</Descriptions.Item>
                        <Descriptions.Item label="最后登录">2023-12-08 14:30 (上海)</Descriptions.Item>
                    </Descriptions>

                    <Descriptions title="会员权益" bordered column={1} size="small">
                        <Descriptions.Item label="当前等级">
                            <Tag color="purple">{user.membership_level || '免费用户'}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="到期时间">2024-12-31</Descriptions.Item>
                        <Descriptions.Item label="剩余配额">50 张 / 100 张</Descriptions.Item>
                    </Descriptions>
                </div>
            )
        },
        {
            key: 'activity',
            label: '生成历史',
            icon: <RocketOutlined />,
            content: (
                <List
                    itemLayout="horizontal"
                    dataSource={[
                        { title: 'AI 模特图生成 #1024', status: 'Success' },
                        { title: '背景替换 #1023', status: 'Failed' },
                        { title: '一键精修 #1022', status: 'Success' },
                    ]}
                    renderItem={(item) => (
                        <List.Item>
                            <List.Item.Meta
                                avatar={<Avatar style={{ backgroundColor: '#1890ff' }} icon={<RocketOutlined />} />}
                                title={item.title}
                                description={<Tag color={item.status === 'Success' ? 'success' : 'error'}>{item.status}</Tag>}
                            />
                        </List.Item>
                    )}
                />
            )
        }
    ];

    return (
        <Drawer
            title="用户 360° 视图"
            placement="right"
            onClose={onClose}
            open={visible}
            width={600}
            extra={
                <Space>
                    <Button icon={<EditOutlined />}>编辑备注</Button>
                </Space>
            }
        >
            <div className="flex flex-col items-center mb-8 pt-4">
                <Avatar src={user.avatar} size={80} icon={<UserOutlined />} className="mb-4 border-4 border-gray-100" />
                <Title level={3} style={{ margin: 0 }}>{user.nickname || user.username}</Title>
                <Text type="secondary" className="mb-2">@{user.username}</Text>
                <Space>
                    <Tag color={user.role === 'admin' ? 'gold' : 'blue'}>{user.role}</Tag>
                    <Tag color={getStatusColor(user.status)}>{user.status === 'active' ? '状态正常' : '已封禁'}</Tag>
                </Space>
            </div>

            <Tabs
                defaultActiveKey="overview"
                items={TABS.map(tab => ({
                    key: tab.key,
                    label: (
                        <span>
                            {tab.icon}
                            {tab.label}
                        </span>
                    ),
                    children: tab.content
                }))}
            />
        </Drawer>
    );
}
