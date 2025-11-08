'use client';

/**
 * RBAC示例页面
 * 艹！这个页面演示RBAC系统的使用方法！
 *
 * @author 老王
 */

import React from 'react';
import { Card, Row, Col, Typography, Button, Tag, Space, Divider, Select, Table } from 'antd';
import {
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  EyeOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { Guard } from '@/components/rbac/Guard';
import { FieldGuard } from '@/components/rbac/FieldGuard';
import { useAbility } from '@/hooks/useAbility';

const { Title, Text, Paragraph } = Typography;

/**
 * 模拟用户数据
 */
const mockUser = {
  id: 'user-001',
  name: '张三',
  email: 'zhangsan@example.com',
  phone: '13812345678',
  address: '北京市朝阳区xxx街道xxx号',
  role: 'member',
  created_at: '2024-01-15',
  last_login: '2025-11-04 10:30:00',
};

/**
 * 模拟订单数据
 */
const mockOrder = {
  order_id: 'ORD-20251104-001',
  amount: 299.00,
  status: 'paid',
  payment_method: '支付宝 (zhang***@example.com)',
  created_at: '2025-11-04 10:00:00',
  invoice_url: '/invoices/ORD-20251104-001.pdf',
};

/**
 * RBAC示例页面
 */
export default function RBACDemoPage() {
  const { can, role, getFieldPermissions } = useAbility();

  // 用户字段权限
  const userFieldPerms = getFieldPermissions('user');

  // 订单字段权限
  const billingFieldPerms = getFieldPermissions('billing');

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <LockOutlined style={{ marginRight: 8 }} />
          RBAC权限系统演示
        </Title>
        <Paragraph type="secondary">
          当前角色: <Tag color="blue">{role}</Tag>
        </Paragraph>
      </div>

      {/* 权限说明 */}
      <Card title="权限控制说明" style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Card size="small" title="操作级权限">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>使用 <Tag>Guard</Tag> 组件保护按钮/操作</li>
                <li>根据 <Tag>resource</Tag> 和 <Tag>action</Tag> 判断</li>
                <li>支持条件判断（如: 只能编辑自己的内容）</li>
              </ul>
            </Card>
          </Col>

          <Col span={8}>
            <Card size="small" title="字段级权限">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>使用 <Tag>FieldGuard</Tag> 组件控制字段显示</li>
                <li>自动脱敏敏感字段（邮箱/手机号）</li>
                <li>控制字段可编辑性</li>
              </ul>
            </Card>
          </Col>

          <Col span={8}>
            <Card size="small" title="角色说明">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li><Tag color="purple">owner</Tag>: 完全控制权</li>
                <li><Tag color="blue">admin</Tag>: 管理权限</li>
                <li><Tag color="green">member</Tag>: 标准权限</li>
                <li><Tag color="orange">viewer</Tag>: 只读权限</li>
                <li><Tag>guest</Tag>: 最小权限</li>
              </ul>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 操作级权限示例 */}
      <Card title="操作级权限示例" style={{ marginBottom: 24 }}>
        <Space size="middle">
          <Guard resource="template" action="create">
            <Button type="primary" icon={<PlusOutlined />}>
              创建模板
            </Button>
          </Guard>

          <Guard
            resource="template"
            action="create"
            fallback={
              <Button disabled icon={<PlusOutlined />}>
                创建模板 (无权限)
              </Button>
            }
          >
            <Button type="primary" icon={<PlusOutlined />}>
              创建模板
            </Button>
          </Guard>

          <Guard resource="template" action="delete">
            <Button danger icon={<DeleteOutlined />}>
              删除模板
            </Button>
          </Guard>

          <Guard resource="user" action="manage">
            <Button icon={<UserOutlined />}>
              用户管理
            </Button>
          </Guard>

          <Guard resource="billing" action="manage">
            <Button icon={<EditOutlined />}>
              账单管理
            </Button>
          </Guard>
        </Space>

        <Divider />

        <Text type="secondary">
          💡 提示：上面的按钮根据当前角色 <Tag color="blue">{role}</Tag> 的权限自动显示/隐藏
        </Text>
      </Card>

      {/* 字段级权限示例：用户信息 */}
      <Card title="字段级权限示例：用户信息" style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>ID：</Text>
              <FieldGuard resource="user" field="id" value={mockUser.id} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>姓名：</Text>
              <FieldGuard resource="user" field="name" value={mockUser.name} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>邮箱：</Text>
              <FieldGuard resource="user" field="email" value={mockUser.email} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>手机号：</Text>
              <FieldGuard resource="user" field="phone" value={mockUser.phone} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>地址：</Text>
              <FieldGuard resource="user" field="address" value={mockUser.address} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>角色：</Text>
              <FieldGuard resource="user" field="role" value={mockUser.role} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>创建时间：</Text>
              <FieldGuard resource="user" field="created_at" value={mockUser.created_at} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>最后登录：</Text>
              <FieldGuard resource="user" field="last_login" value={mockUser.last_login} />
            </div>
          </Col>

          <Col span={12}>
            <Card size="small" title="当前角色的字段权限" type="inner">
              {userFieldPerms && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>可见字段：</Text>
                    <div style={{ marginTop: 4 }}>
                      {userFieldPerms.visible.map((field) => (
                        <Tag key={field} color="green" style={{ marginBottom: 4 }}>
                          {field}
                        </Tag>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <Text strong>可编辑字段：</Text>
                    <div style={{ marginTop: 4 }}>
                      {userFieldPerms.editable.length > 0 ? (
                        userFieldPerms.editable.map((field) => (
                          <Tag key={field} color="blue" style={{ marginBottom: 4 }}>
                            {field}
                          </Tag>
                        ))
                      ) : (
                        <Text type="secondary">无</Text>
                      )}
                    </div>
                  </div>

                  <div>
                    <Text strong>脱敏字段：</Text>
                    <div style={{ marginTop: 4 }}>
                      {userFieldPerms.masked.length > 0 ? (
                        userFieldPerms.masked.map((field) => (
                          <Tag key={field} color="red" style={{ marginBottom: 4 }}>
                            {field}
                          </Tag>
                        ))
                      ) : (
                        <Text type="secondary">无</Text>
                      )}
                    </div>
                  </div>
                </>
              )}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 字段级权限示例：订单信息 */}
      <Card title="字段级权限示例：订单信息" style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>订单号：</Text>
              <FieldGuard resource="billing" field="order_id" value={mockOrder.order_id} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>金额：</Text>
              <FieldGuard resource="billing" field="amount" value={`¥${mockOrder.amount.toFixed(2)}`} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>状态：</Text>
              <FieldGuard resource="billing" field="status" value={mockOrder.status} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>支付方式：</Text>
              <FieldGuard resource="billing" field="payment_method" value={mockOrder.payment_method} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>创建时间：</Text>
              <FieldGuard resource="billing" field="created_at" value={mockOrder.created_at} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>发票链接：</Text>
              <FieldGuard resource="billing" field="invoice_url" value={mockOrder.invoice_url} />
            </div>
          </Col>

          <Col span={12}>
            <Card size="small" title="当前角色的字段权限" type="inner">
              {billingFieldPerms && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>可见字段：</Text>
                    <div style={{ marginTop: 4 }}>
                      {billingFieldPerms.visible.length > 0 ? (
                        billingFieldPerms.visible.map((field) => (
                          <Tag key={field} color="green" style={{ marginBottom: 4 }}>
                            {field}
                          </Tag>
                        ))
                      ) : (
                        <Text type="secondary">无</Text>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <Text strong>可编辑字段：</Text>
                    <div style={{ marginTop: 4 }}>
                      {billingFieldPerms.editable.length > 0 ? (
                        billingFieldPerms.editable.map((field) => (
                          <Tag key={field} color="blue" style={{ marginBottom: 4 }}>
                            {field}
                          </Tag>
                        ))
                      ) : (
                        <Text type="secondary">无</Text>
                      )}
                    </div>
                  </div>

                  <div>
                    <Text strong>脱敏字段：</Text>
                    <div style={{ marginTop: 4 }}>
                      {billingFieldPerms.masked.length > 0 ? (
                        billingFieldPerms.masked.map((field) => (
                          <Tag key={field} color="red" style={{ marginBottom: 4 }}>
                            {field}
                          </Tag>
                        ))
                      ) : (
                        <Text type="secondary">无</Text>
                      )}
                    </div>
                  </div>
                </>
              )}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 权限API示例 */}
      <Card title="useAbility Hook API示例">
        <Paragraph>
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
            {`import { useAbility } from '@/hooks/useAbility';

const { can, canViewField, canEditField, filterFields } = useAbility();

// 检查操作权限
if (can('template', 'create')) {
  // 显示创建按钮
}

// 检查字段查看权限
if (canViewField('user', 'email')) {
  // 显示邮箱字段
}

// 检查字段编辑权限
if (canEditField('user', 'phone')) {
  // 显示可编辑的手机号输入框
}

// 过滤对象字段
const visibleUserData = filterFields('user', userData);
// 返回: { id: 'user-001', name: '张三', email: 'zh***@example.com', ... }`}
          </pre>
        </Paragraph>
      </Card>
    </div>
  );
}
