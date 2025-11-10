import logger from '../utils/logger.js';
import cacheService from './cache.service.js';

type CircuitBreakerConfig = Record<string, unknown>;
type OperationFn<T = unknown> = () => Promise<T> | T;
type FallbackFn<T = unknown> = (error: Error) => Promise<T> | T;
type BatchOperation<T = unknown> = OperationFn<T>;

/**
 * 熔断器服务
 *
 * 实现熔断器模式，保护外部服务调用：
 * - 熔断状态管理
 * - 失败率统计
 * - 降级处理
 * - 自动恢复
 * - 监控和告警
 */
class CircuitBreakerService {
  private circuitBreakers: Map<string, CircuitBreaker>;

  private metrics: {
    totalRequests: number;
    totalFailures: number;
    totalCircuitBreakers: number;
    activeBreakers: number;
  };

  private defaultConfig: {
    failureThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
    halfOpenMaxCalls: number;
    successThreshold: number;
  };

  constructor() {
    this.circuitBreakers = new Map();
    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      totalCircuitBreakers: 0,
      activeBreakers: 0
    };

    // 默认配置
    this.defaultConfig = {
      failureThreshold: 5, // 失败阈值
      resetTimeout: 60000, // 重置超时（60秒）
      monitoringPeriod: 10000, // 监控周期（10秒）
      halfOpenMaxCalls: 3, // 半开状态最大调用数
      successThreshold: 3 // 成功阈值（半开->关闭）
    };
  }

  /**
   * 获取或创建熔断器
   * @param {string} name - 熔断器名称
   * @param {Object} config - 配置参数
   * @returns {CircuitBreaker} 熔断器实例
   */
  getCircuitBreaker(name: string, config: CircuitBreakerConfig = {}): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const circuitBreaker = new CircuitBreaker(name, {
        ...this.defaultConfig,
        ...config
      });

      this.circuitBreakers.set(name, circuitBreaker);
      this.metrics.totalCircuitBreakers++;
    }

    return this.circuitBreakers.get(name) as CircuitBreaker;
  }

  /**
   * 执行带熔断保护的操作
   * @param {string} name - 熔断器名称
   * @param {Function} operation - 要执行的操作
   * @param {Function} fallback - 降级操作
   * @param {Object} config - 熔断器配置
   * @returns {Promise<T>} 操作结果
   */
  async execute<T = unknown>(
    name: string,
    operation: OperationFn<T>,
    fallback: FallbackFn<T> | null = null,
    config: CircuitBreakerConfig = {}
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(name, config);

    this.metrics.totalRequests++;

    try {
      // 检查熔断器状态
      if (circuitBreaker.isOpen()) {
        this.metrics.totalFailures++;
        logger.warn(`[CircuitBreaker] 熔断器已打开: ${name}`);

        if (fallback) {
          return await fallback(new Error('Circuit breaker is open'));
        } else {
          throw new Error(`Circuit breaker is open for ${name}`);
        }
      }

      // 执行操作
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;

      // 记录成功
      circuitBreaker.recordSuccess();

      logger.debug(`[CircuitBreaker] 操作成功: ${name}, 耗时: ${duration}ms`);
      return result;
    } catch (error: unknown) {
      // 记录失败
      circuitBreaker.recordFailure();
      this.metrics.totalFailures++;

      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[CircuitBreaker] 操作失败: ${name}`, {
        error: err.message,
        state: circuitBreaker.getState()
      });

      // 执行降级操作
      if (fallback) {
        try {
          const fallbackResult = await fallback(err);
          logger.info(`[CircuitBreaker] 降级操作执行成功: ${name}`);
          return fallbackResult;
        } catch (fallbackError: unknown) {
          const fbErr =
            fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
          logger.error(`[CircuitBreaker] 降级操作失败: ${name}`, fbErr);
          throw fbErr;
        }
      } else {
        throw err;
      }
    }
  }

  /**
   * 批量执行操作（带并发控制）
   * @param {string} name - 熔断器名称
   * @param {Array} operations - 操作列表
   * @param {Function} fallback - 降级操作
   * @param {Object} config - 配置参数
   * @returns {Promise<Array>} 执行结果
   */
  async executeBatch<T = unknown>(
    name: string,
    operations: BatchOperation<T>[],
    fallback: FallbackFn<T> | null = null,
    config: CircuitBreakerConfig = {}
  ): Promise<Array<T | { error: string }>> {
    const circuitBreaker = this.getCircuitBreaker(name, config);
    const results: Array<T | { error: string }> = [];
    const batchSize = config.batchSize || 5;

    try {
      // 检查熔断器状态
      if (circuitBreaker.isOpen()) {
        logger.warn(`[CircuitBreaker] 批量操作被熔断: ${name}`);

        if (fallback) {
          // 所有操作都执行降级
          for (let i = 0; i < operations.length; i += 1) {
            try {
              const result = await fallback(new Error('Circuit breaker is open'));
              results.push(result);
            } catch (error: unknown) {
              const err = error instanceof Error ? error : new Error(String(error));
              results.push({ error: err.message });
            }
          }
          return results;
        } else {
          throw new Error(`Circuit breaker is open for ${name}`);
        }
      }

      // 分批执行
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        const batchPromises = batch.map((operation) =>
          this.execute(name, () => operation(), fallback, config)
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // 检查是否需要停止
        if (circuitBreaker.isOpen()) {
          logger.warn(`[CircuitBreaker] 批量执行中熔断器打开: ${name}`);
          break;
        }
      }

      return results;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[CircuitBreaker] 批量执行失败: ${name}`, err);
      throw err;
    }
  }

  /**
   * 获取熔断器状态
   * @param {string} name - 熔断器名称
   * @returns {Object} 熔断器状态
   */
  getCircuitBreakerState(name: string): Record<string, unknown> | null {
    const circuitBreaker = this.circuitBreakers.get(name) as CircuitBreaker | undefined;
    if (!circuitBreaker) {
      return null;
    }

    return {
      name,
      state: circuitBreaker.getState(),
      failureCount: circuitBreaker.getFailureCount(),
      successCount: circuitBreaker.getSuccessCount(),
      lastFailureTime: circuitBreaker.getLastFailureTime(),
      lastSuccessTime: circuitBreaker.getLastSuccessTime(),
      nextAttempt: circuitBreaker.getNextAttempt(),
      config: circuitBreaker.getConfig()
    };
  }

  /**
   * 获取所有熔断器状态
   * @returns {Object} 所有熔断器状态
   */
  getAllCircuitBreakerStates(): {
    circuitBreakers: Record<string, ReturnType<CircuitBreakerService['getCircuitBreakerState']>>;
    metrics: {
      totalCircuitBreakers: number;
      totalRequests: number;
      totalFailures: number;
      activeBreakers: number;
    };
    timestamp: string;
  } {
    const states: Record<string, ReturnType<CircuitBreakerService['getCircuitBreakerState']>> = {};

    for (const [name] of this.circuitBreakers) {
      states[name] = this.getCircuitBreakerState(name);
    }

    return {
      circuitBreakers: states,
      metrics: {
        totalCircuitBreakers: this.metrics.totalCircuitBreakers,
        totalRequests: this.metrics.totalRequests,
        totalFailures: this.metrics.totalFailures,
        activeBreakers: Array.from(this.circuitBreakers.values()).filter(
          (cb) => cb.getState() === 'open'
        ).length
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 重置熔断器
   * @param {string} name - 熔断器名称
   * @returns {boolean} 是否成功
   */
  resetCircuitBreaker(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name) as CircuitBreaker | undefined;
    if (!circuitBreaker) {
      return false;
    }

    circuitBreaker.reset();
    logger.info(`[CircuitBreaker] 熔断器已重置: ${name}`);
    return true;
  }

  /**
   * 手动打开熔断器
   * @param {string} name - 熔断器名称
   * @param {string} reason - 原因
   * @returns {boolean} 是否成功
   */
  openCircuitBreaker(name: string, reason = 'manual'): boolean {
    const circuitBreaker = this.circuitBreakers.get(name) as CircuitBreaker | undefined;
    if (!circuitBreaker) {
      return false;
    }

    circuitBreaker.open(reason);
    logger.warn(`[CircuitBreaker] 熔断器手动打开: ${name}, 原因: ${reason}`);
    return true;
  }

  /**
   * 强制关闭熔断器
   * @param {string} name - 熔断器名称
   * @returns {boolean} 是否成功
   */
  closeCircuitBreaker(name: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(name) as CircuitBreaker | undefined;
    if (!circuitBreaker) {
      return false;
    }

    circuitBreaker.close();
    logger.info(`[CircuitBreaker] 熔断器强制关闭: ${name}`);
    return true;
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async healthCheck(): Promise<Record<string, unknown>> {
    try {
      const states = this.getAllCircuitBreakerStates();
      const activeBreakers = states.metrics.activeBreakers;
      const totalCircuitBreakers = states.metrics.totalCircuitBreakers;

      const health = {
        status: activeBreakers > 0 ? 'degraded' : 'healthy',
        totalCircuitBreakers,
        activeBreakers,
        circuitBreakers: Object.keys(states.circuitBreakers).map((name) => {
          const cbState = states.circuitBreakers[name];
          return {
            name,
            state: cbState?.state ?? 'unknown'
          };
        }),
        timestamp: new Date().toISOString()
      };

      return health;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[CircuitBreaker] 健康检查失败', err);
      return {
        status: 'unhealthy',
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 清理不活跃的熔断器
   * @param {number} inactiveThresholdMs - 不活跃阈值（毫秒）
   * @returns {number} 清理数量
   */
  cleanupInactiveCircuitBreakers(inactiveThresholdMs = 3600000): number {
    // 默认1小时
    let cleanedCount = 0;
    const now = Date.now();

    for (const [name, breaker] of this.circuitBreakers.entries()) {
      const circuitBreaker = breaker as CircuitBreaker;
      const lastActivity = Math.max(
        circuitBreaker.getLastFailureTime() || 0,
        circuitBreaker.getLastSuccessTime() || 0
      );

      if (now - lastActivity > inactiveThresholdMs) {
        this.circuitBreakers.delete(name);
        cleanedCount++;
        logger.info(`[CircuitBreaker] 清理不活跃熔断器: ${name}`);
      }
    }

    if (cleanedCount > 0) {
      this.metrics.totalCircuitBreakers -= cleanedCount;
      logger.info(`[CircuitBreaker] 清理完成，数量: ${cleanedCount}`);
    }

    return cleanedCount;
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats(): Record<string, unknown> {
    return {
      ...this.metrics,
      circuitBreakerCount: this.circuitBreakers.size,
      activeBreakers: Array.from(this.circuitBreakers.values()).filter(
        (cb) => cb.getState() === 'open'
      ).length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      totalCircuitBreakers: this.circuitBreakers.size,
      activeBreakers: Array.from(this.circuitBreakers.values()).filter(
        (cb) => cb.getState() === 'open'
      ).length
    };

    logger.info('[CircuitBreaker] 统计信息已重置');
  }
}

/**
 * 熔断器类
 */
class CircuitBreaker {
  private name: string;

  private config: CircuitBreakerConfig;

  private state: 'closed' | 'open' | 'half-open';

  private failureCount: number;

  private successCount: number;

  private lastFailureTime: number | null;

  private lastSuccessTime: number | null;

  private nextAttempt: number | null;

  private requestCounts: {
    total: number;
    failures: number;
    successes: number;
  };

  constructor(name: string, config: CircuitBreakerConfig) {
    this.name = name;
    this.config = config;

    // 状态
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttempt = null;

    // 统计
    this.requestCounts = {
      total: 0,
      failures: 0,
      successes: 0
    };

    logger.info(`[CircuitBreaker] 创建熔断器: ${name}`, config);
  }

  /**
   * 检查是否打开
   * @returns {boolean} 是否打开
   */
  isOpen(): boolean {
    if (this.state === 'open') {
      // 检查是否可以进入半开状态
      if (this.nextAttempt !== null && Date.now() >= this.nextAttempt) {
        this.state = 'half-open';
        this.successCount = 0;
        logger.info(`[CircuitBreaker] 进入半开状态: ${this.name}`);
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * 记录成功
   */
  recordSuccess(): void {
    this.requestCounts.total++;
    this.requestCounts.successes++;
    this.successCount++;
    this.lastSuccessTime = Date.now();

    if (this.state === 'half-open') {
      if (this.successCount >= this.config.successThreshold) {
        this.close();
      }
    } else if (this.state === 'closed') {
      // 在监控周期内重置失败计数
      if (
        this.lastFailureTime &&
        Date.now() - this.lastFailureTime > this.config.monitoringPeriod
      ) {
        this.failureCount = 0;
      }
    }
  }

  /**
   * 记录失败
   */
  recordFailure(): void {
    this.requestCounts.total++;
    this.requestCounts.failures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.open('failure in half-open state');
    } else if (this.state === 'closed') {
      if (this.failureCount >= this.config.failureThreshold) {
        this.open('failure threshold reached');
      }
    }
  }

  /**
   * 打开熔断器
   * @param {string} reason - 打开原因
   */
  open(reason: string): void {
    this.state = 'open';
    this.nextAttempt = Date.now() + this.config.resetTimeout;
    logger.warn(`[CircuitBreaker] 熔断器打开: ${this.name}, 原因: ${reason}`);
  }

  /**
   * 关闭熔断器
   */
  close(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = null;
    logger.info(`[CircuitBreaker] 熔断器关闭: ${this.name}`);
  }

  /**
   * 重置熔断器
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttempt = null;
    this.requestCounts = {
      total: 0,
      failures: 0,
      successes: 0
    };
    logger.info(`[CircuitBreaker] 熔断器重置: ${this.name}`);
  }

  /**
   * 获取状态
   * @returns {string} 当前状态
   */
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  /**
   * 获取失败计数
   * @returns {number} 失败计数
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * 获取成功计数
   * @returns {number} 成功计数
   */
  getSuccessCount(): number {
    return this.successCount;
  }

  /**
   * 获取最后失败时间
   * @returns {number|null} 最后失败时间
   */
  getLastFailureTime(): number | null {
    return this.lastFailureTime;
  }

  /**
   * 获取最后成功时间
   * @returns {number|null} 最后成功时间
   */
  getLastSuccessTime(): number | null {
    return this.lastSuccessTime;
  }

  /**
   * 获取下次尝试时间
   * @returns {number|null} 下次尝试时间
   */
  getNextAttempt(): number | null {
    return this.nextAttempt;
  }

  /**
   * 获取配置
   * @returns {Object} 配置参数
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * 获取请求统计
   * @returns {Object} 请求统计
   */
  getRequestStats(): { total: number; failures: number; successes: number } {
    return { ...this.requestCounts };
  }

  /**
   * 计算失败率
   * @returns {number} 失败率（0-1）
   */
  getFailureRate(): number {
    const total = this.requestCounts.total;
    if (total === 0) return 0;
    return this.requestCounts.failures / total;
  }
}

const circuitBreakerService = new CircuitBreakerService();

export default circuitBreakerService;
