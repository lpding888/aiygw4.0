/**
 * Lookbook生成页面Layout
 * 提供SEO metadata
 */

import { Metadata } from 'next';
import { generateMetadata } from '@/lib/seo';

export const metadata: Metadata = generateMetadata({
  title: 'Lookbook生成',
  description:
    '一键生成专业的服装Lookbook，支持多SKU选择、智能排版、多种尺寸比例，快速导出高质量的产品展示图册',
  keywords: [
    'Lookbook生成',
    '服装Lookbook',
    '产品图册',
    'SKU组合',
    '智能排版',
    '服装展示',
    '电商图片',
  ],
  path: '/workspace/lookbook',
  image: '/og-lookbook.png',
});

export default function LookbookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
