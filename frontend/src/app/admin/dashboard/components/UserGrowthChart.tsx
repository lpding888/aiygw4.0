'use client';

import React from 'react';
import { Card, Typography } from 'antd';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

const { Title } = Typography;

const data = [
    { name: '周一', newUsers: 40, activeUsers: 240 },
    { name: '周二', newUsers: 30, activeUsers: 139 },
    { name: '周三', newUsers: 20, activeUsers: 980 },
    { name: '周四', newUsers: 27, activeUsers: 390 },
    { name: '周五', newUsers: 18, activeUsers: 480 },
    { name: '周六', newUsers: 23, activeUsers: 380 },
    { name: '周日', newUsers: 34, activeUsers: 430 },
];

export default function UserGrowthChart() {
    return (
        <Card
            className="glass-card-strong h-full shadow-sm hover:shadow-md transition-shadow"
            bordered={false}
            style={{ borderRadius: 16 }}
        >
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Title level={5} style={{ margin: 0 }}>用户增长</Title>
                    <span className="text-gray-400 text-xs">新增 vs 活跃</span>
                </div>
            </div>

            <div style={{ height: 300, width: '100%', marginLeft: -20 }}>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#999', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#999', fontSize: 12 }}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: 20 }} />
                        <Bar dataKey="activeUsers" name="活跃用户" fill="#52c41a" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="newUsers" name="新增用户" fill="#1890ff" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
