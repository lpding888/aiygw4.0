import type { Meta, StoryObj } from '@storybook/react';
import FeedbackButton from './FeedbackButton';

/**
 * QA-P2-STORY-208: FeedbackButton 组件 Story
 * 艹！用户反馈按钮，支持 Bug 上报和会话跟踪！
 *
 * @author 老王
 */

const meta: Meta<typeof FeedbackButton> = {
  title: 'Components/FeedbackButton',
  component: FeedbackButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# FeedbackButton 用户反馈按钮

浮动在页面右下角的反馈按钮，用户可以快速反馈 Bug 和问题。

## 特性
- ✅ 浮动按钮，不占用页面空间
- ✅ 自动生成唯一 Session ID
- ✅ 附带最近 10 条告警记录
- ✅ 支持 Bug / 功能建议 / 性能问题 / 其他
- ✅ 自动采集环境信息（URL、UserAgent、时间戳）
- ✅ 一键复制 Session ID

## 使用场景
- 用户发现 Bug 时可以快速反馈
- 运营人员收集功能建议
- 性能问题上报
- 其他问题反馈
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 默认状态
 */
export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: '默认状态，浮动在页面右下角',
      },
    },
  },
};

/**
 * 在不同背景下
 */
export const OnLightBackground: Story = {
  args: {},
  parameters: {
    backgrounds: { default: 'light' },
    docs: {
      description: {
        story: '在亮色背景下的显示效果',
      },
    },
  },
};

export const OnDarkBackground: Story = {
  args: {},
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: '在暗色背景下的显示效果',
      },
    },
  },
};

/**
 * 移动端显示
 */
export const OnMobile: Story = {
  args: {},
  parameters: {
    viewport: { defaultViewport: 'mobile' },
    docs: {
      description: {
        story: '在移动设备上的显示效果（375px），按钮会自动调整位置',
      },
    },
  },
};

/**
 * 交互演示
 */
export const InteractiveDemo: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: `
点击浮动按钮，会弹出反馈表单：
1. 选择问题类型（Bug / 功能建议 / 性能问题 / 其他）
2. 填写问题描述
3. 系统自动附带环境信息和最近告警
4. 可以复制 Session ID 方便与客服沟通
        `,
      },
    },
  },
};
