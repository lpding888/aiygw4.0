'use client';

import { motion } from 'framer-motion';
import { CloudUploadOutlined, ThunderboltOutlined, DownloadOutlined } from '@ant-design/icons';

const steps = [
    {
        icon: <CloudUploadOutlined />,
        title: '上传图片',
        desc: '支持平铺图、挂拍图或模特图',
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
    },
    {
        icon: <ThunderboltOutlined />,
        title: 'AI 生成',
        desc: '选择模特和场景，一键生成',
        color: 'text-purple-500',
        bg: 'bg-purple-500/10',
    },
    {
        icon: <DownloadOutlined />,
        title: '下载成品',
        desc: '获取 4K 超清商用大图',
        color: 'text-green-500',
        bg: 'bg-green-500/10',
    },
];

export default function WorkflowSection() {
    return (
        <section className="py-24 bg-white">
            <div className="container mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        只需三步，<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">轻松出片</span>
                    </h2>
                    <p className="text-gray-500 text-lg">
                        极简的操作流程，让设计更专注，让上新更高效
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 relative">
                    {/* Connecting Line (Desktop) */}
                    <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-100 via-purple-100 to-green-100 -z-10" />

                    {steps.map((step, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.2 }}
                            className="relative bg-white p-8 rounded-2xl border border-gray-100 shadow-lg hover:shadow-xl transition-shadow text-center group"
                        >
                            <div className={`w-24 h-24 mx-auto rounded-full ${step.bg} flex items-center justify-center text-4xl ${step.color} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                {step.icon}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                            <p className="text-gray-500">{step.desc}</p>

                            {/* Step Number Badge */}
                            <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center font-bold text-sm border border-gray-100">
                                {idx + 1}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
