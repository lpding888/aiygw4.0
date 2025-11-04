import type { Meta, StoryObj } from '@storybook/react';
import { Card, Avatar, Button, Space } from 'antd';
import {
  EditOutlined,
  EllipsisOutlined,
  SettingOutlined,
  HeartOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';

const { Meta: CardMeta } = Card;

/**
 * QA-P2-STORY-208: Card 组件 Story
 * 艹！卡片组件，用于内容展示的容器！
 *
 * @author 老王
 */

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# Card 卡片

用于内容展示的容器，支持标题、封面、操作按钮等。

## 使用场景
- 模板卡片
- 商品卡片
- 用户信息卡片
- 统计数据卡片
- 文章卡片

## 特性
- ✅ 支持封面图片
- ✅ 支持头像和描述
- ✅ 支持多种操作按钮
- ✅ 支持 hover 效果
- ✅ 响应式布局
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 基础卡片
 */
export const Basic: Story = {
  args: {
    title: '基础卡片',
    style: { width: 300 },
    children: (
      <p>
        这是一个基础卡片，包含标题和内容。
        <br />
        可以放置任意内容。
      </p>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '最基础的卡片，包含标题和内容区域',
      },
    },
  },
};

/**
 * 带封面的卡片
 */
export const WithCover: Story = {
  args: {
    hoverable: true,
    style: { width: 300 },
    cover: (
      <img
        alt="模板封面"
        src="https://via.placeholder.com/300x200/1890ff/ffffff?text=Template+Cover"
      />
    ),
    children: (
      <CardMeta
        title="AI商拍模板"
        description="专业的商品拍摄模板，支持多种场景"
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '带封面的卡片，常用于模板展示、商品展示',
      },
    },
  },
};

/**
 * 带操作按钮的卡片
 */
export const WithActions: Story = {
  args: {
    hoverable: true,
    style: { width: 300 },
    cover: (
      <img
        alt="模板封面"
        src="https://via.placeholder.com/300x200/52c41a/ffffff?text=Template+Cover"
      />
    ),
    actions: [
      <HeartOutlined key="like" />,
      <ShareAltOutlined key="share" />,
      <EllipsisOutlined key="ellipsis" />,
    ],
    children: (
      <CardMeta
        title="时尚商拍"
        description="适合服装、鞋帽等时尚商品"
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '带操作按钮的卡片，底部有点赞、分享等操作',
      },
    },
  },
};

/**
 * 带头像的卡片
 */
export const WithAvatar: Story = {
  args: {
    hoverable: true,
    style: { width: 300 },
    children: (
      <CardMeta
        avatar={<Avatar src="https://api.dicebear.com/7.x/miniavs/svg?seed=1" />}
        title="老王"
        description="资深前端开发工程师，专注于性能优化和用户体验"
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '带头像的卡片，常用于用户信息展示',
      },
    },
  },
};

/**
 * 加载状态
 */
export const Loading: Story = {
  args: {
    loading: true,
    style: { width: 300 },
    children: (
      <CardMeta
        avatar={<Avatar src="https://api.dicebear.com/7.x/miniavs/svg?seed=1" />}
        title="加载中..."
        description="正在加载数据..."
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: '加载状态，显示骨架屏',
      },
    },
  },
};

/**
 * 统计卡片
 */
export const Statistics: Story = {
  render: () => (
    <Space direction="vertical" size="middle">
      <Space size="middle">
        <Card title="今日上传" bordered={false} style={{ width: 200 }}>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>128</p>
          <p style={{ color: '#52c41a', margin: 0 }}>↑ 12% 较昨日</p>
        </Card>
        <Card title="今日生成" bordered={false} style={{ width: 200 }}>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>89</p>
          <p style={{ color: '#52c41a', margin: 0 }}>↑ 8% 较昨日</p>
        </Card>
        <Card title="成功率" bordered={false} style={{ width: 200 }}>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0 }}>98.5%</p>
          <p style={{ color: '#ff4d4f', margin: 0 }}>↓ 0.5% 较昨日</p>
        </Card>
      </Space>
    </Space>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: '统计卡片，用于数据展示',
      },
    },
  },
};

/**
 * 模板卡片（实际项目场景）
 */
export const TemplateCard: Story = {
  render: () => (
    <Card
      hoverable
      style={{ width: 280 }}
      cover={
        <img
          alt="模板封面"
          src="https://via.placeholder.com/280x180/1890ff/ffffff?text=AI+Studio"
          style={{ height: 180, objectFit: 'cover' }}
        />
      }
      actions={[
        <Button type="link" key="preview">
          预览
        </Button>,
        <Button type="link" key="use">
          使用模板
        </Button>,
      ]}
    >
      <CardMeta
        title="AI商拍工作室"
        description={
          <div>
            <p style={{ marginBottom: 8 }}>
              专业的商品拍摄模板，支持多种场景和风格
            </p>
            <Space>
              <span style={{ color: '#faad14' }}>⭐ 4.8</span>
              <span style={{ color: '#999' }}>已使用 1.2k 次</span>
            </Space>
          </div>
        }
      />
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: '模板卡片的实际项目应用场景',
      },
    },
  },
};

/**
 * 响应式卡片组
 */
export const ResponsiveGrid: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '16px',
        width: '100%',
      }}
    >
      {[1, 2, 3, 4].map((i) => (
        <Card
          key={i}
          hoverable
          cover={
            <img
              alt={`模板${i}`}
              src={`https://via.placeholder.com/250x150/1890ff/ffffff?text=Template+${i}`}
            />
          }
        >
          <CardMeta title={`模板 ${i}`} description={`这是模板 ${i} 的描述`} />
        </Card>
      ))}
    </div>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: '响应式卡片网格，会根据容器宽度自动调整列数',
      },
    },
  },
};
