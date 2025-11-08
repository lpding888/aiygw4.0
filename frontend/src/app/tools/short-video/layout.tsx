/**
 * AI短视频页面Layout
 * 提供SEO metadata
 */

import { Metadata } from 'next';
import { generateMetadata } from '@/lib/seo';

export const metadata: Metadata = generateMetadata({
  title: 'AI带货短视频',
  description:
    'AI驱动的带货短视频生成工具，自动生成脚本、智能分镜、片头片尾模板，快速制作专业的服装带货视频',
  keywords: [
    'AI短视频',
    '带货视频',
    '短视频生成',
    '视频脚本',
    '分镜管理',
    '服装视频',
    '电商视频',
  ],
  path: '/tools/short-video',
  image: '/og-short-video.png',
});

export default function ShortVideoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
