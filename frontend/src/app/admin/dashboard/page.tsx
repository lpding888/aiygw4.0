'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Tag, Space, Button, message } from 'antd';
import {
  UserOutlined,
  RocketOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import api from '@/lib/api';
import RevenueTrendChart from './components/RevenueTrendChart';
import UserGrowthChart from './components/UserGrowthChart';
import TaskDistributionChart from './components/TaskDistributionChart';

interface DashboardStats {
  userStats: {
    totalUsers: number;
    memberUsers: number;
    memberRate: string;
  };
  taskStats: {
    totalTasks: number;
    successTasks: number;
    processingTasks: number;
    successRate: string;
  };
  orderStats: {
    totalOrders: number;
    revenue: number;
  };
  todayStats: {
    newUsers: number;
    newTasks: number;
  };
}

const DEFAULT_STATS: DashboardStats = {
  userStats: { totalUsers: 0, memberUsers: 0, memberRate: '0%' },
  taskStats: { totalTasks: 0, successTasks: 0, processingTasks: 0, successRate: '0%' },
  orderStats: { totalOrders: 0, revenue: 0 },
  todayStats: { newUsers: 0, newTasks: 0 }
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getOverview();
      if (res.data.success) {
        setStats(res.data.data);
      } else {
        message.warning('无法获取最新数据，显示默认值');
      }
    } catch (error) {
      console.error('获取统计数据失败', error);
      message.error('网络连接失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats.userStats.totalUsers) { // Only show full spinner on initial load
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" tip="系统数据加载中..." />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto animate-fade-up">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gradient mb-2">👋 欢迎回来，管理员</h1>
          <p className="text-gray-500 text-lg">这里是您的 AI 工厂控制台，数据概览一目了然。</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchStats} loading={loading}>刷新数据</Button>
      </div>

      {/* 核心指标卡片 (Key Metrics) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* User Stats */}
        <div className="glass-card-strong p-6 relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
              <UserOutlined className="text-xl" />
            </div>
            <Tag color="geekblue" className="border-0 bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
              今日 +{stats.todayStats.newUsers}
            </Tag>
          </div>
          <div className="text-gray-500 text-sm font-medium mb-1">总用户数</div>
          <div className="text-3xl font-bold text-gray-800 mb-2">{stats.userStats.totalUsers}</div>
          <div className="text-xs text-gray-400">会员占比: {stats.userStats.memberRate}</div>
        </div>

        {/* Task Stats */}
        <div className="glass-card-strong p-6 relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-50 rounded-2xl text-green-600">
              <RocketOutlined className="text-xl" />
            </div>
            <Tag color="success" className="border-0 bg-green-50 text-green-600 px-3 py-1 rounded-full">
              今日 +{stats.todayStats.newTasks}
            </Tag>
          </div>
          <div className="text-gray-500 text-sm font-medium mb-1">总任务数</div>
          <div className="text-3xl font-bold text-gray-800 mb-2">{stats.taskStats.totalTasks}</div>
          <div className="text-xs text-gray-400">成功率: {stats.taskStats.successRate}</div>
        </div>

        {/* Revenue Stats */}
        <div className="glass-card-strong p-6 relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
              <DollarOutlined className="text-xl" />
            </div>
          </div>
          <div className="text-gray-500 text-sm font-medium mb-1">总收入</div>
          <div className="text-3xl font-bold text-gray-800 mb-2">¥ {stats.orderStats.revenue.toFixed(2)}</div>
          <div className="text-xs text-gray-400">总订单: {stats.orderStats.totalOrders}</div>
        </div>

        {/* Processing Stats */}
        <div className="glass-card-strong p-6 relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-50 rounded-2xl text-red-600">
              <ThunderboltOutlined className="text-xl" />
            </div>
            {(stats.taskStats.processingTasks) > 0 && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </div>
          <div className="text-gray-500 text-sm font-medium mb-1">正在处理任务</div>
          <div className="text-3xl font-bold text-gray-800 mb-2">{stats.taskStats.processingTasks}</div>
          <div className="text-xs text-gray-400">实时算力负载监控中</div>
        </div>
      </div>

      {/* 图表展示区 (Charts) */}
      <Row gutter={[24, 24]} className="mb-8">
        <Col xs={24} lg={16}>
          <RevenueTrendChart />
        </Col>
        <Col xs={24} lg={8}>
          <TaskDistributionChart />
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <UserGrowthChart />
        </Col>
        <Col xs={24} lg={12}>
          <div className="glass-card-strong p-6 h-full flex flex-col">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <RocketOutlined /> 快捷操作 & 系统状态
            </h3>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div
                className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer transition-all group"
                onClick={() => window.location.href = '/admin/pipelines/editor'}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100/50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <RocketOutlined />
                  </div>
                  <span className="font-semibold text-gray-700">新建工作流</span>
                </div>
              </div>

              <div
                className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-purple-200 hover:bg-purple-50/30 cursor-pointer transition-all group"
                onClick={() => window.location.href = '/admin/features/new'}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100/50 rounded-lg text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <ThunderboltOutlined />
                  </div>
                  <span className="font-semibold text-gray-700">上架应用</span>
                </div>
              </div>
            </div>

            {/* System Health Compact */}
            <div className="flex-1 space-y-3">
              {[
                { title: 'API 服务', status: 'success' },
                { title: 'Redis Cache', status: 'success' },
                { title: 'PostgreSQL DB', status: 'success' },
              ].map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <CheckCircleOutlined className="text-green-500" />
                    <span className="font-medium text-gray-700">{item.title}</span>
                  </div>
                  <Tag color="success">Running</Tag>
                </div>
              ))}
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
}