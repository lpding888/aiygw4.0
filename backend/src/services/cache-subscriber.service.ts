import type { Redis as RedisInstance } from 'ioredis';
import cacheService from './cache.service.js';
import logger from '../utils/logger.js';

export type CachePreloadPriority = 'low' | 'normal' | 'high';

type CachePreloadItem = {
  key: string;
  value: unknown;
  ttl?: number | Record<string, unknown>;
};

type CachePreloadTask = {
  namespace: string;
  items: CachePreloadItem[];
  priority: CachePreloadPriority;
  enqueuedAt: number;
};

type VersionUpdatePayload = {
  namespace?: string;
  version?: number;
};

type CacheInvalidatePayload = {
  namespace?: string;
  pattern?: string;
  reason?: string;
};

type CachePreloadPayload = {
  namespace?: string;
  items?: CachePreloadItem[];
  priority?: CachePreloadPriority;
};

type CacheSubscriberStatus = {
  isRunning: boolean;
  subscriberCount: number;
  preloadQueueSize: number;
  isPreloading: boolean;
  reconnectAttempts: number;
  uptime: number;
};

const PRIORITY_ORDER: Record<CachePreloadPriority, number> = {
  high: 3,
  normal: 2,
  low: 1
};

class CacheSubscriberService {
  private readonly subscribers = new Map<string, RedisInstance>();

  private isRunning = false;

  private readonly reconnectInterval = 5000;

  private readonly maxReconnectAttempts = 10;

  private reconnectAttempts = 0;

  private preloadQueue: CachePreloadTask[] = [];

  private isPreloading = false;

  private reconnectTimer?: NodeJS.Timeout;

  private healthCheckTimer?: NodeJS.Timeout;

  /**
   * 启动订阅服务
   */
  async start(): Promise<void> {
    try {
      if (this.isRunning) {
        logger.warn('[CacheSubscriberService] 订阅服务已在运行');
        return;
      }

      logger.info('[CacheSubscriberService] 启动缓存订阅服务');

      await this.subscribeToVersionUpdates();
      await this.subscribeToCustomInvalidation();
      await this.subscribeToPreloadEvents();
      await this.subscribeToHealthEvents();

      this.isRunning = true;
      this.reconnectAttempts = 0;
      this.startHealthCheck();
      this.clearReconnectTimer();

      logger.info('[CacheSubscriberService] 缓存订阅服务启动成功');
    } catch (error) {
      logger.error('[CacheSubscriberService] 启动订阅服务失败', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 停止订阅服务
   */
  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      this.clearReconnectTimer();
      this.clearHealthCheckTimer();

      for (const [channel, subscriber] of this.subscribers) {
        try {
          await subscriber.quit();
          logger.debug(`[CacheSubscriberService] 关闭订阅: ${channel}`);
        } catch (error) {
          logger.warn(`[CacheSubscriberService] 关闭订阅失败: ${channel}`, error);
        }
      }

      this.subscribers.clear();
      logger.info('[CacheSubscriberService] 缓存订阅服务已停止');
    } catch (error) {
      logger.error('[CacheSubscriberService] 停止订阅服务失败', error);
    }
  }

  private async subscribeToVersionUpdates(): Promise<void> {
    const subscriber = await cacheService.subscribe('version_update', async (_channel, payload) => {
      try {
        const data = payload as VersionUpdatePayload;
        if (!data.namespace) {
          logger.warn('[CacheSubscriberService] 版本更新事件缺少 namespace');
          return;
        }

        logger.debug(
          `[CacheSubscriberService] 收到版本更新事件: ${data.namespace} v${data.version ?? 'unknown'}`
        );

        await this.clearMemoryCacheForNamespace(data.namespace);
        await this.triggerPreload(data.namespace);

        await cacheService.publish('cache_cleared', {
          namespace: data.namespace,
          version: data.version,
          type: 'version_update',
          timestamp: Date.now()
        });
      } catch (error) {
        logger.error('[CacheSubscriberService] 处理版本更新事件失败', error);
      }
    });

    this.subscribers.set('version_update', subscriber);
  }

  private async subscribeToCustomInvalidation(): Promise<void> {
    const subscriber = await cacheService.subscribe(
      'cache_invalidate',
      async (_channel, payload) => {
        try {
          const data = payload as CacheInvalidatePayload;
          const namespace = data.namespace ?? 'default';
          const pattern = data.pattern ?? '*';
          const reason = data.reason ?? 'unknown';

          logger.info(
            `[CacheSubscriberService] 收到自定义失效事件: ${namespace}:${pattern}, 原因: ${reason}`
          );

          const deleteCount = await cacheService.deletePattern(`${namespace}:${pattern}*`);
          await this.clearMemoryCacheForPattern(`${namespace}:${pattern}*`);

          logger.info(`[CacheSubscriberService] 自定义失效完成: 删除 ${deleteCount} 个缓存项`);

          await cacheService.publish('cache_invalidated', {
            pattern,
            namespace,
            deleteCount,
            reason,
            timestamp: Date.now()
          });
        } catch (error) {
          logger.error('[CacheSubscriberService] 处理自定义失效事件失败', error);
        }
      }
    );

    this.subscribers.set('cache_invalidate', subscriber);
  }

  private async subscribeToPreloadEvents(): Promise<void> {
    const subscriber = await cacheService.subscribe('cache_preload', async (_channel, payload) => {
      try {
        const data = payload as CachePreloadPayload;
        if (!data.namespace) {
          logger.warn('[CacheSubscriberService] 预热事件缺少 namespace');
          return;
        }

        const items = Array.isArray(data.items) ? data.items : [];
        const priority = data.priority ?? 'normal';

        logger.info(
          `[CacheSubscriberService] 收到预热事件: ${data.namespace}, 项数: ${items.length}`
        );

        this.addToPreloadQueue(data.namespace, items, priority);
        void this.processPreloadQueue();
      } catch (error) {
        logger.error('[CacheSubscriberService] 处理预热事件失败', error);
      }
    });

    this.subscribers.set('cache_preload', subscriber);
  }

  private async subscribeToHealthEvents(): Promise<void> {
    const subscriber = await cacheService.subscribe('health_check', async () => {
      try {
        logger.debug('[CacheSubscriberService] 收到健康检查事件');
        const health = await cacheService.healthCheck();

        await cacheService.publish('health_status', {
          ...health,
          nodeId: process.env.NODE_ID || 'unknown',
          timestamp: Date.now()
        });
      } catch (error) {
        logger.error('[CacheSubscriberService] 处理健康检查事件失败', error);
      }
    });

    this.subscribers.set('health_check', subscriber);
  }

  async invalidateCache(
    namespace: string,
    pattern: string,
    reason: string = 'manual'
  ): Promise<void> {
    try {
      await cacheService.publish('cache_invalidate', {
        namespace,
        pattern,
        reason,
        timestamp: Date.now()
      });

      logger.info(
        `[CacheSubscriberService] 触发缓存失效: ${namespace}:${pattern}, 原因: ${reason}`
      );
    } catch (error) {
      logger.error('[CacheSubscriberService] 触发缓存失效失败', error);
    }
  }

  async updateVersion(namespace: string): Promise<number> {
    try {
      const newVersion = await cacheService.incrementVersion(namespace);
      logger.info(`[CacheSubscriberService] 触发版本更新: ${namespace} -> ${newVersion}`);
      return newVersion;
    } catch (error) {
      logger.error('[CacheSubscriberService] 触发版本更新失败', error);
      throw error;
    }
  }

  async triggerPreload(
    namespace: string,
    items: CachePreloadItem[] = [],
    priority: CachePreloadPriority = 'normal'
  ): Promise<void> {
    try {
      await cacheService.publish('cache_preload', {
        namespace,
        items,
        priority,
        timestamp: Date.now()
      });

      logger.info(`[CacheSubscriberService] 触发缓存预热: ${namespace}, 项数: ${items.length}`);
    } catch (error) {
      logger.error('[CacheSubscriberService] 触发缓存预热失败', error);
    }
  }

  private addToPreloadQueue(
    namespace: string,
    items: CachePreloadItem[],
    priority: CachePreloadPriority
  ): void {
    this.preloadQueue.push({
      namespace,
      items,
      priority,
      enqueuedAt: Date.now()
    });

    this.preloadQueue.sort(
      (a, b) => (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0)
    );
  }

  private async processPreloadQueue(): Promise<void> {
    if (this.isPreloading || this.preloadQueue.length === 0) {
      return;
    }

    this.isPreloading = true;

    try {
      while (this.preloadQueue.length > 0) {
        const task = this.preloadQueue.shift();
        if (!task) {
          continue;
        }

        await this.executePreloadTask(task);
      }
    } catch (error) {
      logger.error('[CacheSubscriberService] 处理预热队列失败', error);
    } finally {
      this.isPreloading = false;
    }
  }

  private async executePreloadTask(task: CachePreloadTask): Promise<void> {
    try {
      const { namespace, items, priority } = task;
      const startTime = Date.now();

      logger.debug(`[CacheSubscriberService] 开始预热: ${namespace}, 优先级: ${priority}`);

      const successCount = await cacheService.preload(items);
      const duration = Date.now() - startTime;

      logger.info(
        `[CacheSubscriberService] 预热完成: ${namespace}, 成功: ${successCount}/${items.length}, 耗时: ${duration}ms`
      );

      await cacheService.publish('preload_completed', {
        namespace,
        totalCount: items.length,
        successCount,
        priority,
        duration,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[CacheSubscriberService] 执行预热任务失败', error);
    }
  }

  private async clearMemoryCacheForNamespace(namespace: string): Promise<void> {
    try {
      await cacheService.publish('clear_memory_cache', {
        namespace,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error(`[CacheSubscriberService] 清理内存缓存失败: ${namespace}`, error);
    }
  }

  private async clearMemoryCacheForPattern(pattern: string): Promise<void> {
    try {
      await cacheService.publish('clear_memory_cache', {
        pattern,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error(`[CacheSubscriberService] 清理内存缓存失败: ${pattern}`, error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[CacheSubscriberService] 重连次数已达上限，停止重连');
      return;
    }

    this.reconnectAttempts += 1;
    logger.info(
      `[CacheSubscriberService] 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.start();
      } catch (error) {
        logger.error('[CacheSubscriberService] 重连失败', error);
        this.scheduleReconnect();
      }
    }, this.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.broadcastHealthCheck();
      }
    }, 30000);
  }

  private clearHealthCheckTimer(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * 获取订阅服务状态
   */
  getStatus(): CacheSubscriberStatus {
    return {
      isRunning: this.isRunning,
      subscriberCount: this.subscribers.size,
      preloadQueueSize: this.preloadQueue.length,
      isPreloading: this.isPreloading,
      reconnectAttempts: this.reconnectAttempts,
      uptime: process.uptime()
    };
  }

  async broadcastHealthCheck(): Promise<void> {
    try {
      await cacheService.publish('health_check', {
        nodeId: process.env.NODE_ID || 'unknown',
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[CacheSubscriberService] 广播健康检查失败', error);
    }
  }
}

const cacheSubscriberService = new CacheSubscriberService();
export default cacheSubscriberService;
