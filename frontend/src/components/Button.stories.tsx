import type { Meta, StoryObj } from '@storybook/react';
import { Button } from 'antd';
import {
  DownloadOutlined,
  SearchOutlined,
  UploadOutlined,
  DeleteOutlined,
  SaveOutlined,
} from '@ant-design/icons';

/**
 * QA-P2-STORY-208: Button 组件 Story
 * 艹！按钮组件，项目中最常用的交互元素！
 *
 * @author 老王
 */

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['default', 'primary', 'dashed', 'link', 'text'],
      description: '按钮类型',
    },
    size: {
      control: 'select',
      options: ['small', 'middle', 'large'],
      description: '按钮尺寸',
    },
    danger: {
      control: 'boolean',
      description: '危险按钮',
    },
    disabled: {
      control: 'boolean',
      description: '禁用状态',
    },
    loading: {
      control: 'boolean',
      description: '加载状态',
    },
    block: {
      control: 'boolean',
      description: '块级按钮（100%宽度）',
    },
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# Button 按钮

基于 Ant Design Button 组件，项目中最常用的交互元素。

## 按钮类型
- **Primary（主按钮）**：用于主要操作，如"提交"、"确认"
- **Default（默认按钮）**：用于次要操作，如"取消"、"返回"
- **Dashed（虚线按钮）**：用于添加操作
- **Link（链接按钮）**：用于导航操作
- **Text（文本按钮）**：用于最次要的操作

## 使用规范
- ✅ 每个页面最多 1 个主按钮
- ✅ 危险操作（删除、清空）使用 danger 属性
- ✅ 异步操作使用 loading 状态
- ✅ 禁用按钮要有明确的原因提示
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 主按钮
 */
export const Primary: Story = {
  args: {
    type: 'primary',
    children: '主按钮',
  },
  parameters: {
    docs: {
      description: {
        story: '主按钮，用于最重要的操作（如"提交"、"确认"）',
      },
    },
  },
};

/**
 * 默认按钮
 */
export const Default: Story = {
  args: {
    type: 'default',
    children: '默认按钮',
  },
  parameters: {
    docs: {
      description: {
        story: '默认按钮，用于次要操作（如"取消"、"返回"）',
      },
    },
  },
};

/**
 * 虚线按钮
 */
export const Dashed: Story = {
  args: {
    type: 'dashed',
    children: '虚线按钮',
  },
  parameters: {
    docs: {
      description: {
        story: '虚线按钮，用于添加操作（如"添加模板"、"新增配置"）',
      },
    },
  },
};

/**
 * 链接按钮
 */
export const Link: Story = {
  args: {
    type: 'link',
    children: '链接按钮',
  },
  parameters: {
    docs: {
      description: {
        story: '链接按钮，用于导航操作（如"查看详情"、"了解更多"）',
      },
    },
  },
};

/**
 * 文本按钮
 */
export const Text: Story = {
  args: {
    type: 'text',
    children: '文本按钮',
  },
  parameters: {
    docs: {
      description: {
        story: '文本按钮，用于最次要的操作（如"编辑"、"删除"）',
      },
    },
  },
};

/**
 * 危险按钮
 */
export const Danger: Story = {
  args: {
    type: 'primary',
    danger: true,
    children: '删除',
  },
  parameters: {
    docs: {
      description: {
        story: '危险按钮，用于删除、清空等危险操作',
      },
    },
  },
};

/**
 * 带图标的按钮
 */
export const WithIcon: Story = {
  args: {
    type: 'primary',
    icon: <UploadOutlined />,
    children: '上传图片',
  },
  parameters: {
    docs: {
      description: {
        story: '带图标的按钮，图标在文字左侧',
      },
    },
  },
};

/**
 * 加载状态
 */
export const Loading: Story = {
  args: {
    type: 'primary',
    loading: true,
    children: '提交中...',
  },
  parameters: {
    docs: {
      description: {
        story: '加载状态，用于异步操作（如上传、提交）',
      },
    },
  },
};

/**
 * 禁用状态
 */
export const Disabled: Story = {
  args: {
    type: 'primary',
    disabled: true,
    children: '禁用按钮',
  },
  parameters: {
    docs: {
      description: {
        story: '禁用状态，用户不能点击',
      },
    },
  },
};

/**
 * 块级按钮
 */
export const Block: Story = {
  args: {
    type: 'primary',
    block: true,
    children: '块级按钮',
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: '块级按钮，占据父容器 100% 宽度',
      },
    },
  },
};

/**
 * 不同尺寸
 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <Button type="primary" size="small">
        小按钮
      </Button>
      <Button type="primary" size="middle">
        中按钮
      </Button>
      <Button type="primary" size="large">
        大按钮
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '三种尺寸：small（小）、middle（中）、large（大）',
      },
    },
  },
};

/**
 * 按钮组合
 */
export const ButtonGroup: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px' }}>
      <Button type="primary" icon={<SaveOutlined />}>
        保存
      </Button>
      <Button type="default">取消</Button>
      <Button type="default" danger icon={<DeleteOutlined />}>
        删除
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '常见的按钮组合：保存 + 取消 + 删除',
      },
    },
  },
};

/**
 * 常用图标按钮
 */
export const CommonIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <Button type="primary" icon={<UploadOutlined />}>
        上传
      </Button>
      <Button type="primary" icon={<DownloadOutlined />}>
        下载
      </Button>
      <Button type="primary" icon={<SearchOutlined />}>
        搜索
      </Button>
      <Button type="primary" icon={<SaveOutlined />}>
        保存
      </Button>
      <Button type="primary" danger icon={<DeleteOutlined />}>
        删除
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '项目中常用的图标按钮',
      },
    },
  },
};
