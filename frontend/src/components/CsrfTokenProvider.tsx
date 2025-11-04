/**
 * CSRF Token Provider
 * 艹!在页面中注入CSRF token的meta标签!
 *
 * 使用方法:
 * 1. 在服务端生成token
 * 2. 通过此组件注入到HTML
 * 3. 客户端通过useCsrfToken获取
 *
 * @author 老王
 */

'use client';

import { useEffect } from 'react';

interface CsrfTokenProviderProps {
  token: string;
}

/**
 * CSRF Token Provider组件
 * 将token注入到meta标签中
 */
export function CsrfTokenProvider({ token }: CsrfTokenProviderProps) {
  useEffect(() => {
    // 检查是否已存在meta标签
    let meta = document.querySelector('meta[name="csrf-token"]');

    if (!meta) {
      // 创建新的meta标签
      meta = document.createElement('meta');
      meta.setAttribute('name', 'csrf-token');
      document.head.appendChild(meta);
    }

    // 设置token
    meta.setAttribute('content', token);

    return () => {
      // 清理:移除meta标签
      meta?.remove();
    };
  }, [token]);

  return null; // 不渲染任何内容
}
