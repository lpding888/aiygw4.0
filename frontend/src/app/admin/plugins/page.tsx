'use client';

/**
 * 插件管理页面
 * 艹！这个页面管理插件的安装、启用、配置！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  Select,
  message,
  Typography,
  Avatar,
  Divider,
  Badge,
  Tooltip,
  Alert,
  Descriptions,
} from 'antd';
import {
  AppstoreAddOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SettingOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SafetyOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { pluginLoader, type PluginManifest, type PluginPermission } from '@/lib/plugins/loader';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * 权限配置
 */
const PERMISSION_CONFIG: Record<PluginPermission, { icon: any; label: string; color: string; description: string }> = {
  storage: { icon: <ApiOutlined />, label: '本地存储', color: 'blue', description: '读写本地存储数据' },
  network: { icon: <ThunderboltOutlined />, label: '网络请求', color: 'purple', description: '发起网络请求' },
  ui: { icon: <EyeOutlined />, label: 'UI渲染', color: 'green', description: '显示UI组件和通知' },
  ai: { icon: <ThunderboltOutlined />, label: 'AI调用', color: 'orange', description: '调用AI生成接口' },
  file: { icon: <ApiOutlined />, label: '文件操作', color: 'red', description: '读写文件系统' },
  notification: { icon: <ApiOutlined />, label: '通知', color: 'cyan', description: '发送系统通知' },
};

/**
 * 插件管理页面
 */
export default function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [loading, setLoading] = useState(false);
  const [installVisible, setInstallVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginManifest | null>(null);
  const [form] = Form.useForm();

  /**
   * 加载插件列表
   */
  const loadPlugins = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/plugins/manifest');
      if (!response.ok) throw new Error('加载失败');

      const data = await response.json();
      setPlugins(data.plugins || []);
    } catch (error: any) {
      message.error(`加载失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  /**
   * 安装插件
   */
  const handleInstall = async () => {
    try {
      const values = await form.validateFields();

      // 解析清单
      const manifest: PluginManifest = JSON.parse(values.manifest);

      // 验证清单
      if (!manifest.id || !manifest.name || !manifest.version || !manifest.entry) {
        throw new Error('清单格式不正确，缺少必填字段');
      }

      // 调用加载器
      await pluginLoader.loadFromManifest(manifest);

      message.success(`插件 ${manifest.name} 安装成功`);
      setInstallVisible(false);
      form.resetFields();
      loadPlugins();
    } catch (error: any) {
      message.error(`安装失败: ${error.message}`);
    }
  };

  /**
   * 卸载插件
   */
  const handleUninstall = (plugin: PluginManifest) => {
    Modal.confirm({
      title: '确认卸载',
      content: `确定要卸载插件 "${plugin.name}" 吗？`,
      onOk: async () => {
        try {
          await pluginLoader.unload(plugin.id);
          message.success('插件已卸载');
          loadPlugins();
        } catch (error: any) {
          message.error(`卸载失败: ${error.message}`);
        }
      },
    });
  };

  /**
   * 重新加载插件
   */
  const handleReload = async (plugin: PluginManifest) => {
    try {
      await pluginLoader.reload(plugin.id);
      message.success('插件已重新加载');
      loadPlugins();
    } catch (error: any) {
      message.error(`重新加载失败: ${error.message}`);
    }
  };

  /**
   * 切换插件状态
   */
  const handleToggle = async (plugin: PluginManifest, enabled: boolean) => {
    try {
      if (enabled) {
        await pluginLoader.loadFromManifest(plugin);
      } else {
        await pluginLoader.unload(plugin.id);
      }

      message.success(enabled ? '插件已启用' : '插件已禁用');
      loadPlugins();
    } catch (error: any) {
      message.error(`操作失败: ${error.message}`);
    }
  };

  /**
   * 查看插件详情
   */
  const handleViewDetail = (plugin: PluginManifest) => {
    setSelectedPlugin(plugin);
    setDetailVisible(true);
  };

  /**
   * 获取插件统计
   */
  const getStats = () => {
    const stats = pluginLoader.getStats();
    return {
      total: plugins.length,
      enabled: plugins.filter((p) => p.enabled).length,
      loaded: stats.loaded,
    };
  };

  const stats = getStats();

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">总插件数</Text>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1890ff', marginTop: 8 }}>
                {stats.total}
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">已启用</Text>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#52c41a', marginTop: 8 }}>
                {stats.enabled}
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">已加载</Text>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: '#722ed1', marginTop: 8 }}>
                {stats.loaded}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 插件列表 */}
      <Card
        title={
          <Space>
            <AppstoreAddOutlined />
            <span>插件市场</span>
          </Space>
        }
        extra={
          <Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => setInstallVisible(true)}>
            安装插件
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          {loading ? (
            <Col span={24}>
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">加载中...</Text>
              </div>
            </Col>
          ) : plugins.length === 0 ? (
            <Col span={24}>
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">暂无插件</Text>
              </div>
            </Col>
          ) : (
            plugins.map((plugin) => (
              <Col xs={24} sm={12} md={8} key={plugin.id}>
                <Card
                  size="small"
                  hoverable
                  extra={
                    <Switch
                      size="small"
                      checked={plugin.enabled}
                      onChange={(checked) => handleToggle(plugin, checked)}
                    />
                  }
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar src={plugin.icon} size={48}>
                        {plugin.name[0]}
                      </Avatar>
                      <div style={{ flex: 1 }}>
                        <div>
                          <Text strong>{plugin.name}</Text>
                          <Tag color="blue" style={{ marginLeft: 8 }}>
                            v{plugin.version}
                          </Tag>
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {plugin.author || '未知作者'}
                        </Text>
                      </div>
                    </div>

                    <Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{ margin: 0, fontSize: 12 }}
                      type="secondary"
                    >
                      {plugin.description || '暂无描述'}
                    </Paragraph>

                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        权限:
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        <Space size={[4, 4]} wrap>
                          {plugin.permissions.map((permission) => {
                            const config = PERMISSION_CONFIG[permission];
                            return (
                              <Tooltip key={permission} title={config.description}>
                                <Tag
                                  icon={config.icon}
                                  color={config.color}
                                  style={{ fontSize: 11, margin: 0 }}
                                >
                                  {config.label}
                                </Tag>
                              </Tooltip>
                            );
                          })}
                        </Space>
                      </div>
                    </div>

                    <Divider style={{ margin: '8px 0' }} />

                    <Space size="small" style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space size="small">
                        <Tooltip title="查看详情">
                          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(plugin)} />
                        </Tooltip>
                        <Tooltip title="重新加载">
                          <Button size="small" icon={<ReloadOutlined />} onClick={() => handleReload(plugin)} />
                        </Tooltip>
                      </Space>
                      <Tooltip title="卸载">
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleUninstall(plugin)}
                        />
                      </Tooltip>
                    </Space>
                  </Space>
                </Card>
              </Col>
            ))
          )}
        </Row>
      </Card>

      {/* 安装插件对话框 */}
      <Modal
        title="安装插件"
        open={installVisible}
        onCancel={() => setInstallVisible(false)}
        onOk={handleInstall}
        width={600}
        okText="安装"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Alert
            message="安全提示"
            description="请只安装来自可信来源的插件。恶意插件可能会窃取您的数据或损害系统。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            label="插件清单（JSON）"
            name="manifest"
            rules={[{ required: true, message: '请输入插件清单' }]}
          >
            <TextArea
              rows={12}
              placeholder={JSON.stringify(
                {
                  id: 'my-plugin',
                  name: '我的插件',
                  version: '1.0.0',
                  description: '插件描述',
                  author: '作者名',
                  entry: 'https://example.com/plugin.js',
                  permissions: ['storage', 'ui'],
                  category: '工具',
                },
                null,
                2
              )}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 插件详情对话框 */}
      <Modal
        title="插件详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedPlugin && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Avatar src={selectedPlugin.icon} size={64}>
                {selectedPlugin.name[0]}
              </Avatar>
              <Title level={4} style={{ marginTop: 16, marginBottom: 4 }}>
                {selectedPlugin.name}
              </Title>
              <Text type="secondary">v{selectedPlugin.version}</Text>
            </div>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="插件ID">{selectedPlugin.id}</Descriptions.Item>
              <Descriptions.Item label="作者">{selectedPlugin.author || '未知'}</Descriptions.Item>
              <Descriptions.Item label="主页">
                {selectedPlugin.homepage ? (
                  <a href={selectedPlugin.homepage} target="_blank" rel="noopener noreferrer">
                    {selectedPlugin.homepage}
                  </a>
                ) : (
                  '无'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="分类">{selectedPlugin.category || '未分类'}</Descriptions.Item>
              <Descriptions.Item label="入口文件">{selectedPlugin.entry}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge
                  status={selectedPlugin.enabled ? 'success' : 'default'}
                  text={selectedPlugin.enabled ? '已启用' : '已禁用'}
                />
              </Descriptions.Item>
            </Descriptions>

            <Divider>权限</Divider>

            <Space direction="vertical" style={{ width: '100%' }}>
              {selectedPlugin.permissions.map((permission) => {
                const config = PERMISSION_CONFIG[permission];
                return (
                  <div key={permission} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SafetyOutlined style={{ color: config.color }} />
                    <Text strong>{config.label}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      - {config.description}
                    </Text>
                  </div>
                );
              })}
            </Space>

            {selectedPlugin.dependencies && Object.keys(selectedPlugin.dependencies).length > 0 && (
              <>
                <Divider>依赖</Divider>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {Object.entries(selectedPlugin.dependencies).map(([name, version]) => (
                    <div key={name}>
                      <Text code>{name}</Text>
                      <Text type="secondary"> @ {version}</Text>
                    </div>
                  ))}
                </Space>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
