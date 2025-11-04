/**
 * PERF-P2-SSR-204: XYFlow Pipeline Editor懒加载wrapper
 * 艹!XYFlow这个流程图库也不小(~500KB),懒加载优化!
 *
 * @author 老王
 */

'use client';

import dynamic from 'next/dynamic';
import { Spin } from 'antd';
import type { ComponentType } from 'react';

// 艹!懒加载Pipeline Editor(基于XYFlow)
const PipelineEditor = dynamic(
  () => import('@/components/admin/FeatureWizard/PipelineEditorStep').then(mod => mod.default),
  {
    loading: () => (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '600px',
        background: '#fafafa',
        borderRadius: '6px',
        border: '2px dashed #d9d9d9'
      }}>
        <Spin size="large" tip="加载流程编辑器中..." />
      </div>
    ),
    ssr: false, // 艹!XYFlow依赖浏览器API,必须客户端渲染
  }
);

export default PipelineEditor as ComponentType<any>;
