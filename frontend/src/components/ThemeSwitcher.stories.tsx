import type { Meta, StoryObj } from '@storybook/react';
import ThemeSwitcher from './ThemeSwitcher';

/**
 * QA-P2-STORY-208: ThemeSwitcher 组件 Story
 * 艹！主题切换器，支持亮色/暗色/自动三种模式！
 *
 * @author 老王
 */

const meta: Meta<typeof ThemeSwitcher> = {
  title: 'Components/ThemeSwitcher',
  component: ThemeSwitcher,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# ThemeSwitcher 主题切换器

支持三种主题模式：
- **Light（亮色）**：适合白天使用
- **Dark（暗色）**：适合夜晚使用
- **Auto（自动）**：根据系统设置自动切换

## 特性
- ✅ 本地存储，刷新后保持选择
- ✅ 实时切换，无需刷新页面
- ✅ 支持键盘导航
- ✅ 符合 WCAG 2.1 无障碍标准
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
        story: '默认状态的主题切换器，会根据 localStorage 或系统设置显示当前主题',
      },
    },
  },
};

/**
 * 在亮色背景下
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

/**
 * 在暗色背景下
 */
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
 * 不同尺寸设备
 */
export const OnMobile: Story = {
  args: {},
  parameters: {
    viewport: { defaultViewport: 'mobile' },
    docs: {
      description: {
        story: '在移动设备上的显示效果（375px）',
      },
    },
  },
};

export const OnTablet: Story = {
  args: {},
  parameters: {
    viewport: { defaultViewport: 'tablet' },
    docs: {
      description: {
        story: '在平板设备上的显示效果（768px）',
      },
    },
  },
};

export const OnDesktop: Story = {
  args: {},
  parameters: {
    viewport: { defaultViewport: 'desktop' },
    docs: {
      description: {
        story: '在桌面设备上的显示效果（1440px）',
      },
    },
  },
};
