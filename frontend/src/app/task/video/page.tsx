'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Button,
  Typography,
  Space,
  Select,
  message,
  Steps,
  Image as AntImage,
  Spin,
  Input,
  Tag
} from 'antd';
import {
  ArrowLeftOutlined,
  VideoCameraOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import ImageUploader from '@/components/ImageUploader';
import { api } from '@/lib/api';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { TextArea } = Input;

interface VideoConfig {
  duration: number;
  scene: string;
  category: string;
  description: string;
}

export default function VideoGenerationPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [taskId, setTaskId] = useState<string>('');
  const [videoConfig, setVideoConfig] = useState<VideoConfig>({
    duration: 15,
    scene: 'street',
    category: 'dress',
    description: ''
  });

  // 处理上传成功
  const handleUploadSuccess = (url: string) => {
    setUploadedUrl(url);
    message.success('上传成功!');
    setCurrentStep(1);
  };

  // 配置验证
  const validateConfig = () => {
    if (!videoConfig.description.trim()) {
      message.error('请输入视频描述');
      return false;
    }
    return true;
  };

  // 开始生成
  const handleGenerate = async () => {
    if (!validateConfig()) return;

    try {
      setProcessing(true);

      // 创建任务
      const response: any = await api.task.create({
        type: 'video_generation',
        inputImageUrl: uploadedUrl,
        params: {
          duration: videoConfig.duration,
          scene: videoConfig.scene,
          category: videoConfig.category,
          description: videoConfig.description
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
            message.success('视频生成完成!');
          } else if (status === 'failed') {
            clearInterval(timer);
            setProcessing(false);
            message.error('生成失败: ' + response.data.errorMessage);
          }
        }
      } catch (error) {
        console.error('查询任务状态失败', error);
      }
    }, 3000); // 3秒轮询一次

    // 5分钟后停止轮询
    setTimeout(() => {
      clearInterval(timer);
      if (processing) {
        setProcessing(false);
        message.warning('处理超时,请稍后查看任务列表');
      }
    }, 300000); // 5分钟
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
    setVideoConfig({
      duration: 15,
      scene: 'street',
      category: 'dress',
      description: ''
    });
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
              <VideoCameraOutlined /> 服装视频生成
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              AI智能生成服装动态展示视频，多场景切换，专业效果
            </Paragraph>
          </Space>
        </Card>

        {/* 步骤条 */}
        <Card style={{ marginBottom: '24px' }}>
          <Steps current={currentStep}>
            <Step title="上传图片" description="选择服装图片" />
            <Step title="配置参数" description="设置视频参数" />
            <Step title="生成中" description="AI正在生成视频" />
            <Step title="完成" description="查看和下载视频" />
          </Steps>
        </Card>

        {/* Step 0: 上传图片 */}
        {currentStep === 0 && (
          <Card title="上传服装图片">
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
                <li>图片尺寸:建议大于800x800像素</li>
                <li>图片内容:服装主体清晰，无明显背景干扰</li>
                <li>拍摄角度:正面或45度角效果最佳</li>
              </ul>
            </div>
          </Card>
        )}

        {/* Step 1: 配置参数 */}
        {currentStep === 1 && (
          <Card title="配置视频参数">
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
                  style={{ maxWidth: '300px', maxHeight: '300px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
              {/* 视频时长 */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                  视频时长:
                </Text>
                <Select
                  value={videoConfig.duration}
                  onChange={(value) => setVideoConfig(prev => ({ ...prev, duration: value }))}
                  style={{ width: '100%' }}
                >
                  <Select.Option value={10}>10秒 (快速展示)</Select.Option>
                  <Select.Option value={15}>15秒 (标准展示)</Select.Option>
                  <Select.Option value={30}>30秒 (详细展示)</Select.Option>
                  <Select.Option value={60}>60秒 (深度展示)</Select.Option>
                </Select>
              </div>

              {/* 场景选择 */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                  展示场景:
                </Text>
                <Select
                  value={videoConfig.scene}
                  onChange={(value) => setVideoConfig(prev => ({ ...prev, scene: value }))}
                  style={{ width: '100%' }}
                >
                  <Select.Option value="street">街头场景</Select.Option>
                  <Select.Option value="studio">专业影棚</Select.Option>
                  <Select.Option value="outdoor">户外自然</Select.Option>
                  <Select.Option value="lifestyle">生活场景</Select.Option>
                  <Select.Option value="fashion">时装秀场</Select.Option>
                </Select>
              </div>

              {/* 服装类别 */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                  服装类别:
                </Text>
                <Select
                  value={videoConfig.category}
                  onChange={(value) => setVideoConfig(prev => ({ ...prev, category: value }))}
                  style={{ width: '100%' }}
                >
                  <Select.Option value="dress">连衣裙</Select.Option>
                  <Select.Option value="top">上衣</Select.Option>
                  <Select.Option value="pants">裤装</Select.Option>
                  <Select.Option value="skirt">裙装</Select.Option>
                  <Select.Option value="coat">外套</Select.Option>
                  <Select.Option value="hoodie">卫衣</Select.Option>
                  <Select.Option value="shoes">鞋类</Select.Option>
                </Select>
              </div>
            </div>

            {/* 视频描述 */}
            <div style={{ marginBottom: '24px' }}>
              <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                视频描述 <Tag color="red">必填</Tag>:
              </Text>
              <TextArea
                value={videoConfig.description}
                onChange={(e) => setVideoConfig(prev => ({ ...prev, description: e.target.value }))}
                placeholder="请描述您希望生成的视频效果，例如：模特在街头漫步，服装随风飘动，展现时尚感..."
                rows={4}
                maxLength={500}
                showCount
              />
            </div>

            <Space>
              <Button onClick={handleReset}>
                重新上传
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<VideoCameraOutlined />}
                onClick={handleGenerate}
              >
                开始生成 (消耗1次配额)
              </Button>
            </Space>
          </Card>
        )}

        {/* Step 2: 生成中 */}
        {currentStep === 2 && (
          <Card>
            <div style={{
              textAlign: 'center',
              padding: '60px 20px'
            }}>
              <Spin size="large" />
              <Title level={4} style={{ marginTop: '24px' }}>
                AI正在生成您的视频...
              </Title>
              <Paragraph type="secondary">
                视频生成需要1-3分钟，请耐心等待
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
                视频生成完成!
              </Title>
              <Paragraph type="secondary">
                您的服装展示视频已生成完成，点击下方按钮查看结果
              </Paragraph>
              <Space style={{ marginTop: '24px' }}>
                <Button onClick={handleReset}>
                  生成新视频
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
              每次生成消耗1次配额。生成失败会自动返还配额，请放心使用。
              视频生成过程需要1-3分钟，请耐心等待。
            </Text>
          </Space>
        </Card>
      </div>
    </div>
  );
}