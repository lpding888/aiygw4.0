import type { Meta, StoryObj } from '@storybook/react';
import { Form, Input, Button, Select, DatePicker, Switch, Checkbox, Radio, Space, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';

/**
 * QA-P2-STORY-208: Form 组件 Story
 * 艹！表单组件，用于用户输入和数据收集！
 *
 * @author 老王
 */

const meta: Meta<typeof Form> = {
  title: 'Components/Form',
  component: Form,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# Form 表单

用于数据录入和提交，支持各种表单控件。

## 使用场景
- 用户登录/注册
- 数据编辑
- 搜索筛选
- 设置配置

## 表单规范
- ✅ 必填项用红色 * 标记
- ✅ 提供清晰的错误提示
- ✅ 提交按钮有 loading 状态
- ✅ 合理使用 placeholder
- ✅ 表单项垂直排列，标签右对齐
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 基础表单
 */
export const Basic: Story = {
  render: () => {
    const onFinish = (values: any) => {
      message.success('提交成功！');
      console.log('表单数据：', values);
    };

    return (
      <Form
        name="basic"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        style={{ width: 500 }}
        onFinish={onFinish}
        autoComplete="off"
      >
        <Form.Item
          label="用户名"
          name="username"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
        </Form.Item>

        <Form.Item
          label="密码"
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
        </Form.Item>

        <Form.Item name="remember" valuePropName="checked" wrapperCol={{ offset: 6, span: 18 }}>
          <Checkbox>记住我</Checkbox>
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 6, span: 18 }}>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form.Item>
      </Form>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '基础登录表单，包含用户名、密码、记住我',
      },
    },
  },
};

/**
 * 注册表单
 */
export const Register: Story = {
  render: () => {
    const onFinish = (values: any) => {
      message.success('注册成功！');
      console.log('表单数据：', values);
    };

    return (
      <Form
        name="register"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 18 }}
        style={{ width: 500 }}
        onFinish={onFinish}
      >
        <Form.Item
          label="邮箱"
          name="email"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
        </Form.Item>

        <Form.Item
          label="用户名"
          name="username"
          rules={[
            { required: true, message: '请输入用户名' },
            { min: 4, message: '用户名至少4个字符' },
          ]}
        >
          <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
        </Form.Item>

        <Form.Item
          label="密码"
          name="password"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 8, message: '密码至少8个字符' },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
        </Form.Item>

        <Form.Item
          label="确认密码"
          name="confirm"
          dependencies={['password']}
          rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次密码输入不一致'));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="请再次输入密码" />
        </Form.Item>

        <Form.Item
          name="agree"
          valuePropName="checked"
          wrapperCol={{ offset: 6, span: 18 }}
          rules={[
            {
              validator: (_, value) =>
                value ? Promise.resolve() : Promise.reject(new Error('请同意用户协议')),
            },
          ]}
        >
          <Checkbox>
            我已阅读并同意 <a href="#">用户协议</a> 和 <a href="#">隐私政策</a>
          </Checkbox>
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 6, span: 18 }}>
          <Button type="primary" htmlType="submit" block>
            注册
          </Button>
        </Form.Item>
      </Form>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '注册表单，包含邮箱、用户名、密码、确认密码、用户协议',
      },
    },
  },
};

/**
 * 搜索筛选表单
 */
export const Search: Story = {
  render: () => {
    const onFinish = (values: any) => {
      message.info('搜索：' + JSON.stringify(values));
      console.log('搜索条件：', values);
    };

    return (
      <Form
        name="search"
        layout="inline"
        onFinish={onFinish}
        style={{ padding: 20, background: '#f5f5f5', borderRadius: 8 }}
      >
        <Form.Item name="keyword">
          <Input placeholder="搜索关键词" style={{ width: 200 }} />
        </Form.Item>

        <Form.Item name="category">
          <Select placeholder="选择分类" style={{ width: 150 }}>
            <Select.Option value="all">全部分类</Select.Option>
            <Select.Option value="template">模板</Select.Option>
            <Select.Option value="image">图片</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="status">
          <Select placeholder="状态" style={{ width: 120 }}>
            <Select.Option value="all">全部状态</Select.Option>
            <Select.Option value="draft">草稿</Select.Option>
            <Select.Option value="published">已发布</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit">
            搜索
          </Button>
        </Form.Item>

        <Form.Item>
          <Button htmlType="reset">重置</Button>
        </Form.Item>
      </Form>
    );
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        story: '搜索筛选表单，inline 布局，包含多个筛选条件',
      },
    },
  },
};

/**
 * 设置表单
 */
export const Settings: Story = {
  render: () => {
    const onFinish = (values: any) => {
      message.success('保存成功！');
      console.log('设置数据：', values);
    };

    return (
      <Form
        name="settings"
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        style={{ width: 600 }}
        onFinish={onFinish}
        initialValues={{
          notifications: true,
          theme: 'auto',
          language: 'zh-CN',
        }}
      >
        <Form.Item label="通知设置" name="notifications" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label="主题模式" name="theme">
          <Radio.Group>
            <Radio value="light">亮色</Radio>
            <Radio value="dark">暗色</Radio>
            <Radio value="auto">跟随系统</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="语言" name="language">
          <Select style={{ width: 200 }}>
            <Select.Option value="zh-CN">简体中文</Select.Option>
            <Select.Option value="en-US">English</Select.Option>
            <Select.Option value="ja-JP">日本語</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="自动保存" name="autoSave" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
          <Space>
            <Button type="primary" htmlType="submit">
              保存设置
            </Button>
            <Button htmlType="reset">重置</Button>
          </Space>
        </Form.Item>
      </Form>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '设置表单，包含开关、单选、下拉等多种控件',
      },
    },
  },
};

/**
 * 垂直表单
 */
export const Vertical: Story = {
  render: () => {
    const onFinish = (values: any) => {
      message.success('提交成功！');
      console.log('表单数据：', values);
    };

    return (
      <Form
        name="vertical"
        layout="vertical"
        style={{ width: 400 }}
        onFinish={onFinish}
      >
        <Form.Item
          label="项目名称"
          name="name"
          rules={[{ required: true, message: '请输入项目名称' }]}
        >
          <Input placeholder="请输入项目名称" />
        </Form.Item>

        <Form.Item
          label="项目描述"
          name="description"
          rules={[{ required: true, message: '请输入项目描述' }]}
        >
          <Input.TextArea rows={4} placeholder="请输入项目描述" />
        </Form.Item>

        <Form.Item label="项目类型" name="type">
          <Select placeholder="选择项目类型">
            <Select.Option value="web">Web 应用</Select.Option>
            <Select.Option value="mobile">移动应用</Select.Option>
            <Select.Option value="desktop">桌面应用</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            创建项目
          </Button>
        </Form.Item>
      </Form>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '垂直表单，标签在输入框上方，适合移动端和窄屏幕',
      },
    },
  },
};
