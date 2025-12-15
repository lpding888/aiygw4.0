'use client';

import React from 'react';
import { Card, Typography } from 'antd';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

const { Title } = Typography;

const data = [
    { name: '成功', value: 400 },
    { name: '失败', value: 30 },
    { name: '处理中', value: 50 },
    { name: '取消', value: 20 },
];

const COLORS = ['#52c41a', '#ff4d4f', '#1890ff', '#d9d9d9'];

export default function TaskDistributionChart() {
    return (
        <Card
            className="glass-card-strong h-full shadow-sm hover:shadow-md transition-shadow"
            bordered={false}
            style={{ borderRadius: 16 }}
        >
            <div className="flex justify-between items-center mb-2">
                <div>
                    <Title level={5} style={{ margin: 0 }}>任务分布</Title>
                    <span className="text-gray-400 text-xs">任务执行状态统计</span>
                </div>
            </div>

            <div style={{ height: 300, width: '100%' }}>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend
                            layout="vertical"
                            verticalAlign="middle"
                            align="right"
                            wrapperStyle={{ paddingLeft: 20 }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
