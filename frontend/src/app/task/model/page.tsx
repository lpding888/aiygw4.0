'use client';

import { useState } from 'react';
import { Upload, Button, Steps, Select, Card, message, Spin } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

const { Dragger } = Upload;
const { Step } = Steps;
const { Option } = Select;

export default function AIModelPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string>('');
  const [scene, setScene] = useState<string>('street');
  const [category, setCategory] = useState<string>('shoes');
  const [generating, setGenerating] = useState(false);

  // 场景选项
  const sceneOptions = [
    { value: 'street', label: '街拍风格', desc: '时尚街头,自然光线,真实场景' },
    { value: 'studio', label: '白棚风格', desc: '专业影棚,纯白背景,干净简洁' },
    { value: 'indoor', label: '室内风格', desc: '室内场景,温馨氛围,生活化' }
  ];

  // 商品品类选项
  const categoryOptions = [
    { value: 'shoes', label: '鞋子', icon: '👟' },
    { value: 'dress', label: '裙子', icon: '👗' },
    { value: 'hoodie', label: '卫衣', icon: '👕' }
  ];

  // 步骤1: 图片上传
  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: 'image/jpeg,image/png',
    beforeUpload: (file: File) => {
      const isImage = file.type === 'image/jpeg' || file.type === 'image/png';
      if (!isImage) {
        message.error('只能上传 JPG/PNG 格式的图片!');
        return false;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('图片大小不能超过 10MB!');
        return false;
      }
      return false; // 阻止自动上传,手动处理
    },
    onChange: async (info: any) => {
      if (info.file.status !== 'uploading') {
        const file = info.file.originFileObj;
        if (file) {
          try {
            // 获取STS临时密钥
            const stsRes = await api.media.getSTS();
            const { credentials, bucket, region } = stsRes.data;

            // COS直传
            const formData = new FormData();
            formData.append('file', file);
            formData.append('key', `input/${Date.now()}_${file.name}`);
            
            const cosUrl = `https://${bucket}.cos.${region}.myqcloud.com`;
            const uploadRes = await fetch(cosUrl, {
              method: 'POST',
              headers: {
                'Authorization': credentials.sessionToken
              },
              body: formData
            });

            if (uploadRes.ok) {
              const imageUrl = `${cosUrl}/input/${Date.now()}_${file.name}`;
              setUploadedUrl(imageUrl);
              message.success('图片上传成功!');
              setCurrent(1);
            }
          } catch (error) {
            message.error('图片上传失败,请重试');
          }
        }
      }
    }
  };

  // 步骤4: 生成AI模特
  const handleGenerate = async () => {
    if (!uploadedUrl) {
      message.error('请先上传图片');
      return;
    }

    setGenerating(true);
    try {
      const response = await api.task.create({
        type: 'model_pose12',
        inputImageUrl: uploadedUrl,
        params: {
          scene,
          category
        }
      });

      message.success('任务创建成功,正在生成中...');
      
      // 跳转到任务详情页
      router.push(`/task/${response.data.taskId}`);
    } catch (error: any) {
      message.error(error.response?.data?.message || '任务创建失败');
      setGenerating(false);
    }
  };

  const steps = [
    {
      title: '上传图片',
      content: (
        <Card title="上传商品图片">
          <Dragger {...uploadProps} style={{ padding: '40px' }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
            <p className="ant-upload-hint">
              支持 JPG/PNG 格式,文件大小不超过 10MB
            </p>
          </Dragger>
          {uploadedUrl && (
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <img src={uploadedUrl} alt="uploaded" style={{ maxWidth: '100%', maxHeight: 300 }} />
              <p style={{ color: '#52c41a', marginTop: 10 }}>✅ 上传成功</p>
            </div>
          )}
        </Card>
      )
    },
    {
      title: '选择场景',
      content: (
        <Card title="选择拍摄场景">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {sceneOptions.map(option => (
              <Card
                key={option.value}
                hoverable
                style={{
                  border: scene === option.value ? '2px solid #1890ff' : '1px solid #d9d9d9',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setScene(option.value);
                  setCurrent(2);
                }}
              >
                <h3>{option.label}</h3>
                <p style={{ color: '#8c8c8c', fontSize: 14 }}>{option.desc}</p>
              </Card>
            ))}
          </div>
        </Card>
      )
    },
    {
      title: '选择品类',
      content: (
        <Card title="选择商品品类">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {categoryOptions.map(option => (
              <Card
                key={option.value}
                hoverable
                style={{
                  border: category === option.value ? '2px solid #1890ff' : '1px solid #d9d9d9',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
                onClick={() => {
                  setCategory(option.value);
                  setCurrent(3);
                }}
              >
                <div style={{ fontSize: 48 }}>{option.icon}</div>
                <h3>{option.label}</h3>
              </Card>
            ))}
          </div>
        </Card>
      )
    },
    {
      title: '生成确认',
      content: (
        <Card title="确认生成参数">
          <div style={{ padding: '20px 0' }}>
            <div style={{ marginBottom: 20 }}>
              <h4>预览图片:</h4>
              {uploadedUrl && (
                <img src={uploadedUrl} alt="preview" style={{ maxWidth: 300, maxHeight: 300 }} />
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <h4>场景风格:</h4>
              <p>{sceneOptions.find(s => s.value === scene)?.label} - {sceneOptions.find(s => s.value === scene)?.desc}</p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <h4>商品品类:</h4>
              <p>{categoryOptions.find(c => c.value === category)?.icon} {categoryOptions.find(c => c.value === category)?.label}</p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <h4>生成数量:</h4>
              <p>12张不同分镜摆姿图片</p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <h4>消耗配额:</h4>
              <p style={{ color: '#f5222d', fontSize: 18, fontWeight: 'bold' }}>10次</p>
            </div>
            <Button 
              type="primary" 
              size="large" 
              block 
              onClick={handleGenerate}
              loading={generating}
            >
              {generating ? '生成中...' : '确认生成 (消耗10次配额)'}
            </Button>
          </div>
        </Card>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ marginBottom: 30 }}>AI模特12分镜生成</h1>
      
      <Steps current={current} style={{ marginBottom: 40 }}>
        {steps.map(item => (
          <Step key={item.title} title={item.title} />
        ))}
      </Steps>

      <div style={{ minHeight: 400 }}>
        {steps[current].content}
      </div>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        {current > 0 && (
          <Button style={{ margin: '0 8px' }} onClick={() => setCurrent(current - 1)}>
            上一步
          </Button>
        )}
        {current < steps.length - 1 && current > 0 && (
          <Button type="primary" onClick={() => setCurrent(current + 1)}>
            下一步
          </Button>
        )}
      </div>

      <Card style={{ marginTop: 40, background: '#fafafa' }}>
        <h3>功能说明</h3>
        <ul>
          <li>📸 AI模特生成采用RunningHub工作流API</li>
          <li>🎨 支持3种场景风格: 街拍/白棚/室内</li>
          <li>👕 支持3种商品品类: 鞋/裙/卫衣</li>
          <li>🎬 一次生成12张不同分镜摆姿图片</li>
          <li>⏱️ 预计生成时间: 2-3分钟</li>
          <li>💰 消耗配额: 10次/任务</li>
        </ul>
      </Card>
    </div>
  );
}
