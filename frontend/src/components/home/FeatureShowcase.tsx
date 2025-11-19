'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ScissorOutlined,
    UserOutlined,
    VideoCameraOutlined,
    CheckCircleFilled,
    ArrowRightOutlined,
    FireOutlined
} from '@ant-design/icons';
import { Button, Tag } from 'antd';

// Feature Data (Simplified for display)
const features = [
    {
        id: 'basic',
        title: '基础处理',
        icon: <ScissorOutlined />,
        desc: '智能抠图、背景替换、画质增强',
        items: [
            { name: '智能抠图', status: 'available', hot: false, desc: '发丝级精细抠图' },
            { name: '背景替换', status: 'coming', hot: false, desc: '海量场景一键替换' },
            { name: '图片增强', status: 'coming', hot: false, desc: '低清变高清' },
            { name: '一键详情页', status: 'coming', hot: true, desc: '自动排版生成' },
        ]
    },
    {
        id: 'model',
        title: 'AI 模特',
        icon: <UserOutlined />,
        desc: '真人/假人模特一键生成',
        items: [
            { name: 'AI模特上身', status: 'available', hot: true, desc: '12种姿势任意选' },
            { name: '千姿引擎', status: 'coming', hot: true, desc: '一张图变多姿态' },
            { name: '自定义模特', status: 'coming', hot: false, desc: '复刻专属模特' },
            { name: '鞋模上脚', status: 'coming', hot: true, desc: '鞋靴类目专用' },
        ]
    },
    {
        id: 'video',
        title: '视频生成',
        icon: <VideoCameraOutlined />,
        desc: '静态图转动态展示视频',
        items: [
            { name: '服装展示视频', status: 'coming', hot: true, desc: '360度动态展示' },
            { name: '模特走秀视频', status: 'coming', hot: false, desc: 'T台走秀效果' },
        ]
    }
];

export default function FeatureShowcase() {
    const [activeTab, setActiveTab] = useState('basic');

    return (
        <section className="py-24 bg-gray-50">
            <div className="container mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        全方位满足
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600"> 电商影像需求</span>
                    </h2>
                    <p className="text-gray-500 text-lg">
                        从基础修图到 AI 模特，一站式解决所有痛点
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex justify-center gap-4 mb-12">
                    {features.map((feature) => (
                        <button
                            key={feature.id}
                            onClick={() => setActiveTab(feature.id)}
                            className={`px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${activeTab === feature.id
                                    ? 'bg-gray-900 text-white shadow-lg scale-105'
                                    : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                                }`}
                        >
                            {feature.icon}
                            {feature.title}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[500px]">
                    {/* Left: Feature List */}
                    <AnimatePresence mode='wait'>
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6"
                        >
                            {features.find(f => f.id === activeTab)?.items.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`group p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${item.status === 'available'
                                            ? 'bg-white border-gray-100 hover:border-blue-500 hover:shadow-md'
                                            : 'bg-gray-50 border-transparent opacity-70'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                                            {item.hot && <Tag color="red" className="rounded-full px-2 scale-90"><FireOutlined /> HOT</Tag>}
                                            {item.status === 'coming' && <Tag className="rounded-full px-2 scale-90">即将上线</Tag>}
                                        </div>
                                        {item.status === 'available' && (
                                            <ArrowRightOutlined className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                        )}
                                    </div>
                                    <p className="text-gray-500 text-sm">{item.desc}</p>
                                </div>
                            ))}
                        </motion.div>
                    </AnimatePresence>

                    {/* Right: Interactive Demo (Placeholder for now) */}
                    <motion.div
                        layoutId="demo-container"
                        className="relative h-[500px] bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-800"
                    >
                        <div className="absolute inset-0 flex items-center justify-center">
                            {activeTab === 'basic' && (
                                <div className="text-center">
                                    <div className="text-6xl mb-4">✂️</div>
                                    <h3 className="text-2xl font-bold text-white mb-2">智能抠图演示</h3>
                                    <p className="text-gray-400">拖动滑块查看去背效果</p>
                                    {/* Visual representation of slider */}
                                    <div className="mt-8 w-64 h-2 bg-gray-700 rounded-full mx-auto relative">
                                        <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-blue-500 rounded-full"></div>
                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow cursor-pointer"></div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'model' && (
                                <div className="text-center">
                                    <div className="text-6xl mb-4">💃</div>
                                    <h3 className="text-2xl font-bold text-white mb-2">AI 模特演示</h3>
                                    <p className="text-gray-400">点击切换不同模特</p>
                                    <div className="flex gap-4 mt-8 justify-center">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-12 h-12 rounded-full bg-gray-700 border-2 border-transparent hover:border-blue-500 cursor-pointer transition-colors"></div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {activeTab === 'video' && (
                                <div className="text-center">
                                    <div className="text-6xl mb-4">🎬</div>
                                    <h3 className="text-2xl font-bold text-white mb-2">视频生成演示</h3>
                                    <p className="text-gray-400">即将上线，敬请期待</p>
                                </div>
                            )}
                        </div>

                        {/* Overlay Gradient */}
                        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
