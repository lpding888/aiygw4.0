/**
 * 全局错误处理Provider
 * 艹！监听全局错误事件并自动显示友好的错误提示！
 */

'use client';

import React, { useEffect } from 'react';
import { message, notification } from 'antd';
import type { NormalizedError } from '@/hooks/useErrorNotification';

/**
 * 错误Provider Props
 */
interface ErrorProviderProps {
  children: React.ReactNode;
}

/**
 * 全局错误Provider组件
 * 艹！监听自定义错误事件并自动显示通知！
 */
export const ErrorProvider: React.FC<ErrorProviderProps> = ({ children }) => {
  useEffect(() => {
    /**
     * 处理全局错误事件
     */
    const handleGlobalError = (event: CustomEvent<NormalizedError>) => {
      const error = event.detail;

      // 根据severity确定样式
      const getSeverityType = (severity?: string): 'error' | 'warning' | 'info' => {
        if (severity === 'critical' || severity === 'high') {
          return 'error';
        }
        if (severity === 'medium') {
          return 'warning';
        }
        return 'info';
      };

      const type = getSeverityType(error.severity);

      // Critical和High级别使用notification（更醒目）
      if (error.severity === 'critical' || error.severity === 'high') {
        const description = [
          `错误代码: ${error.code}`,
          error.category && `类别: ${error.category}`,
          error.requestId && `请求ID: ${error.requestId}`,
        ]
          .filter(Boolean)
          .join(' | ');

        notification[type]({
          message: error.message,
          description,
          duration: error.severity === 'critical' ? 8 : 4.5,
          placement: 'topRight',
        });
      } else {
        // 其他级别使用message（简洁）
        const content = `${error.message} (代码: ${error.code})`;
        message[type](content, 3);
      }
    };

    // 监听自定义错误事件
    window.addEventListener('app-error', handleGlobalError as EventListener);

    return () => {
      window.removeEventListener('app-error', handleGlobalError as EventListener);
    };
  }, []);

  return <>{children}</>;
};

/**
 * 触发全局错误事件
 * 艹！在API层或其他地方调用此函数来触发全局错误通知！
 */
export const emitGlobalError = (error: NormalizedError) => {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('app-error', { detail: error });
    window.dispatchEvent(event);
  }
};

export default ErrorProvider;
