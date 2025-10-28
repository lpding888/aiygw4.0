'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Button,
  Typography,
  Space,
  Radio,
  message,
  Steps,
  Image as AntImage,
  Spin
} from 'antd';
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import ImageUploader from '@/components/ImageUploader';
import { api } from '@/lib/api';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

export default function BasicCleanPage() {
  const router = useRouter();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [taskId, setTaskId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');

  // 处理上传成功
  const handleUploadSuccess = (url: string) => {
    setUploadedUrl(url);
    message.success('上传成功!');
    setCurrentStep(1);
  };

  // 开始生成
  const handleGenerate = async () => {
    try {
      setProcessing(true);

      // 创建任务
      const response: any = await api.task.create({
        type: 'basic_clean',
        inputImageUrl: uploadedUrl,
        params: {
          template: selectedTemplate
        }
      });

      if (response.success && response.data) {
        const newTaskId = response.data.taskId;
        setTaskId(newTaskId);
        
        message.success('任务已创建,正在处理中...');
        setCurrentStep(2);

        // 轮询任务状态
        pollTaskStatus(newTaskId);
      } else {
        message.error(response.error?.message || '创建任务失败');
        setProcessing(false);
      }

    } catch (error: any) {
      message.error(error.message || '创建任务失败');
      setProcessing(false);
    }
  };

  // 轮询任务状态
  const pollTaskStatus = (taskId: string) => {
    const timer = setInterval(async () => {
      try {
        const response: any = await api.task.get(taskId);
        
        if (response.success && response.data) {
          const { status } = response.data;
          
          if (status === 'success') {
            clearInterval(timer);
            setProcessing(false);
            setCurrentStep(3);
            message.success('处理完成!');
          } else if (status === 'failed') {
            clearInterval(timer);
            setProcessing(false);
            message.error('处理失败: ' + response.data.errorMessage);
          }
        }
      } catch (error) {
        console.error('查询任务状态失败', error);
      }
    }, 2000);

    // 30秒后停止轮询
    setTimeout(() => {
      clearInterval(timer);
      if (processing) {
        setProcessing(false);
        message.warning('处理超时,请稍后查看任务列表');
      }
    }, 30000);
  };

  // 查看结果
  const handleViewResult = () => {
    router.push(`/task/${taskId}`);
  };

  // 重新上传
  const handleReset = () => {
    setCurrentStep(0);
    setUploadedUrl('');
    setTaskId('');
    setSelectedTemplate('all');
  };

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

        {/* 页面标题 */}
        <Card style={{ marginBottom: '24px' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={2} style={{ margin: 0 }}>
              <ThunderboltOutlined /> 基础修图
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              AI智能抠图、白底处理、图片增强,一键搞定商品图处理
            </Paragraph>
          </Space>
        </Card>

        {/* 步骤条 */}
        <Card style={{ marginBottom: '24px' }}>
          <Steps current={currentStep}>
            <Step title="上传图片" description="选择需要处理的商品图" />
            <Step title="选择模板" description="选择处理方式" />
            <Step title="处理中" description="AI正在处理图片" />
            <Step title="完成" description="查看和下载结果" />
          </Steps>
        </Card>

        {/* Step 0: 上传图片 */}
        {currentStep === 0 && (
          <Card title="上传商品图片">
            <ImageUploader
              onUploadSuccess={handleUploadSuccess}
              onUploadError={(error) => message.error('上传失败')}
            />
            <div style={{ 
              marginTop: '24px', 
              padding: '16px', 
              background: '#f6f8fa',
              borderRadius: '8px'
            }}>
              <Text strong>上传建议:</Text>
              <ul style={{ marginTop: '8px', marginBottom: 0 }}>
                <li>图片格式:JPG或PNG</li>
                <li>图片大小:不超过10MB</li>
                <li>图片尺寸:建议大于500x500像素</li>
                <li>图片内容:商品主体清晰,背景简单</li>
              </ul>
            </div>
          </Card>
        )}

        {/* Step 1: 选择模板 */}
        {currentStep === 1 && (
          <Card title="选择处理模板">
            <div style={{ marginBottom: '24px' }}>
              <Text strong>预览上传的图片:</Text>
              <div style={{ 
                marginTop: '16px',
                textAlign: 'center',
                padding: '16px',
                background: '#fafafa',
                borderRadius: '8px'
              }}>
                <AntImage
                  src={uploadedUrl}
                  alt="上传的图片"
                  style={{ maxWidth: '400px', maxHeight: '400px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <Text strong style={{ display: 'block', marginBottom: '16px' }}>
                选择处理方式:
              </Text>
              <Radio.Group
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Radio value="all">
                    <div>
                      <div><strong>全部处理(推荐)</strong></div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        抠图 + 白底 + 增强,生成3张处理结果
                      </div>
                    </div>
                  </Radio>
                  <Radio value="matting">
                    <div>
                      <div><strong>仅抠图</strong></div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        AI智能抠图,去除背景,保留透明底
                      </div>
                    </div>
                  </Radio>
                  <Radio value="white-bg">
                    <div>
                      <div><strong>抠图+白底</strong></div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        抠图后添加纯白背景,适合电商展示
                      </div>
                    </div>
                  </Radio>
                </Space>
              </Radio.Group>
            </div>

            <Space>
              <Button onClick={handleReset}>
                重新上传
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<ThunderboltOutlined />}
                onClick={handleGenerate}
              >
                开始生成 (消耗1次配额)
              </Button>
            </Space>
          </Card>
        )}

        {/* Step 2: 处理中 */}
        {currentStep === 2 && (
          <Card>
            <div style={{
              textAlign: 'center',
              padding: '60px 20px'
            }}>
              <Spin size="large" />
              <Title level={4} style={{ marginTop: '24px' }}>
                AI正在处理您的图片...
              </Title>
              <Paragraph type="secondary">
                预计需要5-10秒,请稍候
              </Paragraph>
              <Paragraph type="secondary" style={{ fontSize: '12px' }}>
                任务ID: {taskId}
              </Paragraph>
            </div>
          </Card>
        )}

        {/* Step 3: 完成 */}
        {currentStep === 3 && (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <CheckCircleOutlined 
                style={{ fontSize: '64px', color: '#52c41a' }} 
              />
              <Title level={3} style={{ marginTop: '16px' }}>
                处理完成!
              </Title>
              <Paragraph type="secondary">
                图片处理已完成,点击下方按钮查看结果
              </Paragraph>
              <Space style={{ marginTop: '24px' }}>
                <Button onClick={handleReset}>
                  处理新图片
                </Button>
                <Button
                  type="primary"
                  size="large"
                  onClick={handleViewResult}
                >
                  查看结果
                </Button>
              </Space>
            </div>
          </Card>
        )}

        {/* 消费提示 */}
        <Card style={{ marginTop: '24px', background: '#fffbe6', border: '1px solid #ffe58f' }}>
          <Space>
            <Text strong>💡 温馨提示:</Text>
            <Text>
              每次处理消耗1次配额。处理失败会自动返还配额,请放心使用。
            </Text>
          </Space>
        </Card>
      </div>
    </div>
  );
}
