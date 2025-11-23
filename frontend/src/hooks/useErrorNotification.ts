/**
 * 全局错误通知Hook
 * 艹！统一显示后端返回的错误信息，支持severity级别的样式区分！
 */

import { message, notification } from 'antd';
import { useCallback } from 'react';

/**
 * 标准化的错误对象
 */
export interface NormalizedError {
  code: number;
  message: string;
  category?: string;
  severity?: string;
  requestId?: string;
}

/**
 * 错误通知选项
 */
interface ErrorNotificationOptions {
  /** 是否使用notification（默认使用message） */
  useNotification?: boolean;
  /** 是否显示请求ID（方便调试） */
  showRequestId?: boolean;
  /** 是否显示错误代码 */
  showErrorCode?: boolean;
  /** 自定义显示时长（ms） */
  duration?: number;
}

/**
 * 全局错误通知Hook
 */
export const useErrorNotification = () => {
  /**
   * 显示错误通知
   */
  const showError = useCallback((error: NormalizedError, options: ErrorNotificationOptions = {}) => {
    const {
      useNotification: useNotificationMode = false,
      showRequestId = false,
      showErrorCode = true,
      duration,
    } = options;

    // 根据severity确定样式
    const getSeverityType = (severity?: string) => {
      if (severity === 'critical' || severity === 'high') {
        return 'error';
      }
      if (severity === 'medium') {
        return 'warning';
      }
      return 'info';
    };

    const type = getSeverityType(error.severity);

    // 构建错误描述
    const buildDescription = () => {
      const parts: string[] = [];

      if (showErrorCode) {
        parts.push(`错误代码: ${error.code}`);
      }

      if (error.category) {
        parts.push(`类别: ${error.category}`);
      }

      if (showRequestId && error.requestId) {
        parts.push(`请求ID: ${error.requestId}`);
      }

      return parts.length > 0 ? parts.join(' | ') : undefined;
    };

    // 使用notification模式（适合critical和high级别的错误）
    if (useNotificationMode || error.severity === 'critical' || error.severity === 'high') {
      const description = buildDescription();

      notification[type]({
        message: error.message,
        description,
        duration: duration ?? (error.severity === 'critical' ? 8 : 4.5),
        placement: 'topRight',
      });
    } else {
      // 使用message模式（简洁）
      const content = showErrorCode ? `${error.message} (代码: ${error.code})` : error.message;

      message[type](content, duration ?? 3);
    }
  }, []);

  /**
   * 显示成功通知
   */
  const showSuccess = useCallback((msg: string, duration = 3) => {
    message.success(msg, duration);
  }, []);

  /**
   * 显示警告通知
   */
  const showWarning = useCallback((msg: string, duration = 3) => {
    message.warning(msg, duration);
  }, []);

  /**
   * 显示信息通知
   */
  const showInfo = useCallback((msg: string, duration = 3) => {
    message.info(msg, duration);
  }, []);

  return {
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };
};

export default useErrorNotification;
