import 'express';
import type { UserRole } from '../utils/rbac.js';

declare global {
  namespace Express {
    interface Request {
      /**
       * 请求链路唯一 ID（request-id 中间件注入）
       */
      id?: string;
      /**
       * 认证用户信息，由 auth 相关中间件填充
       */
      user?: {
        id: string;
        uid?: string;
        role: UserRole;
        jti?: string;
        phone?: string;
        source?: string;
        [key: string]: unknown;
      };
      /**
       * 兼容历史中间件的用户 ID 快捷字段
       */
      userId?: string;
      /**
       * 原始 Bearer Token
       */
      token?: string;
      /**
       * 国际化工具（由 i18n 中间件注入）
       */
      i18n?: {
        locale: string;
        getMessage: (key: string, variables?: Record<string, unknown>) => string;
        getErrorMessage: (code: string | number, variables?: Record<string, unknown>) => string;
        formatNumber: (value: number) => string;
        formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
        formatCurrency: (amount: number, currency: string) => string;
        formatRelativeTime: (value: Date | string | number) => string;
        setLanguage?: (locale: string) => void;
      };
      /**
       * 管理员附加信息（旧 adminAuth 中间件遗留）
       */
      admin?: {
        id: string;
        phone?: string;
        role: string;
        [key: string]: unknown;
      };
    }
  }
}

export {};
