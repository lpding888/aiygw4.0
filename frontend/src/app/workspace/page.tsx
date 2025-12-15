/**
 * 工作台页面
 * 全能服装图片解决方案中心！
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Row,
  Col,
  Typography,
  Spin,
  message,
} from 'antd';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { MembershipStatus } from '@/types';
import { useWorkbench } from '@/features/workbench';
import { FeatureGrid } from '@/features/workbench/ui/FeatureGrid';
import { SolutionCard } from '@/features/workbench/ui/SolutionCard';
import ErrorBoundary from '@/components/ErrorBoundary';

const { Title, Text } = Typography;

export default function WorkspacePage() {
  console.log('[Workspace] Rendering WorkspacePage...');
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [loading, setLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);

  const { features } = useWorkbench();

  /**
   * 获取会员状态
   */
  const fetchMembershipStatus = async () => {
    try {
      setLoading(true);
      const response: any = await api.membership.status();

      if (response.data.success && response.data.data) {
        setMembershipStatus(response.data.data);
        if (user) {
          updateUser({
            ...user,
            isMember: response.data.data.isMember,
            quota_remaining: response.data.data.quotaRemaining || response.data.data.quota_remaining,
            quota_expireAt: response.data.data.quotaExpireAt || response.data.data.quota_expireAt,
          });
        }
      }
    } catch (error: any) {
      console.error('获取会员状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      router.replace('/login');
      return;
    }
    fetchMembershipStatus();
  }, [user?.id, router]);

  if (loading && !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{ padding: '32px', minHeight: '100vh', background: '#F9FAFB' }}>

        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Title level={1} style={{ fontSize: 36, marginBottom: 16, color: '#111827' }}>
            一站式服装图片解决方案
          </Title>
          <Text style={{ fontSize: 18, color: '#6B7280' }}>
            在这里解决您所有的服装图片问题 · AI模特 · 智能修图 · 营销视频
          </Text>
        </div>

        {/* Core Solutions (The Big Three) */}
        <Row gutter={[24, 24]} style={{ marginBottom: 64 }}>
          {/* 1. AI Model */}
          <Col xs={24} md={8}>
            <SolutionCard
              title="AI模特上身"
              description="无需外模，人台图/平铺图一键变模特图"
              icon="SkinOutlined"
              color="#7C3AED" // Violet
              features={[
                { label: '人台图转真人模特', isHot: true },
                { label: '真人模特换脸/换背景' },
                { label: '假发/配饰智能搭配' },
              ]}
              onClick={() => router.push('/ai/process')}
            />
          </Col>

          {/* 2. Smart Editing */}
          <Col xs={24} md={8}>
            <SolutionCard
              title="智能修图"
              description="电商必备修图神器，秒级处理"
              icon="ScissorOutlined"
              color="#2563EB" // Blue
              features={[
                { label: 'AI一键智能抠图' },
                { label: '魔法消除笔 (去水印/瑕疵)' },
                { label: '画质增强/超分' },
              ]}
              tools={[
                { label: '裁剪', onClick: () => message.info('裁剪工具即将上线') },
                { label: '加水印', onClick: () => message.info('水印工具即将上线') },
                { label: '基础调色', onClick: () => message.info('调色工具即将上线') },
                { label: '旋转翻转', onClick: () => message.info('旋转工具即将上线') },
              ]}
              onClick={() => router.push('/editor')}
            />
          </Col>

          {/* 3. Marketing Video */}
          <Col xs={24} md={8}>
            <SolutionCard
              title="营销视频"
              description="图片一键转视频，抢占短视频流量"
              icon="VideoCameraOutlined"
              color="#DB2777" // Pink
              features={[
                { label: '商品图转带货视频', isNew: true },
                { label: 'AI虚拟主播口播' },
                { label: '多语言视频翻译' },
              ]}
              onClick={() => router.push('/video/create')}
            />
          </Col>
        </Row>

        {/* Toolbox Section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ width: 4, height: 24, background: '#4B5563', borderRadius: 2, marginRight: 12 }} />
            <Title level={3} style={{ margin: 0, fontSize: 20, color: '#374151' }}>
              全能工具箱
            </Title>
          </div>

          <FeatureGrid
            features={features}
            groupByCategory={true}
            columns={4}
            gutter={[20, 20]}
            emptyText="暂无可用功能"
          />
        </div>

      </div>
    </ErrorBoundary>
  );
}
