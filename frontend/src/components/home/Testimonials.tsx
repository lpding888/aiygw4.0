'use client';

import { StarFilled } from '@ant-design/icons';

export default function Testimonials() {
    return (
        <section className="py-24 bg-white border-t border-gray-100">
            <div className="container mx-auto px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="flex justify-center gap-1 text-yellow-400 mb-8">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <StarFilled key={i} className="text-2xl" />
                        ))}
                    </div>

                    <blockquote className="text-3xl md:text-4xl font-medium text-gray-900 leading-relaxed mb-12">
                        &quot;自从使用了 AI 衣柜，我们的上新速度提升了 5 倍，而模特拍摄成本却降低了 90%。这简直是服装电商的神器！&quot;
                    </blockquote>

                    <div className="flex items-center justify-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                            {/* Avatar placeholder */}
                            <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600"></div>
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-gray-900">Sarah Chen</div>
                            <div className="text-gray-500">某知名女装品牌主理人</div>
                        </div>
                    </div>
                </div>

                {/* Partner Logos */}
                <div className="mt-24 pt-12 border-t border-gray-100">
                    <p className="text-center text-gray-400 text-sm font-medium mb-8 uppercase tracking-widest">
                        Trusted by 10,000+ Brands
                    </p>
                    <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Logo Placeholders with text for now */}
                        <div className="text-2xl font-bold font-serif">VOGUE</div>
                        <div className="text-2xl font-bold font-sans tracking-tighter">SHEIN</div>
                        <div className="text-2xl font-bold font-mono">ZARA</div>
                        <div className="text-2xl font-bold font-serif italic">H&M</div>
                        <div className="text-2xl font-bold font-sans">UNIQLO</div>
                    </div>
                </div>
            </div>
        </section>
    );
}
