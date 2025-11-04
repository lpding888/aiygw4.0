/**
 * PERF-P2-SSR-204: Monaco Editor懒加载wrapper
 * 艹!这个SB Monaco Editor太大了(~3MB),必须懒加载!
 *
 * @author 老王
 */

'use client';

import dynamic from 'next/dynamic';
import { Spin } from 'antd';
import type { EditorProps } from '@monaco-editor/react';

// 艹!懒加载Monaco Editor,首包JS立减3MB!
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  loading: () => (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '400px',
      background: '#f5f5f5',
      borderRadius: '6px'
    }}>
      <Spin size="large" tip="加载编辑器中..." />
    </div>
  ),
  ssr: false, // 艹!Monaco不支持SSR,客户端渲染
});

export default function MonacoEditorLazy(props: EditorProps) {
  return <MonacoEditor {...props} />;
}
