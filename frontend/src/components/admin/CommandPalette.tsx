'use client';

import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Select, Input, Empty } from 'antd';
import {
    DashboardOutlined,
    UserOutlined,
    RocketOutlined,
    SettingOutlined,
    LogoutOutlined,
    SearchOutlined,
    ThunderboltOutlined,
    ToolOutlined,
    ApiOutlined,
    FileTextOutlined,
    DatabaseOutlined
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';

// Context to control the palette from anywhere
const CommandPaletteContext = createContext<{ openPalette: () => void } | null>(null);

export const useCommandPalette = () => {
    const context = useContext(CommandPaletteContext);
    if (!context) {
        throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
    }
    return context;
};

interface Action {
    id: string;
    name: string;
    section: string;
    icon?: React.ReactNode;
    perform: () => void;
}

export default function CommandPalette({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const router = useRouter();
    const { logout } = useAuthStore();
    // Use any for ref to avoid strict typing issues with Select styling
    const selectRef = useRef<any>(null);

    const openPalette = () => setIsOpen(true);
    const closePalette = () => {
        setIsOpen(false);
        setSearchText('');
    };

    // Actions Configuration
    const actions: Action[] = [
        { id: '/admin/dashboard', name: '仪表盘 (Dashboard)', section: '导航', icon: <DashboardOutlined />, perform: () => router.push('/admin/dashboard') },
        { id: '/admin/users', name: '用户管理 (Users)', section: '导航', icon: <UserOutlined />, perform: () => router.push('/admin/users') },
        { id: '/admin/pipelines/editor', name: '工作流编排 (Pipelines)', section: 'AI 工厂', icon: <RocketOutlined />, perform: () => router.push('/admin/pipelines/editor') },
        { id: '/admin/architect', name: 'AI Architect', section: 'AI 工厂', icon: <ThunderboltOutlined />, perform: () => router.push('/admin/architect') },
        { id: '/admin/providers', name: '模型服务 (Providers)', section: 'AI 工厂', icon: <ToolOutlined />, perform: () => router.push('/admin/providers') },
        { id: '/admin/mcp', name: 'MCP 服务', section: 'AI 工厂', icon: <ApiOutlined />, perform: () => router.push('/admin/mcp') },
        { id: '/admin/prompts', name: '提示词管理', section: 'AI 工厂', icon: <FileTextOutlined />, perform: () => router.push('/admin/prompts') },
        { id: '/admin/kb', name: '知识库 (RAG)', section: 'AI 工厂', icon: <DatabaseOutlined />, perform: () => router.push('/admin/kb') },
        { id: '/admin/system/config', name: '系统配置', section: '系统', icon: <SettingOutlined />, perform: () => router.push('/admin/system/config') },
        {
            id: 'logout',
            name: '退出登录',
            section: '账户',
            icon: <LogoutOutlined />,
            perform: () => {
                logout();
                router.push('/login');
            }
        },
    ];

    // Keyboard Shortcut Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Filter actions
    const filteredActions = actions.filter(action =>
        action.name.toLowerCase().includes(searchText.toLowerCase()) ||
        action.section.toLowerCase().includes(searchText.toLowerCase())
    );

    // Group options for Select
    const options = Object.values(filteredActions.reduce((acc, action) => {
        let group = acc[action.section];
        if (!group) {
            group = { label: action.section, options: [] };
            acc[action.section] = group;
        }
        group.options.push({
            value: action.id,
            label: (
                <div className="flex items-center gap-2 py-1">
                    <span className="text-gray-400 text-lg">{action.icon}</span>
                    <span className="font-medium text-gray-700">{action.name}</span>
                </div>
            ),
            action: action // Store action ref
        });
        return acc;
    }, {} as Record<string, { label: string, options: any[] }>));

    const handleSelect = (value: string, option: any) => {
        option.action.perform();
        closePalette();
    };

    return (
        <CommandPaletteContext.Provider value={{ openPalette }}>
            {children}
            <Modal
                open={isOpen}
                onCancel={closePalette}
                footer={null}
                closable={false}
                maskClosable={true}
                destroyOnClose
                centered
                width={600}
                styles={{
                    content: {
                        padding: 0,
                        borderRadius: 16,
                        overflow: 'hidden',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }
                }}
                modalRender={(modal) => (
                    <div className="command-palette-modal">
                        {modal}
                    </div>
                )}
            >
                <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                    <SearchOutlined className="text-gray-400 text-xl" />
                    <Input
                        placeholder="输入命令或搜索..."
                        variant="borderless"
                        className="text-lg p-0 !bg-transparent focus:!shadow-none placeholder:text-gray-400"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        autoFocus
                    />
                    <div className="flex gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                        <span>ESC</span>
                    </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2">
                    {filteredActions.length === 0 ? (
                        <div className="py-8 text-center text-gray-400">无匹配结果</div>
                    ) : (
                        <div className="space-y-1">
                            {options.map((group: any) => (
                                <div key={group.label}>
                                    <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        {group.label}
                                    </div>
                                    {group.options.map((opt: any) => (
                                        <div
                                            key={opt.value}
                                            className="px-3 py-3 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors flex items-center gap-3 group"
                                            onClick={() => handleSelect(opt.value, opt)}
                                        >
                                            <span className="text-gray-400 group-hover:text-blue-500 transition-colors text-lg">
                                                {opt.action.icon}
                                            </span>
                                            <span className="text-gray-600 group-hover:text-gray-900 font-medium">
                                                {opt.action.name}
                                            </span>
                                            {opt.action.id === 'logout' && <span className="ml-auto text-xs text-red-400">Enter</span>}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </CommandPaletteContext.Provider>
    );
}
