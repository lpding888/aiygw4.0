'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  Button,
  Typography,
  Space,
  Spin,
  Tag,
  Row,
  Col,
  Image as AntImage,
  message,
  Divider
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';

const { Title, Text, Paragraph } = Typography;

interface TaskDetail {
  id: string;
  type: string;
  status: string;
  inputImageUrl: string;
  resultUrls: string[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params?.taskId as string;

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [polling, setPolling] = useState(false);

  // 获取任务详情
  const fetchTaskDetail = async () => {
    try {
      setLoading(true);
      const response: any = await api.task.get(taskId);

      if (response.success && response.data) {
        setTask(response.data);

        // 如果任务还在处理中,开始轮询
        if (response.data.status === 'processing' || response.data.status === 'pending') {
          setPolling(true);
        }
      } else {
        message.error('获取任务详情失败');
      }
    } catch (error: any) {
      message.error(error.message || '获取任务详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchTaskDetail();
    }
  }, [taskId]);

  // 轮询任务状态
  useEffect(() => {
    if (!polling) return;

    const timer = setInterval(async () => {
      try {
        const response: any = await api.task.get(taskId);

        if (response.success && response.data) {
          setTask(response.data);

          if (response.data.status === 'success') {
            setPolling(false);
            message.success('处理完成!');
          } else if (response.data.status === 'failed') {
            setPolling(false);
            message.error('处理失败');
          }
        }
      } catch (error) {
        console.error('轮询失败', error);
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [polling, taskId]);

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; icon: any; text: string }> = {
      pending: { color: 'default', icon: <ClockCircleOutlined />, text: '等待处理' },
      processing: { color: 'processing', icon: <SyncOutlined spin />, text: '处理中' },
      success: { color: 'success', icon: <CheckCircleOutlined />, text: '处理成功' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '处理失败' }
    };

    const config = statusMap[status] || statusMap.pending;

    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 下载图片
  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `result_${index + 1}.png`;
    link.click();
    message.success('开始下载');
  };

  // 下载全部
  const handleDownloadAll = () => {
    if (!task || !task.resultUrls.length) return;

    task.resultUrls.forEach((url, index) => {
      setTimeout(() => {
        handleDownload(url, index);
      }, index * 500);
    });
  };

  // 重试任务
  const handleRetry = async () => {
    if (!task) return;

    try {
      const response: any = await api.task.create({
        type: task.type,
        inputImageUrl: task.inputImageUrl,
        params: {}
      });

      if (response.success && response.data) {
        message.success('新任务已创建');
        router.push(`/task/${response.data.taskId}`);
      }
    } catch (error: any) {
      message.error(error.message || '重试失败');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <Card>
          <Paragraph>任务不存在或已被删除</Paragraph>
          <Button onClick={() => router.push('/workspace')}>
            返回工作台
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f2f5',
      padding: '24px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* 顶部导航 */}
        <div style={{ marginBottom: '24px' }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/workspace')}
          >
            返回工作台
          </Button>
        </div>

        {/* 任务信息 */}
        <Card style={{ marginBottom: '24px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={3} style={{ margin: 0 }}>
                任务详情
              </Title>
              {getStatusTag(task.status)}
            </div>

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text type="secondary">任务ID:</Text>
                <br />
                <Text copyable>{task.id}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">任务类型:</Text>
                <br />
                <Tag color="blue">
                  {task.type === 'basic_clean' ? '基础修图' : 'AI模特上身'}
                </Tag>
              </Col>
              <Col span={12}>
                <Text type="secondary">创建时间:</Text>
                <br />
                <Text>{new Date(task.createdAt).toLocaleString('zh-CN')}</Text>
              </Col>
              {task.completedAt && (
                <Col span={12}>
                  <Text type="secondary">完成时间:</Text>
                  <br />
                  <Text>{new Date(task.completedAt).toLocaleString('zh-CN')}</Text>
                </Col>
              )}
            </Row>

            {task.errorMessage && (
              <div style={{
                padding: '12px',
                background: '#fff2e8',
                border: '1px solid #ffbb96',
                borderRadius: '4px'
              }}>
                <Text type="danger">错误信息: {task.errorMessage}</Text>
              </div>
            )}
          </Space>
        </Card>

        {/* 原图 */}
        <Card title="原图" style={{ marginBottom: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <AntImage
              src={task.inputImageUrl}
              alt="原图"
              style={{ maxWidth: '100%', maxHeight: '400px' }}
            />
          </div>
        </Card>

        {/* 处理结果 */}
        {task.status === 'success' && task.resultUrls.length > 0 && (
          <Card
            title="处理结果"
            extra={
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadAll}
              >
                下载全部
              </Button>
            }
          >
            <Row gutter={[16, 16]}>
              {task.resultUrls.map((url, index) => (
                <Col xs={24} sm={12} md={8} key={index}>
                  <Card
                    hoverable
                    cover={
                      <div style={{ padding: '16px', textAlign: 'center', background: '#fafafa' }}>
                        <AntImage
                          src={url}
                          alt={`结果${index + 1}`}
                          style={{ maxWidth: '100%', maxHeight: '300px' }}
                        />
                      </div>
                    }
                  >
                    <Card.Meta
                      title={`结果 ${index + 1}`}
                      description={
                        <Button
                          type="link"
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownload(url, index)}
                          style={{ padding: 0 }}
                        >
                          下载图片
                        </Button>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {/* 处理中提示 */}
        {(task.status === 'processing' || task.status === 'pending') && (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Spin size="large" />
              <Title level={4} style={{ marginTop: '24px' }}>
                AI正在处理您的图片...
              </Title>
              <Paragraph type="secondary">
                {task.type === 'basic_clean' ? '预计需要5-10秒' : '预计需要2-3分钟'}
              </Paragraph>
            </div>
          </Card>
        )}

        {/* 失败操作 */}
        {task.status === 'failed' && (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <CloseCircleOutlined style={{ fontSize: '64px', color: '#ff4d4f' }} />
              <Title level={4} style={{ marginTop: '16px' }}>
                处理失败
              </Title>
              <Paragraph type="secondary">
                {task.errorMessage || '图片处理失败,配额已自动返还'}
              </Paragraph>
              <Space style={{ marginTop: '24px' }}>
                <Button onClick={() => router.push('/workspace')}>
                  返回工作台
                </Button>
                <Button type="primary" onClick={handleRetry}>
                  重新处理
                </Button>
              </Space>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
