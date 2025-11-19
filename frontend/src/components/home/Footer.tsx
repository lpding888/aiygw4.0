'use client';

import {
    RocketOutlined,
    GithubOutlined,
    TwitterOutlined,
    WechatOutlined
} from '@ant-design/icons';

export default function Footer() {
    return (
        <footer className="bg-gray-900 text-white pt-24 pb-12">
            <div className="container mx-auto px-6">
                <div className="grid md:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2 mb-6">
                            <RocketOutlined className="text-2xl text-blue-500" />
                            <span className="text-xl font-bold">AI 衣柜</span>
                        </div>
                        <p className="text-gray-400 max-w-sm mb-8">
                            专业的服装 AI 处理平台，致力于为电商卖家提供高效、低成本的影像解决方案。
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-blue-500 transition-colors">
                                <TwitterOutlined />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-gray-700 transition-colors">
                                <GithubOutlined />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-green-500 transition-colors">
                                <WechatOutlined />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold mb-6">产品</h4>
                        <ul className="space-y-4 text-gray-400">
                            <li><a href="#" className="hover:text-white transition-colors">智能抠图</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">AI 模特</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">视频生成</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">价格方案</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold mb-6">公司</h4>
                        <ul className="space-y-4 text-gray-400">
                            <li><a href="#" className="hover:text-white transition-colors">关于我们</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">联系方式</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">隐私政策</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">服务条款</a></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-500 text-sm">
                    <div>
                        © 2024 AI 衣柜. All rights reserved.
                    </div>
                    <div className="flex gap-8">
                        <span>京ICP备88888888号</span>
                        <span>Powered by Gemini</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
