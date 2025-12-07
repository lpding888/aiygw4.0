'use client';

import { useState, useEffect } from 'react';
import { Layout, Menu, Breadcrumb, Avatar, Dropdown, Space, Button, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useRouter, usePathname } from 'next/navigation';
import {
    DashboardOutlined,
    UserOutlined,
    AppstoreOutlined,
    SettingOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    SafetyCertificateOutlined,
    DollarOutlined,
    RocketOutlined,
    FileTextOutlined,
    ThunderboltOutlined,
    ToolOutlined,
    ShopOutlined,
    ApiOutlined,
    DatabaseOutlined,
    ScheduleOutlined,
    BgColorsOutlined,
    LinkOutlined,
    ExperimentOutlined,
    CodeOutlined,
    BarChartOutlined,
    FunnelPlotOutlined,
    MessageOutlined,
    NotificationOutlined,
    PictureOutlined,
    SoundOutlined,
    NodeIndexOutlined,
    GiftOutlined,
    HddOutlined,
    BugOutlined,
    KeyOutlined,
    ReadOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { ADMIN_BRAND, getBreadcrumbItems, getMenuOpenKeys } from '@/config/admin';

const { Header, Sider, Content } = Layout;

interface ProAdminLayoutProps {
    children: React.ReactNode;
}

export default function ProAdminLayout({ children }: ProAdminLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout } = useAuthStore();
    const [collapsed, setCollapsed] = useState(false);
    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    // 权限检查
    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }
        if (user.role !== 'admin') {
            router.push('/workspace');
            return;
        }
    }, [user, router]);

    // 菜单配置 (重构后)
    const menuItems = [
        {
            key: '/admin/dashboard',
            icon: <DashboardOutlined />,
            label: '仪表盘',
        },
        // AI 智能工厂 (AI Factory)
        {
            key: 'ai-factory',
            icon: <ThunderboltOutlined />,
            label: 'AI 智能工厂',
            children: [
                {
                    key: '/admin/architect',
                    icon: <ThunderboltOutlined />,
                    label: 'AI Architect (智能生成)',
                },
                {
                    key: '/admin/pipelines/editor',
                    icon: <RocketOutlined />,
                    label: '积木编排 (Pipeline)',
                },
                {
                    key: '/admin/providers',
                    icon: <ToolOutlined />,
                    label: '技能管理 (Providers)',
                },
                {
                    key: '/admin/mcp',
                    icon: <ApiOutlined />,
                    label: 'MCP 服务 (Endpoints)',
                },
                {
                    key: '/admin/prompts',
                    icon: <FileTextOutlined />,
                    label: '提示词 (Prompts)',
                },
                {
                    key: '/admin/kb',
                    icon: <DatabaseOutlined />,
                    label: '知识库 (RAG)',
                },
                {
                    key: '/admin/style-kits',
                    icon: <BgColorsOutlined />,
                    label: '风格包 (Style Kits)',
                },
            ],
        },
        // 数据洞察 (Data & Insights)
        {
            key: 'data-insights',
            icon: <BarChartOutlined />,
            label: '数据洞察',
            children: [
                {
                    key: '/admin/analytics/funnel',
                    icon: <FunnelPlotOutlined />,
                    label: '转化漏斗',
                },
                {
                    key: '/admin/feedback',
                    icon: <MessageOutlined />,
                    label: '用户反馈',
                },
            ],
        },
        // 运营中心 (Marketing & Ops)
        {
            key: 'marketing-ops',
            icon: <NotificationOutlined />,
            label: '运营中心',
            children: [
                {
                    key: '/admin/invite-codes',
                    icon: <GiftOutlined />,
                    label: '邀请码管理',
                },
                {
                    key: '/admin/experiments',
                    icon: <ExperimentOutlined />,
                    label: 'A/B 实验',
                },
                {
                    key: '/admin/catalog',
                    icon: <ShopOutlined />,
                    label: '类目管理',
                },
                {
                    key: '/admin/banners',
                    icon: <PictureOutlined />,
                    label: 'Banner 管理',
                },
                {
                    key: '/admin/announcements',
                    icon: <SoundOutlined />,
                    label: '公告管理',
                },
            ],
        },
        // 应用管理 (App Store)
        {
            key: 'app-management',
            icon: <AppstoreOutlined />,
            label: '应用商店',
            children: [
                {
                    key: '/admin/features',
                    icon: <ShopOutlined />,
                    label: '已上架应用',
                },
                {
                    key: '/admin/features/new',
                    label: '应用上架',
                },
            ],
        },
        {
            key: 'user-center',
            icon: <UserOutlined />,
            label: '用户中心',
            children: [
                {
                    key: '/admin/users',
                    label: '用户管理',
                },
                {
                    key: '/admin/distributors',
                    icon: <DollarOutlined />,
                    label: '分销管理',
                },
                {
                    key: '/admin/withdrawals',
                    label: '提现审核',
                },
            ],
        },
        {
            key: 'system-ops',
            icon: <SettingOutlined />,
            label: '系统运维',
            children: [
                {
                    key: '/admin/system/circuit-breaker',
                    icon: <ThunderboltOutlined />,
                    label: '熔断器监控',
                },
                {
                    key: '/admin/system/cache',
                    icon: <HddOutlined />,
                    label: '缓存管理',
                },
                {
                    key: '/admin/system/config',
                    label: '系统配置',
                },
                {
                    key: '/admin/system/errors',
                    icon: <BugOutlined />,
                    label: '错误日志',
                },
                {
                    key: '/admin/system/kms',
                    icon: <KeyOutlined />,
                    label: '密钥管理',
                },
                {
                    key: '/admin/system/docs',
                    icon: <ReadOutlined />,
                    label: '接口文档',
                },
                {
                    key: '/admin/rules',
                    icon: <NodeIndexOutlined />,
                    label: '规则引擎',
                },
                {
                    key: '/admin/webhooks',
                    icon: <LinkOutlined />,
                    label: 'Webhooks',
                },
                {
                    key: '/admin/system/audit',
                    icon: <SafetyCertificateOutlined />,
                    label: '审计日志',
                },
                {
                    key: '/admin/queues',
                    icon: <ScheduleOutlined />,
                    label: '消息队列',
                },
                {
                    key: '/admin/template-tester',
                    icon: <CodeOutlined />,
                    label: '模板调试器',
                },
            ],
        },
    ];

    // 用户下拉菜单 - 使用 MenuProps 类型
    const userMenuItems: MenuProps['items'] = [
        {
            key: 'workspace',
            label: '返回工作台',
            icon: <AppstoreOutlined />,
            onClick: () => router.push('/workspace'),
        },
        {
            type: 'divider',
        },
        {
            key: 'logout',
            label: '退出登录',
            icon: <LogoutOutlined />,
            danger: true,
            onClick: () => {
                logout();
                router.push('/login');
            },
        },
    ];

    // 获取当前选中的菜单键
    const getSelectedKeys = () => {
        if (!pathname) return [];
        if (pathname === '/admin/dashboard') return ['/admin/dashboard'];
        return [pathname];
    };

    // 获取当前展开的菜单键 - 使用配置
    const getOpenKeys = () => {
        // 如果在编辑器页面，自动展开 AI 工厂
        if (pathname.startsWith('/admin/pipelines')) return ['ai-factory'];
        return getMenuOpenKeys(pathname);
    };

    if (!user || user.role !== 'admin') return null;

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                width={260}
                style={{
                    background: '#000000', // 纯黑背景，对比度更高
                    borderRight: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <div style={{
                    height: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '0' : '0 24px',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                }}>
                    <div style={{
                        width: 32,
                        height: 32,
                        background: ADMIN_BRAND.LOGO_GRADIENT,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: 20,
                        flexShrink: 0
                    }}>
                        {ADMIN_BRAND.LOGO_LETTER}
                    </div>
                    {!collapsed && (
                        <span style={{
                            color: 'white',
                            fontSize: 18,
                            fontWeight: 600,
                            marginLeft: 12,
                            whiteSpace: 'nowrap',
                            letterSpacing: '-0.02em'
                        }}>
                            {ADMIN_BRAND.APP_NAME} <span style={{ opacity: 0.5, fontWeight: 400 }}>{ADMIN_BRAND.APP_SUFFIX}</span>
                        </span>
                    )}
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    defaultSelectedKeys={getSelectedKeys()}
                    defaultOpenKeys={getOpenKeys()}
                    selectedKeys={getSelectedKeys()}
                    items={menuItems}
                    onClick={({ key }) => router.push(key)}
                    style={{
                        background: 'transparent',
                        borderRight: 'none',
                        padding: '0 12px'
                    }}
                />
            </Sider>
            <Layout className="mesh-bg">
                <Header style={{
                    padding: '0 24px',
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    height: 64,
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    transition: 'all 0.3s ease'
                }}>
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={() => setCollapsed(!collapsed)}
                        style={{
                            fontSize: '16px',
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                        }}
                    />

                    <Space size="large">
                        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                            <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 12, transition: 'background 0.2s' }} className="hover:bg-black/5">
                                <Avatar src={user.avatar} icon={<UserOutlined />} style={{ backgroundColor: '#1D1D1F' }} />
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{user.nickname || user.username}</span>
                            </Space>
                        </Dropdown>
                    </Space>
                </Header>
                <Content style={{ margin: '24px', minHeight: 280 }}>
                    {/* 面包屑导航 - 使用配置映射 */}
                    <Breadcrumb
                        style={{ marginBottom: 24 }}
                        items={getBreadcrumbItems(pathname).map(item => ({
                            title: item.title,
                            href: item.path,
                        }))}
                    />

                    <div className="animate-fade-up">
                        {children}
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
}
