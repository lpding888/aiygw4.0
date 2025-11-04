/**
 * PERF-P2-SSR-204: FormIO Builder懒加载wrapper
 * 艹!FormIO这个憨批也很大(~2MB),必须懒加载!
 *
 * @author 老王
 */

'use client';

import dynamic from 'next/dynamic';
import { Spin } from 'antd';
import type { ComponentType } from 'react';

// 艹!懒加载FormIO Builder,减少首包体积!
const FormBuilder = dynamic(
  () => import('@/components/formio/FormBuilder').then(mod => mod.default),
  {
    loading: () => (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '500px',
        background: '#f5f5f5',
        borderRadius: '6px',
        border: '1px dashed #d9d9d9'
      }}>
        <Spin size="large" tip="加载表单构建器中..." />
      </div>
    ),
    ssr: false, // 艹!FormIO依赖DOM API,不支持SSR
  }
);

export default FormBuilder as ComponentType<any>;
