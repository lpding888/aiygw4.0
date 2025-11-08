/**
 * 模板中心页面Layout
 * 提供SEO metadata
 */

import { Metadata } from 'next';
import { generateMetadata } from '@/lib/seo';

export const metadata: Metadata = generateMetadata({
  title: '模板中心',
  description:
    '浏览和使用专业的服装图片处理模板，包括基础修图、AI模特上身、Lookbook生成等多种模板，快速提升工作效率',
  keywords: [
    '模板中心',
    '服装模板',
    'AI模板',
    '修图模板',
    'Lookbook模板',
    '服装处理模板',
  ],
  path: '/workspace/templates',
  image: '/og-templates.png',
});

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
