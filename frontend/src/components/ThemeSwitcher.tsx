/**
 * UI-P2-TOKEN-205: 主题切换组件
 * 艹!提供三种主题切换:light(紫色)/dark(暗色)/brand(蓝色)!
 *
 * @author 老王
 */

'use client';

import React from 'react';
import { Segmented, Dropdown, Button } from 'antd';
import {
  BulbOutlined,
  BulbFilled,
  BgColorsOutlined,
} from '@ant-design/icons';
import { useTheme, useUiActions } from '@/shared/store';
import type { Theme } from '@/shared/store';

/**
 * 艹!主题切换组件Props
 */
interface ThemeSwitcherProps {
  /**
   * 艹!显示模式
   * - segmented: 分段选择器(默认)
   * - dropdown: 下拉菜单
   * - button: 按钮切换(仅light/dark)
   */
  mode?: 'segmented' | 'dropdown' | 'button';

  /**
   * 艹!尺寸
   */
  size?: 'small' | 'middle' | 'large';
}

/**
 * 艹!主题配置
 */
const themeOptions = [
  {
    label: '亮色',
    value: 'light' as Theme,
    icon: <BulbOutlined />,
    description: '紫色主题',
  },
  {
    label: '暗色',
    value: 'dark' as Theme,
    icon: <BulbFilled />,
    description: '深色模式',
  },
  {
    label: '品牌',
    value: 'brand' as Theme,
    icon: <BgColorsOutlined />,
    description: '蓝色主题',
  },
];

/**
 * 艹!主题切换组件
 *
 * 使用示例:
 * ```tsx
 * // 分段选择器(默认)
 * <ThemeSwitcher />
 *
 * // 下拉菜单
 * <ThemeSwitcher mode="dropdown" />
 *
 * // 按钮切换
 * <ThemeSwitcher mode="button" size="small" />
 * ```
 */
export default function ThemeSwitcher({
  mode = 'segmented',
  size = 'middle',
}: ThemeSwitcherProps) {
  const theme = useTheme();
  const { setTheme, toggleTheme } = useUiActions();

  // 艹!获取当前主题配置
  const currentTheme = themeOptions.find(opt => opt.value === theme);

  // 艹!分段选择器模式
  if (mode === 'segmented') {
    return (
      <Segmented
        value={theme}
        onChange={(value) => setTheme(value as Theme)}
        size={size}
        options={themeOptions.map(opt => ({
          label: (
            <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {opt.icon}
              <span>{opt.label}</span>
            </div>
          ),
          value: opt.value,
        }))}
      />
    );
  }

  // 艹!下拉菜单模式
  if (mode === 'dropdown') {
    return (
      <Dropdown
        menu={{
          items: themeOptions.map(opt => ({
            key: opt.value,
            label: opt.label,
            icon: opt.icon,
            onClick: () => setTheme(opt.value),
          })),
          selectedKeys: [theme],
        }}
        trigger={['click']}
      >
        <Button size={size} icon={currentTheme?.icon}>
          {currentTheme?.label}
        </Button>
      </Dropdown>
    );
  }

  // 艹!按钮切换模式(仅light/dark)
  return (
    <Button
      size={size}
      icon={theme === 'dark' ? <BulbFilled /> : <BulbOutlined />}
      onClick={() => toggleTheme()}
    >
      {theme === 'dark' ? '暗色' : '亮色'}
    </Button>
  );
}

/**
 * 艹!紧凑型主题切换组件(仅图标)
 */
export function ThemeSwitcherCompact({ size = 'middle' }: { size?: 'small' | 'middle' | 'large' }) {
  const theme = useTheme();
  const { toggleTheme } = useUiActions();

  return (
    <Button
      type="text"
      size={size}
      icon={theme === 'dark' ? <BulbFilled /> : <BulbOutlined />}
      onClick={() => toggleTheme()}
      title={`当前:${theme === 'dark' ? '暗色' : '亮色'}模式`}
    />
  );
}
