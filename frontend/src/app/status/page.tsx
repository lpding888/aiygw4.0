'use client';

/**
 * 系统状态页面
 * 艹！这个页面展示系统健康状态和SLA指标！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Badge,
  Typography,
  Timeline,
  Progress,
  Alert,
  Space,
  Tag,
  Divider,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

/**
 * 服务状态
 */
type ServiceStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage';

/**
 * 服务
 */
interface Service {
  name: string;
  status: ServiceStatus;
  uptime: number; // 可用性百分比
  responseTime: number; // 响应时间（毫秒）
}

/**
 * 事件
 */
interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  created_at: string;
  resolved_at?: string;
  updates: Array<{
    time: string;
    message: string;
  }>;
}

/**
 * 状态配置
 */
const STATUS_CONFIG: Record<ServiceStatus, { label: string; color: string; badge: any }> = {
  operational: { label: '正常运行', color: '#52c41a', badge: 'success' },
  degraded: { label: '性能下降', color: '#faad14', badge: 'warning' },
  partial_outage: { label: '部分故障', color: '#ff7a45', badge: 'error' },
  major_outage: { label: '严重故障', color: '#ff4d4f', badge: 'error' },
};

/**
 * 系统状态页面
 */
export default function StatusPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [overallStatus, setOverallStatus] = useState<ServiceStatus>('operational');
  const [loading, setLoading] = useState(true);

  /**
   * 加载状态数据
   */
  const loadStatus = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/status');
      if (!response.ok) throw new Error('获取状态失败');

      const data = await response.json();
      setServices(data.services || []);
      setIncidents(data.incidents || []);
      setOverallStatus(data.overall_status || 'operational');
    } catch (error) {
      console.error('[Status] 获取失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // 每30秒刷新一次
    const timer = setInterval(loadStatus, 30000);
    return () => clearInterval(timer);
  }, []);

  /**
   * 整体状态配置
   */
  const overallConfig = STATUS_CONFIG[overallStatus];

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <Title level={2} style={{ margin: 0 }}>
          系统状态
        </Title>
        <Paragraph type="secondary">
          实时监控系统健康状况和可用性
        </Paragraph>
      </div>

      {/* 整体状态 */}
      <Card style={{ marginBottom: 24, textAlign: 'center' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            {overallStatus === 'operational' ? (
              <CheckCircleOutlined style={{ fontSize: 64, color: overallConfig.color }} />
            ) : (
              <WarningOutlined style={{ fontSize: 64, color: overallConfig.color }} />
            )}
          </div>

          <div>
            <Title level={3} style={{ margin: 0, color: overallConfig.color }}>
              {overallConfig.label}
            </Title>
            <Text type="secondary">
              最后更新: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </div>
        </Space>
      </Card>

      {/* 当前事件 */}
      {incidents.filter((i) => i.status !== 'resolved').length > 0 && (
        <Alert
          message="当前事件"
          description={
            <div>
              {incidents
                .filter((i) => i.status !== 'resolved')
                .map((incident) => (
                  <div key={incident.id} style={{ marginBottom: 8 }}>
                    <Tag color={incident.severity === 'critical' ? 'red' : incident.severity === 'major' ? 'orange' : 'blue'}>
                      {incident.severity}
                    </Tag>
                    <Text strong>{incident.title}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      - {incident.updates[0]?.message}
                    </Text>
                  </div>
                ))}
            </div>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 服务状态 */}
      <Card title="服务状态" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {services.map((service) => {
            const config = STATUS_CONFIG[service.status];
            return (
              <Col xs={24} sm={12} md={8} key={service.name}>
                <Card size="small">
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong>{service.name}</Text>
                      <Badge status={config.badge as any} text={config.label} />
                    </div>

                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        可用性
                      </Text>
                      <Progress
                        percent={service.uptime}
                        strokeColor={config.color}
                        format={(percent) => `${percent}%`}
                        size="small"
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        响应时间
                      </Text>
                      <Text strong style={{ fontSize: 12 }}>
                        {service.responseTime}ms
                      </Text>
                    </div>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* SLA指标 */}
      <Card title="SLA指标（本月）" style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Text type="secondary">整体可用性</Text>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#52c41a', marginTop: 8 }}>
                99.95%
              </div>
              <Progress percent={99.95} strokeColor="#52c41a" showInfo={false} size="small" />
              <Text type="secondary" style={{ fontSize: 12 }}>
                目标: 99.9%
              </Text>
            </div>
          </Col>

          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Text type="secondary">平均响应时间</Text>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1890ff', marginTop: 8 }}>
                156ms
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                目标: &lt; 200ms
              </Text>
            </div>
          </Col>

          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Text type="secondary">故障恢复时间</Text>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#722ed1', marginTop: 8 }}>
                15min
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                目标: &lt; 30min
              </Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 事件历史 */}
      <Card title="事件历史">
        {incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
            <div>
              <Text type="secondary">过去30天没有发生故障</Text>
            </div>
          </div>
        ) : (
          <Timeline>
            {incidents.map((incident) => (
              <Timeline.Item
                key={incident.id}
                color={incident.status === 'resolved' ? 'green' : 'red'}
                dot={
                  incident.status === 'resolved' ? (
                    <CheckCircleOutlined />
                  ) : (
                    <ClockCircleOutlined />
                  )
                }
              >
                <div>
                  <Space>
                    <Tag color={incident.severity === 'critical' ? 'red' : incident.severity === 'major' ? 'orange' : 'blue'}>
                      {incident.severity}
                    </Tag>
                    <Text strong>{incident.title}</Text>
                    {incident.status === 'resolved' && (
                      <Tag color="success">已解决</Tag>
                    )}
                  </Space>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(incident.created_at).format('YYYY-MM-DD HH:mm:ss')}
                      {incident.resolved_at && (
                        <> - {dayjs(incident.resolved_at).format('YYYY-MM-DD HH:mm:ss')}</>
                      )}
                    </Text>
                  </div>
                  {incident.updates.map((update, index) => (
                    <div key={index} style={{ marginTop: 8, paddingLeft: 16, borderLeft: '2px solid #f0f0f0' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {update.time}
                      </Text>
                      <div>
                        <Text>{update.message}</Text>
                      </div>
                    </div>
                  ))}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Card>

      {/* 页脚 */}
      <div style={{ textAlign: 'center', marginTop: 48, paddingTop: 24, borderTop: '1px solid #f0f0f0' }}>
        <Text type="secondary">
          如有问题，请联系: support@example.com
        </Text>
      </div>
    </div>
  );
}
