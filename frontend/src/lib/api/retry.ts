/**
 * REL-P2-RETRY-211: 请求重试与指数退避策略
 * 艹！网络抖动不能影响用户体验，必须自动重试！
 *
 * @author 老王
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 初始延迟时间（毫秒） */
  initialDelay: number;
  /** 最大延迟时间（毫秒） */
  maxDelay: number;
  /** 退避倍数 */
  backoffMultiplier: number;
  /** 是否应该重试的判断函数 */
  shouldRetry?: (error: AxiosError) => boolean;
  /** 重试回调 */
  onRetry?: (attempt: number, error: AxiosError, delay: number) => void;
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1秒
  maxDelay: 10000, // 10秒
  backoffMultiplier: 2, // 指数退避：1s -> 2s -> 4s
  shouldRetry: (error: AxiosError) => {
    // 默认只重试网络错误和5xx错误
    if (!error.response) {
      // 网络错误（没有响应）
      return true;
    }

    const status = error.response.status;
    // 5xx服务器错误
    if (status >= 500 && status < 600) {
      return true;
    }

    // 429 Too Many Requests（速率限制）
    if (status === 429) {
      return true;
    }

    return false;
  },
  onRetry: (attempt, error, delay) => {
    console.log(
      `[Retry] Attempt ${attempt}, delaying ${delay}ms, error: ${error.message}`
    );
  },
};

/**
 * 计算指数退避延迟时间
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * 添加抖动（Jitter）避免惊群效应
 */
export function addJitter(delay: number): number {
  // 在 0.5 到 1.0 之间随机
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.floor(delay * jitter);
}

/**
 * 休眠函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的请求执行器
 */
export async function executeWithRetry<T>(
  requestFn: () => Promise<AxiosResponse<T>>,
  config: Partial<RetryConfig> = {}
): Promise<AxiosResponse<T>> {
  const retryConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: AxiosError | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error as AxiosError;

      // 如果是最后一次尝试，直接抛出错误
      if (attempt === retryConfig.maxRetries) {
        throw error;
      }

      // 判断是否应该重试
      if (!retryConfig.shouldRetry || !retryConfig.shouldRetry(lastError)) {
        throw error;
      }

      // 计算延迟时间（带抖动）
      const delay = addJitter(calculateBackoffDelay(attempt + 1, retryConfig));

      // 触发重试回调
      if (retryConfig.onRetry) {
        retryConfig.onRetry(attempt + 1, lastError, delay);
      }

      // 等待后重试
      await sleep(delay);
    }
  }

  // 理论上不会到这里，但为了类型安全
  throw lastError;
}

/**
 * 为Axios实例添加重试拦截器
 */
export function addRetryInterceptor(
  instance: AxiosInstance,
  config: Partial<RetryConfig> = {}
): void {
  const retryConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalConfig = error.config as AxiosRequestConfig & {
        _retryCount?: number;
      };

      // 初始化重试计数
      if (!originalConfig._retryCount) {
        originalConfig._retryCount = 0;
      }

      // 判断是否应该重试
      const shouldRetry =
        retryConfig.shouldRetry && retryConfig.shouldRetry(error);

      if (shouldRetry && originalConfig._retryCount < retryConfig.maxRetries) {
        originalConfig._retryCount += 1;

        // 计算延迟时间（带抖动）
        const delay = addJitter(
          calculateBackoffDelay(originalConfig._retryCount, retryConfig)
        );

        // 触发重试回调
        if (retryConfig.onRetry) {
          retryConfig.onRetry(originalConfig._retryCount, error, delay);
        }

        // 等待后重试
        await sleep(delay);

        return instance(originalConfig);
      }

      return Promise.reject(error);
    }
  );
}

/**
 * 创建带重试功能的Axios实例
 */
export function createRetryClient(
  baseConfig: AxiosRequestConfig = {},
  retryConfig: Partial<RetryConfig> = {}
): AxiosInstance {
  const instance = axios.create({
    timeout: 30000,
    ...baseConfig,
  });

  addRetryInterceptor(instance, retryConfig);

  return instance;
}

/**
 * 幂等性检查
 * 只有幂等的HTTP方法才应该自动重试
 */
export function isIdempotent(method?: string): boolean {
  if (!method) return false;
  const idempotentMethods = ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE'];
  return idempotentMethods.includes(method.toUpperCase());
}

/**
 * 智能重试配置生成器
 * 根据请求类型自动调整重试策略
 */
export function getSmartRetryConfig(
  config: AxiosRequestConfig
): Partial<RetryConfig> {
  const method = config.method?.toUpperCase();

  // GET请求：积极重试
  if (method === 'GET') {
    return {
      maxRetries: 3,
      initialDelay: 1000,
      shouldRetry: (error) => {
        // GET请求可以重试更多类型的错误
        if (!error.response) return true;
        const status = error.response.status;
        return status >= 500 || status === 429 || status === 408;
      },
    };
  }

  // POST/PATCH请求：谨慎重试（仅网络错误）
  if (method === 'POST' || method === 'PATCH') {
    return {
      maxRetries: 2,
      initialDelay: 2000,
      shouldRetry: (error) => {
        // POST/PATCH只在网络错误时重试
        return !error.response;
      },
    };
  }

  // PUT/DELETE请求：可以重试（幂等）
  if (method === 'PUT' || method === 'DELETE') {
    return {
      maxRetries: 3,
      initialDelay: 1000,
      shouldRetry: (error) => {
        if (!error.response) return true;
        const status = error.response.status;
        return status >= 500 || status === 429;
      },
    };
  }

  // 默认：不重试
  return {
    maxRetries: 0,
  };
}

/**
 * 批量重试管理器
 * 用于管理上传/生成等批量任务的失败重试
 */
export class BatchRetryManager {
  private failedItems: Map<string, any> = new Map();
  private retryCallbacks: Map<string, () => Promise<void>> = new Map();

  /**
   * 记录失败项
   */
  recordFailure(id: string, item: any, retryCallback: () => Promise<void>) {
    this.failedItems.set(id, item);
    this.retryCallbacks.set(id, retryCallback);
  }

  /**
   * 获取失败项列表
   */
  getFailedItems(): Array<{ id: string; item: any }> {
    return Array.from(this.failedItems.entries()).map(([id, item]) => ({
      id,
      item,
    }));
  }

  /**
   * 重试单个项
   */
  async retryOne(id: string): Promise<boolean> {
    const callback = this.retryCallbacks.get(id);
    if (!callback) return false;

    try {
      await callback();
      this.failedItems.delete(id);
      this.retryCallbacks.delete(id);
      return true;
    } catch (error) {
      console.error(`[BatchRetryManager] Retry failed for ${id}:`, error);
      return false;
    }
  }

  /**
   * 重试所有失败项
   */
  async retryAll(): Promise<{ succeeded: string[]; failed: string[] }> {
    const results = {
      succeeded: [] as string[],
      failed: [] as string[],
    };

    const ids = Array.from(this.failedItems.keys());

    for (const id of ids) {
      const success = await this.retryOne(id);
      if (success) {
        results.succeeded.push(id);
      } else {
        results.failed.push(id);
      }
    }

    return results;
  }

  /**
   * 清除所有失败项
   */
  clear() {
    this.failedItems.clear();
    this.retryCallbacks.clear();
  }

  /**
   * 获取失败项数量
   */
  get count(): number {
    return this.failedItems.size;
  }
}

/**
 * 全局批量重试管理器实例
 */
export const globalBatchRetryManager = new BatchRetryManager();

/**
 * 导出所有工具
 */
export default {
  DEFAULT_RETRY_CONFIG,
  calculateBackoffDelay,
  addJitter,
  sleep,
  executeWithRetry,
  addRetryInterceptor,
  createRetryClient,
  isIdempotent,
  getSmartRetryConfig,
  BatchRetryManager,
  globalBatchRetryManager,
};
