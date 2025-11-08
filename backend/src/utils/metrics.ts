/**
 * Metrics工具 - 性能指标收集与监控
 * 艹，这个SB模块负责收集各种性能指标，便于监控和告警！
 *
 * 功能：
 * - 缓存命中率统计
 * - 接口响应时间统计
 * - 错误率统计
 * - 自定义业务指标
 * - 指标聚合与导出
 */

interface MetricValue {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50?: number;
  p95?: number;
  p99?: number;
  lastUpdated: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRatio: number;
  lruHits: number;
  redisHits: number;
  snapshotHits: number;
  dbFallbacks: number;
}

interface TimingMetrics {
  [key: string]: MetricValue;
}

interface CounterMetrics {
  [key: string]: number;
}

/**
 * Metrics收集器类
 */
class MetricsCollector {
  private counters: CounterMetrics = {};
  private timings: Map<string, number[]> = new Map();
  private cacheMetrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    hitRatio: 0,
    lruHits: 0,
    redisHits: 0,
    snapshotHits: 0,
    dbFallbacks: 0
  };

  /**
   * 记录计数器
   * @param name - 计数器名称
   * @param value - 增量值（默认1）
   */
  incrementCounter(name: string, value: number = 1): void {
    if (!this.counters[name]) {
      this.counters[name] = 0;
    }
    this.counters[name] += value;
  }

  /**
   * 获取计数器值
   * @param name - 计数器名称
   * @returns 计数器值
   */
  getCounter(name: string): number {
    return this.counters[name] || 0;
  }

  /**
   * 重置计数器
   * @param name - 计数器名称（可选，不传则重置所有）
   */
  resetCounter(name?: string): void {
    if (name) {
      this.counters[name] = 0;
    } else {
      this.counters = {};
    }
  }

  /**
   * 记录时间指标
   * @param name - 指标名称
   * @param duration - 持续时间（毫秒）
   */
  recordTiming(name: string, duration: number): void {
    if (!this.timings.has(name)) {
      this.timings.set(name, []);
    }

    const values = this.timings.get(name)!;
    values.push(duration);

    // 保留最近1000个样本，避免内存泄漏
    if (values.length > 1000) {
      values.shift();
    }
  }

  /**
   * 获取时间指标统计
   * @param name - 指标名称
   * @returns 指标统计值
   */
  getTimingStats(name: string): MetricValue | null {
    const values = this.timings.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const avg = sum / sorted.length;

    return {
      count: sorted.length,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      lastUpdated: Date.now()
    };
  }

  /**
   * 计算百分位数
   * @private
   */
  private percentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[index];
  }

  /**
   * 记录缓存命中
   * @param source - 缓存源（lru/redis/snapshot/db）
   */
  recordCacheHit(source: 'lru' | 'redis' | 'snapshot' | 'db'): void {
    this.cacheMetrics.hits++;

    switch (source) {
      case 'lru':
        this.cacheMetrics.lruHits++;
        break;
      case 'redis':
        this.cacheMetrics.redisHits++;
        break;
      case 'snapshot':
        this.cacheMetrics.snapshotHits++;
        break;
      case 'db':
        this.cacheMetrics.dbFallbacks++;
        break;
    }

    this.updateCacheHitRatio();
  }

  /**
   * 记录缓存未命中
   */
  recordCacheMiss(): void {
    this.cacheMetrics.misses++;
    this.updateCacheHitRatio();
  }

  /**
   * 更新缓存命中率
   * @private
   */
  private updateCacheHitRatio(): void {
    const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
    this.cacheMetrics.hitRatio = total > 0 ? this.cacheMetrics.hits / total : 0;
  }

  /**
   * 获取缓存指标
   * @returns 缓存指标
   */
  getCacheMetrics(): CacheMetrics {
    return { ...this.cacheMetrics };
  }

  /**
   * 重置缓存指标
   */
  resetCacheMetrics(): void {
    this.cacheMetrics = {
      hits: 0,
      misses: 0,
      hitRatio: 0,
      lruHits: 0,
      redisHits: 0,
      snapshotHits: 0,
      dbFallbacks: 0
    };
  }

  /**
   * 获取所有指标
   * @returns 所有指标数据
   */
  getAllMetrics(): {
    counters: CounterMetrics;
    timings: { [key: string]: MetricValue | null };
    cache: CacheMetrics;
  } {
    const timingStats: { [key: string]: MetricValue | null } = {};

    for (const [name] of this.timings) {
      timingStats[name] = this.getTimingStats(name);
    }

    return {
      counters: { ...this.counters },
      timings: timingStats,
      cache: this.getCacheMetrics()
    };
  }

  /**
   * 重置所有指标
   */
  resetAll(): void {
    this.counters = {};
    this.timings.clear();
    this.resetCacheMetrics();
  }

  /**
   * 导出指标为Prometheus格式
   * @returns Prometheus格式的指标文本
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    // 导出计数器
    lines.push('# HELP app_counter Application counters');
    lines.push('# TYPE app_counter counter');
    for (const [name, value] of Object.entries(this.counters)) {
      lines.push(`app_counter{name="${name}"} ${value}`);
    }

    // 导出时间指标
    lines.push('# HELP app_timing_seconds Application timing metrics');
    lines.push('# TYPE app_timing_seconds summary');
    for (const [name] of this.timings) {
      const stats = this.getTimingStats(name);
      if (stats) {
        lines.push(`app_timing_seconds{name="${name}",quantile="0.5"} ${stats.p50! / 1000}`);
        lines.push(`app_timing_seconds{name="${name}",quantile="0.95"} ${stats.p95! / 1000}`);
        lines.push(`app_timing_seconds{name="${name}",quantile="0.99"} ${stats.p99! / 1000}`);
        lines.push(`app_timing_seconds_sum{name="${name}"} ${stats.sum / 1000}`);
        lines.push(`app_timing_seconds_count{name="${name}"} ${stats.count}`);
      }
    }

    // 导出缓存指标
    lines.push('# HELP cache_hit_ratio Cache hit ratio');
    lines.push('# TYPE cache_hit_ratio gauge');
    lines.push(`cache_hit_ratio ${this.cacheMetrics.hitRatio}`);

    lines.push('# HELP cache_hits_total Total cache hits by source');
    lines.push('# TYPE cache_hits_total counter');
    lines.push(`cache_hits_total{source="lru"} ${this.cacheMetrics.lruHits}`);
    lines.push(`cache_hits_total{source="redis"} ${this.cacheMetrics.redisHits}`);
    lines.push(`cache_hits_total{source="snapshot"} ${this.cacheMetrics.snapshotHits}`);
    lines.push(`cache_hits_total{source="db"} ${this.cacheMetrics.dbFallbacks}`);

    return lines.join('\n') + '\n';
  }

  /**
   * 导出指标为JSON格式
   * @returns JSON格式的指标对象
   */
  exportJSON(): string {
    return JSON.stringify(this.getAllMetrics(), null, 2);
  }
}

/**
 * 辅助函数：测量函数执行时间
 * @param name - 指标名称
 * @param fn - 要执行的函数
 * @returns 函数执行结果
 */
export async function measureTiming<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    metrics.recordTiming(name, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    metrics.recordTiming(name, duration);
    metrics.incrementCounter(`${name}_error`);
    throw error;
  }
}

/**
 * 辅助函数：测量同步函数执行时间
 * @param name - 指标名称
 * @param fn - 要执行的函数
 * @returns 函数执行结果
 */
export function measureTimingSync<T>(name: string, fn: () => T): T {
  const start = Date.now();
  try {
    const result = fn();
    const duration = Date.now() - start;
    metrics.recordTiming(name, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    metrics.recordTiming(name, duration);
    metrics.incrementCounter(`${name}_error`);
    throw error;
  }
}

// 单例导出
export const metrics = new MetricsCollector();

// 导出类型
export type { MetricValue, CacheMetrics, TimingMetrics, CounterMetrics };
