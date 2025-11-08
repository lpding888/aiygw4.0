'use client';

/**
 * RUM（Real User Monitoring）仪表盘
 * 艹！页面性能一目了然，首屏/LCP/错误率全都有！
 *
 * @author 老王
 */

import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Select, DatePicker, Space, Table, Tabs, Empty } from 'antd';
import {
  ThunderboltOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  EyeOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ColumnType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { pagePerformanceMonitor, PagePerformanceAggregation } from '@/lib/monitoring/page-performance';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

/**
 * 关键页面列表
 */
const KEY_PAGES = [
  { value: '/workspace/chat', label: '聊天页面' },
  { value: '/workspace/studio', label: 'Studio工作室' },
  { value: '/workspace/lookbook', label: 'Lookbook' },
  { value: '/workspace/templates', label: '模板中心' },
  { value: '/admin/providers', label: 'Provider管理' },
];

export default function RUMDashboardPage() {
  // 选中的页面
  const [selectedPage, setSelectedPage] = useState('/workspace/chat');

  // 日期范围（默认最近7天）
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'days'),
    dayjs(),
  ]);

  // 聚合数据
  const [aggregation, setAggregation] = useState<PagePerformanceAggregation | null>(null);

  // 趋势数据（模拟）
  const [trendData, setTrendData] = useState<any[]>([]);

  /**
   * 加载聚合数据
   */
  const loadAggregation = () => {
    const startDate = dateRange[0].toISOString();
    const endDate = dateRange[1].toISOString();

    const data = pagePerformanceMonitor.calculateAggregation(selectedPage, startDate, endDate);
    setAggregation(data);

    // 生成趋势数据（模拟最近7天数据）
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const date = dayjs().subtract(i, 'days');
      trend.push({
        date: date.format('MM/DD'),
        lcp: 2000 + Math.random() * 1000,
        fcp: 1200 + Math.random() * 600,
        ttfb: 500 + Math.random() * 300,
        error_rate: Math.random() * 5,
      });
    }
    setTrendData(trend);
  };

  useEffect(() => {
    loadAggregation();
  }, [selectedPage, dateRange]);

  // 指标卡片
  const metricCards = aggregation
    ? [
        {
          title: 'LCP P95',
          value: aggregation.metrics.lcp.p95,
          suffix: 'ms',
          icon: <ThunderboltOutlined />,
          color: aggregation.metrics.lcp.p95 <= 2500 ? '#3f8600' : '#cf1322',
          description: '最大内容绘制（95分位）',
        },
        {
          title: 'FCP P95',
          value: aggregation.metrics.fcp.p95,
          suffix: 'ms',
          icon: <ClockCircleOutlined />,
          color: aggregation.metrics.fcp.p95 <= 1800 ? '#3f8600' : '#cf1322',
          description: '首次内容绘制（95分位）',
        },
        {
          title: '错误率',
          value: (aggregation.error_rate * 100).toFixed(2),
          suffix: '%',
          icon: <WarningOutlined />,
          color: aggregation.error_rate < 0.01 ? '#3f8600' : '#cf1322',
          description: '页面错误发生率',
        },
        {
          title: 'PV',
          value: aggregation.pv_count,
          suffix: '',
          icon: <EyeOutlined />,
          color: '#1890ff',
          description: '页面浏览量',
        },
        {
          title: 'UV',
          value: aggregation.uv_count,
          suffix: '',
          icon: <UserOutlined />,
          color: '#722ed1',
          description: '独立访客数',
        },
      ]
    : [];

  // 详细指标表格列
  const detailColumns: ColumnType<any>[] = [
    {
      title: '指标名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: 'P50（中位数）',
      dataIndex: 'p50',
      key: 'p50',
      width: 150,
      render: (val: number, record: any) =>
        record.unit === 'ms' ? `${val.toFixed(0)}ms` : val.toFixed(3),
    },
    {
      title: 'P95',
      dataIndex: 'p95',
      key: 'p95',
      width: 150,
      render: (val: number, record: any) => {
        const formatted = record.unit === 'ms' ? `${val.toFixed(0)}ms` : val.toFixed(3);
        const color = val <= record.goodThreshold ? '#3f8600' : '#cf1322';
        return <span style={{ color, fontWeight: 600 }}>{formatted}</span>;
      },
    },
    {
      title: 'P99',
      dataIndex: 'p99',
      key: 'p99',
      width: 150,
      render: (val: number, record: any) =>
        record.unit === 'ms' ? `${val.toFixed(0)}ms` : val.toFixed(3),
    },
    {
      title: '样本数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
    },
    {
      title: '评级',
      key: 'rating',
      width: 100,
      render: (_: any, record: any) => {
        if (record.p95 <= record.goodThreshold) {
          return <span style={{ color: '#3f8600' }}>✓ 良好</span>;
        } else if (record.p95 <= record.poorThreshold) {
          return <span style={{ color: '#faad14' }}>⚠ 需改进</span>;
        } else {
          return <span style={{ color: '#cf1322' }}>✗ 较差</span>;
        }
      },
    },
  ];

  // 详细指标数据
  const detailData = aggregation
    ? [
        {
          key: 'lcp',
          name: 'LCP - 最大内容绘制',
          ...aggregation.metrics.lcp,
          unit: 'ms',
          goodThreshold: 2500,
          poorThreshold: 4000,
        },
        {
          key: 'fcp',
          name: 'FCP - 首次内容绘制',
          ...aggregation.metrics.fcp,
          unit: 'ms',
          goodThreshold: 1800,
          poorThreshold: 3000,
        },
        {
          key: 'ttfb',
          name: 'TTFB - 首字节时间',
          ...aggregation.metrics.ttfb,
          unit: 'ms',
          goodThreshold: 800,
          poorThreshold: 1800,
        },
        {
          key: 'fid',
          name: 'FID - 首次输入延迟',
          ...aggregation.metrics.fid,
          unit: 'ms',
          goodThreshold: 100,
          poorThreshold: 300,
        },
        {
          key: 'cls',
          name: 'CLS - 累积布局偏移',
          ...aggregation.metrics.cls,
          unit: 'score',
          goodThreshold: 0.1,
          poorThreshold: 0.25,
        },
      ]
    : [];

  return (
    <div style={{ padding: '24px' }}>
      {/* 标题和筛选栏 */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>RUM 性能监控仪表盘</h2>
        <Space>
          <Select
            value={selectedPage}
            onChange={setSelectedPage}
            style={{ width: 200 }}
            options={KEY_PAGES}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
            format="YYYY-MM-DD"
            allowClear={false}
          />
        </Space>
      </div>

      {/* 关键指标卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {metricCards.map((card, index) => (
          <Col span={4.8} key={index}>
            <Card>
              <Statistic
                title={card.title}
                value={card.value}
                suffix={card.suffix}
                prefix={card.icon}
                valueStyle={{ color: card.color }}
              />
              <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>{card.description}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabs */}
      <Tabs defaultActiveKey="trend">
        {/* 趋势图 */}
        <TabPane tab="性能趋势" key="trend">
          <Card title="近7天性能趋势">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" label={{ value: '时间 (ms)', angle: -90, position: 'insideLeft' }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    label={{ value: '错误率 (%)', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="lcp"
                    stroke="#8884d8"
                    name="LCP"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="fcp"
                    stroke="#82ca9d"
                    name="FCP"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="ttfb"
                    stroke="#ffc658"
                    name="TTFB"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="error_rate"
                    stroke="#ff7c7c"
                    name="错误率"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无趋势数据" />
            )}
          </Card>
        </TabPane>

        {/* 详细指标 */}
        <TabPane tab="详细指标" key="detail">
          <Card title="Web Vitals 指标详情">
            <Table
              columns={detailColumns}
              dataSource={detailData}
              pagination={false}
              size="middle"
            />
            <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
              <h4 style={{ marginTop: 0 }}>指标说明</h4>
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li><strong>LCP (Largest Contentful Paint)</strong>: 最大内容绘制，衡量页面主要内容加载速度</li>
                <li><strong>FCP (First Contentful Paint)</strong>: 首次内容绘制，衡量页面首次显示内容的时间</li>
                <li><strong>TTFB (Time to First Byte)</strong>: 首字节时间，衡量服务器响应速度</li>
                <li><strong>FID (First Input Delay)</strong>: 首次输入延迟，衡量页面交互响应速度</li>
                <li><strong>CLS (Cumulative Layout Shift)</strong>: 累积布局偏移，衡量页面视觉稳定性</li>
              </ul>
            </div>
          </Card>
        </TabPane>

        {/* 阈值参考 */}
        <TabPane tab="阈值参考" key="threshold">
          <Card title="Web Vitals 阈值参考（Google推荐）">
            <Table
              dataSource={[
                {
                  key: 'lcp',
                  metric: 'LCP',
                  name: '最大内容绘制',
                  good: '≤ 2500ms',
                  needsImprovement: '2500ms - 4000ms',
                  poor: '> 4000ms',
                },
                {
                  key: 'fcp',
                  metric: 'FCP',
                  name: '首次内容绘制',
                  good: '≤ 1800ms',
                  needsImprovement: '1800ms - 3000ms',
                  poor: '> 3000ms',
                },
                {
                  key: 'ttfb',
                  metric: 'TTFB',
                  name: '首字节时间',
                  good: '≤ 800ms',
                  needsImprovement: '800ms - 1800ms',
                  poor: '> 1800ms',
                },
                {
                  key: 'fid',
                  metric: 'FID',
                  name: '首次输入延迟',
                  good: '≤ 100ms',
                  needsImprovement: '100ms - 300ms',
                  poor: '> 300ms',
                },
                {
                  key: 'cls',
                  metric: 'CLS',
                  name: '累积布局偏移',
                  good: '≤ 0.1',
                  needsImprovement: '0.1 - 0.25',
                  poor: '> 0.25',
                },
              ]}
              columns={[
                { title: '指标', dataIndex: 'metric', key: 'metric', width: 100 },
                { title: '名称', dataIndex: 'name', key: 'name', width: 200 },
                {
                  title: '良好',
                  dataIndex: 'good',
                  key: 'good',
                  width: 200,
                  render: (text) => <span style={{ color: '#3f8600' }}>{text}</span>,
                },
                {
                  title: '需改进',
                  dataIndex: 'needsImprovement',
                  key: 'needsImprovement',
                  width: 200,
                  render: (text) => <span style={{ color: '#faad14' }}>{text}</span>,
                },
                {
                  title: '较差',
                  dataIndex: 'poor',
                  key: 'poor',
                  width: 200,
                  render: (text) => <span style={{ color: '#cf1322' }}>{text}</span>,
                },
              ]}
              pagination={false}
            />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
}
