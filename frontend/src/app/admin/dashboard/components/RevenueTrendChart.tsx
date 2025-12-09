'use client';

import React from 'react';
import { Card, Select, Typography } from 'antd';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

const { Title } = Typography;

// Mock Data for 7 Days Trend
const data = [
    { name: '周一', value: 4000 },
    { name: '周二', value: 3000 },
    { name: '周三', value: 2000 },
    { name: '周四', value: 2780 },
    { name: '周五', value: 1890 },
    { name: '周六', value: 2390 },
    { name: '周日', value: 3490 },
];

export default function RevenueTrendChart() {
    return (
        <Card
            className="glass-card-strong h-full shadow-sm hover:shadow-md transition-shadow"
            bordered={false}
            style={{ borderRadius: 16 }}
        >
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Title level={5} style={{ margin: 0 }}>收入趋势</Title>
                    <span className="text-gray-400 text-xs">近 7 天营收统计</span>
                </div>
                <Select defaultValue="7days" size="small" variant="borderless" className="bg-gray-50 rounded-lg">
                    <Select.Option value="7days">近7天</Select.Option>
                    <Select.Option value="30days">近30天</Select.Option>
                </Select>
            </div>

            <div style={{ height: 300, width: '100%', marginLeft: -20 }}>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1890ff" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                            </linearGradient>
                        </defs>
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
                            tickFormatter={(value) => `¥${value}`}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#1890ff"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorRevenue)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
