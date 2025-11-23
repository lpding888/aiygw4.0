'use client';

/**
 * UnderConstruction - 通用"功能开发中"占位组件
 * 替代各个空页面的重复代码，符合 DRY 原则
 */

import { Typography, Empty, Button } from 'antd';
import { ArrowLeftOutlined, ToolOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

export interface UnderConstructionProps {
  /** 页面标题 */
  title: string;
  /** 可选描述文字 */
  description?: string;
  /** 是否显示返回按钮，默认 true */
  showBackButton?: boolean;
  /** 可选的预期上线时间提示 */
  eta?: string;
}

/**
 * 通用占位组件 - 用于尚未开发完成的管理后台页面
 */
export function UnderConstruction({
  title,
  description = '功能正在开发中，敬请期待...',
  showBackButton = true,
  eta,
}: UnderConstructionProps) {
  const router = useRouter();

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>{title}</Title>
      <Empty
        image={
          <div style={{
            width: 120,
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
            borderRadius: 24,
            margin: '0 auto',
          }}>
            <ToolOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />
          </div>
        }
        description={
          <div style={{ marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: 16 }}>{description}</Text>
            {eta && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  预计上线时间: {eta}
                </Text>
              </div>
            )}
          </div>
        }
      >
        {showBackButton && (
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.back()}
            style={{ marginTop: 16 }}
          >
            返回上一页
          </Button>
        )}
      </Empty>
    </div>
  );
}

export default UnderConstruction;
