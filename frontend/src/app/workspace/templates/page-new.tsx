/**
 * PAGE-P0-TPL-007 + PERF-P2-SSR-204 模板中心页面(SSR优化版)
 * 艹!这个SB页面现在用Server Component + ISR,性能暴增!
 *
 * 技术改进:
 * 1. Server Component渲染静态内容(SEO友好)
 * 2. ISR增量静态再生成(60秒缓存)
 * 3. Client Component仅处理交互
 * 4. 懒加载重组件
 *
 * @author 老王
 */

import React from 'react';
import { Typography, Row, Col, Input, Select, Button, Space } from 'antd';
import {
  AppstoreOutlined,
  StarFilled,
  HeartFilled,
  ThunderboltOutlined,
  SearchOutlined,
  PlusOutlined,
  FileTextOutlined,
  CodeOutlined,
  PictureOutlined,
  BulbOutlined,
  FileMarkdownOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import BaseCard from '@/components/base/BaseCard';
import TemplateClientWrapper from '@/components/templates/TemplateClientWrapper';
import { getTemplates, getTemplateStats } from '@/lib/api/templates';

const { Title, Text } = Typography;

// 艹!导出类型定义(供其他组件使用)
export enum TemplateType {
  DOCUMENT = 'document',
  CODE = 'code',
  PRESENTATION = 'presentation',
  FORM = 'form',
  EMAIL = 'email',
  REPORT = 'report',
  CONTRACT = 'contract',
  PROPOSAL = 'proposal'
}

export enum TemplateCategory {
  BUSINESS = 'business',
  TECHNICAL = 'technical',
  CREATIVE = 'creative',
  EDUCATION = 'education',
  PERSONAL = 'personal',
  MARKETING = 'marketing'
}

export enum TemplateComplexity {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  label: string;
  required: boolean;
  defaultValue?: string;
  options?: string[];
  placeholder?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  complexity: string;
  tags: string[];
  content: string;
  thumbnail?: string;
  preview?: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  rating: number;
  ratingCount: number;
  isPublic: boolean;
  isOfficial: boolean;
  isFavorite: boolean;
  version: string;
  variables?: TemplateVariable[];
  dependencies?: string[];
}

export interface TemplateFormData {
  name: string;
  description: string;
  type: TemplateType;
  category: TemplateCategory;
  complexity: TemplateComplexity;
  tags: string[];
  content: string;
  isPublic: boolean;
  variables?: TemplateVariable[];
}

/**
 * 艹!PERF-P2-SSR-204: Server Component,服务端渲染!
 * 这个页面会在服务端预渲染,然后用ISR缓存60秒
 */
export default async function TemplateCenterPage() {
  // 艹!服务端数据获取,支持ISR缓存
  const templates = await getTemplates();
  const stats = await getTemplateStats();

  // 艹!配置信息(服务端静态数据)
  const typeConfig = {
    [TemplateType.DOCUMENT]: { label: '文档', icon: <FileTextOutlined />, color: 'blue' },
    [TemplateType.CODE]: { label: '代码', icon: <CodeOutlined />, color: 'green' },
    [TemplateType.PRESENTATION]: { label: '演示', icon: <PictureOutlined />, color: 'orange' },
    [TemplateType.FORM]: { label: '表单', icon: <FileWordOutlined />, color: 'purple' },
    [TemplateType.EMAIL]: { label: '邮件', icon: <FileMarkdownOutlined />, color: 'cyan' },
    [TemplateType.REPORT]: { label: '报告', icon: <FileExcelOutlined />, color: 'red' },
    [TemplateType.CONTRACT]: { label: '合同', icon: <FilePdfOutlined />, color: 'magenta' },
    [TemplateType.PROPOSAL]: { label: '提案', icon: <BulbOutlined />, color: 'gold' }
  };

  const categoryConfig = {
    [TemplateCategory.BUSINESS]: { label: '商务', color: 'blue' },
    [TemplateCategory.TECHNICAL]: { label: '技术', color: 'green' },
    [TemplateCategory.CREATIVE]: { label: '创意', color: 'orange' },
    [TemplateCategory.EDUCATION]: { label: '教育', color: 'purple' },
    [TemplateCategory.PERSONAL]: { label: '个人', color: 'cyan' },
    [TemplateCategory.MARKETING]: { label: '营销', color: 'red' }
  };

  const complexityConfig = {
    [TemplateComplexity.BASIC]: { label: '基础', color: 'green' },
    [TemplateComplexity.INTERMEDIATE]: { label: '中级', color: 'orange' },
    [TemplateComplexity.ADVANCED]: { label: '高级', color: 'red' }
  };

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* 艹!页面标题 - Server Component渲染 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>模板中心</Title>
          <Text type="secondary">发现、创建和使用各种专业模板</Text>
        </div>

        {/* 艹!统计卡片 - Server Component渲染(SEO友好) */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <BaseCard size="small" stats={[
              { label: '总模板数', value: stats.totalTemplates, color: '#1890ff' }
            ]}>
              <AppstoreOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            </BaseCard>
          </Col>
          <Col span={6}>
            <BaseCard size="small" stats={[
              { label: '官方模板', value: stats.officialTemplates, color: '#52c41a' }
            ]}>
              <StarFilled style={{ fontSize: 24, color: '#52c41a' }} />
            </BaseCard>
          </Col>
          <Col span={6}>
            <BaseCard size="small" stats={[
              { label: '我的收藏', value: stats.favoriteTemplates, color: '#faad14' }
            ]}>
              <HeartFilled style={{ fontSize: 24, color: '#faad14' }} />
            </BaseCard>
          </Col>
          <Col span={6}>
            <BaseCard size="small" stats={[
              { label: '总使用次数', value: stats.totalUsage, color: '#13c2c2' }
            ]}>
              <ThunderboltOutlined style={{ fontSize: 24, color: '#13c2c2' }} />
            </BaseCard>
          </Col>
        </Row>

        {/* 艹!主要内容区域 */}
        <BaseCard>
          {/* 艹!Client Component处理交互 */}
          <TemplateClientWrapper
            initialTemplates={templates}
            typeConfig={typeConfig}
            categoryConfig={categoryConfig}
            complexityConfig={complexityConfig}
          />
        </BaseCard>
      </div>
    </div>
  );
}

/**
 * 艹!PERF-P2-SSR-204: ISR配置
 * 每60秒重新验证一次数据,实现增量静态再生成
 */
export const revalidate = 60; // ISR: 60秒缓存

/**
 * 艹!PERF-P2-SSR-204: 元数据配置(SEO优化)
 * Server Component可以直接export metadata
 */
export const metadata = {
  title: '模板中心 - AI照',
  description: '发现、创建和使用各种专业模板,提升工作效率',
  keywords: ['模板', '文档模板', '代码模板', '项目计划', '会议纪要'],
};
