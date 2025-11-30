/**
 * FeatureCard 功能卡片组件
 * 艹，这个组件显示单个功能卡片，支持点击跳转！
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, Badge, Tag } from 'antd';
import { DynamicIcon } from '@/shared/ui/DynamicIcon';
import type { FeatureCard as FeatureCardType, FeatureCardSize } from '../model/types';

/**
 * FeatureCard Props
 */
export interface FeatureCardProps {
  /** 功能配置 */
  feature: FeatureCardType;

  /** 点击回调 */
  onClick?: (feature: FeatureCardType) => void;

  /** 是否显示禁用状态 */
  showDisabledState?: boolean;

  /** 自定义样式 */
  className?: string;
}

/**
 * 根据卡片大小获取高度
 */
const getSizeHeight = (size: FeatureCardSize): number => {
  switch (size) {
    case 'small':
      return 140;
    case 'medium':
      return 160;
    case 'large':
      return 200;
    default:
      return 160;
  }
};

/**
 * FeatureCard 组件
 */
export const FeatureCard: React.FC<FeatureCardProps> = ({
  feature,
  onClick,
  showDisabledState = true,
  className,
}) => {
  const router = useRouter();

  /**
   * 处理卡片点击
   */
  const handleClick = () => {
    // 禁用的卡片不响应点击
    if (feature.disabled) {
      return;
    }

    // 回调
    onClick?.(feature);

    // 路由跳转
    if (feature.path) {
      router.push(feature.path);
    }
  };

  /**
   * 渲染徽标
   */
  const renderBadge = () => {
    if (feature.badge) {
      return (
        <Badge
          count={feature.badge}
          color={feature.badgeColor}
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}
        />
      );
    }
    return null;
  };

  /**
   * 渲染标签
   */
  const renderTags = () => {
    const tags = [];

    if (feature.isNew) {
      tags.push(
        <Tag key="new" color="#108ee9" style={{ borderRadius: 12, border: 'none', padding: '0 8px' }}>
          NEW
        </Tag>
      );
    }

    if (feature.isHot) {
      tags.push(
        <Tag key="hot" color="#f50" style={{ borderRadius: 12, border: 'none', padding: '0 8px' }}>
          HOT
        </Tag>
      );
    }

    if (tags.length === 0) {
      return null;
    }

    return <div style={{ marginTop: 12 }}>{tags}</div>;
  };

  // 卡片样式
  const cardStyle: React.CSSProperties = {
    height: getSizeHeight(feature.size),
    cursor: feature.disabled ? 'not-allowed' : 'pointer',
    opacity: showDisabledState && feature.disabled ? 0.6 : 1,
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    borderRadius: 16,
    border: '1px solid rgba(0,0,0,0.06)',
    overflow: 'hidden',
    background: feature.disabled ? '#f5f5f5' : '#fff',
  };

  // 图标容器样式
  const iconContainerStyle: React.CSSProperties = {
    width: 64,
    height: 64,
    borderRadius: 20,
    background: feature.disabled 
      ? '#e6e6e6' 
      : 'linear-gradient(135deg, #E6F7FF 0%, #BAE7FF 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    transition: 'all 0.3s',
  };

  return (
    <Card
      className={className}
      style={cardStyle}
      hoverable={!feature.disabled}
      onClick={handleClick}
      bordered={false}
      styles={{
        body: {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '24px',
        },
      }}
      onMouseEnter={(e) => {
        if (!feature.disabled) {
          e.currentTarget.style.transform = 'translateY(-8px)';
          e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
          e.currentTarget.style.borderColor = 'transparent';
        }
      }}
      onMouseLeave={(e) => {
        if (!feature.disabled) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)';
        }
      }}
    >
      {/* 徽标 */}
      {renderBadge()}

      {/* 图标 */}
      <div style={iconContainerStyle}>
        <DynamicIcon 
          icon={feature.icon} 
          size={32} 
          color={feature.disabled ? '#999' : '#1890ff'} 
        />
      </div>

      {/* 标题 */}
      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          marginBottom: 8,
          color: feature.disabled ? '#999' : '#1f2937',
          letterSpacing: '-0.025em',
        }}
      >
        {feature.title}
      </div>

      {/* 描述 */}
      <div
        style={{
          fontSize: 13,
          color: feature.disabled ? '#ccc' : '#6b7280',
          lineHeight: 1.5,
          maxWidth: '90%',
        }}
      >
        {feature.description}
      </div>

      {/* 标签 */}
      {renderTags()}
    </Card>
  );
};

export default FeatureCard;
