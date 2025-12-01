'use client';

/**
 * Feature创建向导页面（CMS-208 + CMS-306）
 * 艹！使用Step Wizard引导管理员创建完整的Feature！
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Steps, Card, Button, message, Alert } from 'antd';
import {
  InfoCircleOutlined,
  FormOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';

// Step组件
import BasicInfoStep from '@/components/admin/FeatureWizard/BasicInfoStep';
import FormDesignStep from '@/components/admin/FeatureWizard/FormDesignStep';
import PipelineEditorStep from '@/components/admin/FeatureWizard/PipelineEditorStep';
import PreviewPublishStep from '@/components/admin/FeatureWizard/PreviewPublishStep';

type FeatureWizardPayload = Parameters<
  (typeof api)['admin']['createFeatureFromWizard']
>[0];

/**
 * Feature数据结构
 * 艹，向导内部用Partial来逐步填充！
 */
type FeatureData = Partial<FeatureWizardPayload> & {
  form_schema_data?: any;
};

export default function FeatureWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [featureData, setFeatureData] = useState<FeatureData>({
    feature_id: '',
    display_name: '',
    description: '',
    category: '图片处理',
    icon: 'picture',
    plan_required: 'free',
    access_scope: 'plan',
    quota_cost: 1,
  });

  /**
   * 更新Feature数据
   */
  const updateFeatureData = (data: Partial<FeatureData>) => {
    setFeatureData((prev) => ({ ...prev, ...data }));
  };

  /**
   * 下一步
   */
  const handleNext = () => {
    setCurrentStep((prev) => prev + 1);
  };

  /**
   * 上一步
   */
  const handlePrev = () => {
    setCurrentStep((prev) => prev - 1);
  };

  /**
   * 完成创建
   */
  const handleFinish = async () => {
    try {
      const {
        feature_id,
        display_name,
        description,
        category,
        icon,
        plan_required,
        access_scope,
        quota_cost,
        rate_limit_policy,
        form_schema_id,
        pipeline_schema_id,
        pipeline_schema_data,
      } = featureData;

      if (!feature_id?.trim()) {
        message.error('艹，Feature ID不能空着！');
        return;
      }

      if (!display_name?.trim()) {
        message.error('艹，功能名称也得填！');
        return;
      }

      if (!description?.trim()) {
        message.error('艹，功能描述写一下，别偷懒！');
        return;
      }

      if (!pipeline_schema_id || !pipeline_schema_data) {
        message.error('流程编排还没保存，先去把Pipeline搞定！');
        return;
      }

      const payload: FeatureWizardPayload = {
        feature_id,
        display_name,
        description,
        category,
        icon,
        plan_required,
        access_scope,
        quota_cost,
        rate_limit_policy,
        form_schema_id,
        pipeline_schema_id,
        pipeline_schema_data,
      };

      // 调用Feature Wizard API创建Feature
      console.log('[Feature创建] 数据:', payload);

      const response: any = await api.admin.createFeatureFromWizard(payload);

      if (response.success) {
        message.success(`Feature "${featureData.display_name}" 创建成功！`);
        router.push('/admin/features');
      } else {
        throw new Error(response.error?.message || '创建失败');
      }
    } catch (error: any) {
      console.error('[Feature创建] 失败:', error);
      message.error(`创建失败: ${error.message || '未知错误'}`);
    }
  };

  // 步骤配置
  const steps = [
    {
      title: '基本信息',
      icon: <InfoCircleOutlined />,
      content: (
        <BasicInfoStep
          data={featureData}
          onUpdate={updateFeatureData}
          onNext={handleNext}
        />
      ),
    },
    {
      title: '表单设计',
      icon: <FormOutlined />,
      content: (
        <FormDesignStep
          data={featureData}
          onUpdate={updateFeatureData}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      ),
    },
    {
      title: '流程编排',
      icon: <BranchesOutlined />,
      content: (
        <PipelineEditorStep
          data={featureData}
          onUpdate={updateFeatureData}
          onNext={handleNext}
          onPrev={handlePrev}
        />
      ),
    },
    {
      title: '预览发布',
      icon: <CheckCircleOutlined />,
      content: (
        <PreviewPublishStep
          data={featureData}
          onFinish={handleFinish}
          onPrev={handlePrev}
        />
      ),
    },
  ];

  const safeStepIndex = Math.min(Math.max(currentStep, 0), steps.length - 1);
  const activeStep = steps[safeStepIndex];

  return (
    <div style={{ padding: '24px' }}>
      {/* 顶部导航 */}
      <div style={{ marginBottom: '24px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
          返回
        </Button>
      </div>

      {/* 标题 */}
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        创建新功能 (Feature)
      </h1>

      {/* 新手引导 */}
      <Alert
        message="如何创建一个 AI 应用？"
        description={
          <ul style={{ paddingLeft: '20px', margin: '8px 0 0 0' }}>
            <li><strong>1. 基本信息</strong>：给你的应用起个名字（比如“AI模特生成”），选个好看的图标。</li>
            <li><strong>2. 表单设计</strong>：设计用户需要填写的“订单”（比如上传衣服图、选择模特性别）。</li>
            <li><strong>3. 流程编排</strong>：最关键的一步！像搭积木一样，把用户的“订单”交给 AI 处理，最后输出结果。</li>
            <li><strong>4. 预览发布</strong>：检查一遍没问题，就可以上架给用户使用了！</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      {/* 步骤导航 */}
      <Card style={{ marginBottom: '24px' }}>
        <Steps
          current={safeStepIndex}
          items={steps.map((step) => ({
            title: step.title,
            icon: step.icon,
          }))}
        />
      </Card>

      {/* 步骤内容 */}
      <div>{activeStep?.content}</div>
    </div>
  );
}
