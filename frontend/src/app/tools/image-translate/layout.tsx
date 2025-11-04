/**
 * 图片翻译页面Layout
 * 提供SEO metadata
 */

import { Metadata } from 'next';
import { generateMetadata } from '@/lib/seo';

export const metadata: Metadata = generateMetadata({
  title: '图片翻译',
  description:
    'AI图片翻译工具，智能OCR识别、多语言翻译、布局保留，支持中英日韩西等6种语言互译，快速生成多语言版本的服装图片',
  keywords: [
    '图片翻译',
    'OCR识别',
    '多语言翻译',
    '服装图片翻译',
    '文字识别',
    '布局保留',
    '跨境电商',
  ],
  path: '/tools/image-translate',
  image: '/og-image-translate.png',
});

export default function ImageTranslateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
