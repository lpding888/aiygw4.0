'use client';

import { motion } from 'framer-motion';
import { Button, Space } from 'antd';
import { RocketOutlined, PlayCircleOutlined, CheckCircleFilled } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

export default function HeroSection() {
    const router = useRouter();

    return (
        <div className="relative min-h-screen flex items-center overflow-hidden bg-[#0f172a] pt-20">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-[40%] -right-[10%] w-[800px] h-[800px] rounded-full bg-gradient-to-br from-purple-600/20 to-blue-600/20 blur-3xl" />
                <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-orange-500/10 to-pink-500/10 blur-3xl" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />
            </div>

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <span className="text-sm font-medium text-gray-300">AI 驱动的电商影像革命</span>
                        </div>

                        <h1 className="text-5xl lg:text-7xl font-bold text-white leading-tight mb-6">
                            重塑服装电商
                            <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                                影像生产力
                            </span>
                        </h1>

                        <p className="text-xl text-gray-400 mb-8 leading-relaxed max-w-xl">
                            告别昂贵的模特拍摄，AI 自动生成高品质商拍图。
                            <br />
                            成本降低 <span className="text-white font-semibold">90%</span>，
                            上新速度提升 <span className="text-white font-semibold">10倍</span>。
                        </p>

                        <div className="flex flex-wrap gap-4 mb-12">
                            <Button
                                type="primary"
                                size="large"
                                icon={<RocketOutlined />}
                                onClick={() => router.push('/login')}
                                className="!h-14 !px-8 !text-lg !rounded-full !bg-gradient-to-r !from-blue-600 !to-purple-600 !border-0 hover:!opacity-90 !shadow-lg !shadow-blue-500/30"
                            >
                                免费开始使用
                            </Button>
                            <Button
                                size="large"
                                icon={<PlayCircleOutlined />}
                                className="!h-14 !px-8 !text-lg !rounded-full !bg-white/5 !border-white/10 !text-white hover:!bg-white/10"
                            >
                                观看演示
                            </Button>
                        </div>

                        <div className="flex items-center gap-8 text-gray-400 text-sm font-medium">
                            <div className="flex items-center gap-2">
                                <CheckCircleFilled className="text-blue-500" />
                                <span>10万+ 商家信赖</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircleFilled className="text-purple-500" />
                                <span>500万+ 图片处理</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Visual */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="relative"
                    >
                        <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-purple-500/20 bg-[#1e293b]">
                            {/* Placeholder for Split Screen Comparison */}
                            <div className="aspect-[4/3] relative group">
                                {/* Before Image (Left Half) */}
                                <div className="absolute inset-y-0 left-0 w-1/2 bg-gray-800 overflow-hidden border-r border-white/10 z-10">
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 flex-col gap-4">
                                        <div className="w-32 h-40 bg-gray-700 rounded-lg animate-pulse"></div>
                                        <span>原始平铺图</span>
                                    </div>
                                </div>

                                {/* After Image (Full, but revealed by slider logic visually here just as a static demo for now) */}
                                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                                    {/* This would be the "After" image */}
                                    <div className="text-center">
                                        <div className="w-full h-full absolute inset-0 bg-[url('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-80"></div>
                                        <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur px-4 py-2 rounded-lg text-white text-sm font-medium border border-white/10">
                                            AI 生成效果
                                        </div>
                                    </div>
                                </div>

                                {/* Slider Handle (Visual Only) */}
                                <div className="absolute inset-y-0 left-1/2 w-1 bg-white cursor-ew-resize z-20 shadow-[0_0_20px_rgba(255,255,255,0.5)]">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-900">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Elements */}
                        <motion.div
                            animate={{ y: [0, -20, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -top-12 -right-12 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-xl"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                                    <RocketOutlined />
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400">效率提升</div>
                                    <div className="text-lg font-bold text-white">+1000%</div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            animate={{ y: [0, 20, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                            className="absolute -bottom-8 -left-8 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-xl"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                    <RocketOutlined />
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400">成本节省</div>
                                    <div className="text-lg font-bold text-white">90%</div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
