/**
 * 统一axios客户端出口
 * 艹，这个tm是所有API请求的基础！错误体规范必须统一！
 *
 * @author 老王
 */

import axios, { AxiosError } from 'axios';
import { addRetryInterceptor } from './retry';

// 复用现有的shared/api/client.ts
export { apiClient } from '@/shared/api/client';
export { BASE_URL } from '@/shared/api/client';

/**
 * 统一错误体类型
 */
export type ApiError = {
  code: string;         // e.g. 'PROVIDER_TIMEOUT', 'VALIDATION_FAILED'
  message: string;      // 人类可读
  requestId?: string;   // 贯穿前后端的排障ID，前端 UI 必须可复制
};

/**
 * 增强版API客户端（添加错误拦截器 + 重试功能）
 * REL-P2-RETRY-211: 集成请求重试与指数退避策略
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || '/api',
  withCredentials: true,
  timeout: 30000,
});

// REL-P2-RETRY-211: 添加智能重试拦截器
addRetryInterceptor(api, {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: AxiosError) => {
    // 只重试幂等请求（GET/PUT/DELETE）的网络错误和5xx错误
    const method = error.config?.method?.toUpperCase();
    const isIdempotent = ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'].includes(
      method || ''
    );

    if (!isIdempotent) {
      return false; // POST/PATCH不自动重试，避免重复提交
    }

    if (!error.response) {
      return true; // 网络错误，重试
    }

    const status = error.response.status;
    return status >= 500 || status === 429; // 5xx或429，重试
  },
  onRetry: (attempt, error, delay) => {
    console.log(
      `[API Retry] Attempt ${attempt}, method: ${error.config?.method}, delay: ${delay}ms`
    );
  },
});

// 错误统一处理拦截器
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const resp = err.response;
    const data: any = resp?.data || {};
    const apiErr: ApiError = {
      code: (data.code || resp?.status?.toString() || 'UNKNOWN') as string,
      message: (data.message || err.message || '请求失败') as string,
      requestId: data.requestId,
    };
    // TODO: 后续接入Sentry后写入breadcrumb
    return Promise.reject(apiErr);
  }
);