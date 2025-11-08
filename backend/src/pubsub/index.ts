/**
 * Pub/Sub服务 - Redis精准失效广播
 * 艹，这个憨批模块用Redis Pub/Sub实现配置精准失效！
 *
 * 功能：
 * - cfg:invalidate频道精准失效
 * - payload={scope,key,version}
 * - 多进程1秒内一致性
 * - 自动重连与合并广播
 */

import { Redis as RedisClient } from 'ioredis';
import logger from '../utils/logger.js';
import { redisConfig } from '../config/redis.js';

/**
 * 失效消息载荷
 */
export interface InvalidationPayload {
  scope: string; // 作用域（provider/announcement/banner等）
  key?: string; // 配置key（可选，不传则失效整个scope）
  version: string; // 版本号
  timestamp: number; // 失效时间戳
}

/**
 * 订阅回调函数类型
 */
export type InvalidationCallback = (payload: InvalidationPayload) => void | Promise<void>;

/**
 * Pub/Sub服务类
 */
class PubSubService {
  private publisher: RedisClient | null = null;
  private subscriber: RedisClient | null = null;
  private isInitialized = false;
  private callbacks: InvalidationCallback[] = [];
  private reconnectTimer?: NodeJS.Timeout;

  // 频道名称
  private readonly CHANNEL = 'cfg:invalidate';

  // 重连配置
  private readonly RECONNECT_DELAY = 5000; // 5秒
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private reconnectAttempts = 0;

  /**
   * 初始化Pub/Sub服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('[PubSub] 服务已初始化');
      return;
    }

    try {
      // 创建发布者Redis连接
      this.publisher = new RedisClient({
        ...redisConfig,
        retryStrategy: (times) => Math.min(times * 50, 2000)
      });

      // 创建订阅者Redis连接（必须独立连接）
      this.subscriber = new RedisClient({
        ...redisConfig,
        retryStrategy: (times) => Math.min(times * 50, 2000)
      });

      // 设置错误处理
      this.publisher.on('error', (err: Error) => {
        logger.error('[PubSub] Publisher错误:', err);
      });

      this.subscriber.on('error', (err: Error) => {
        logger.error('[PubSub] Subscriber错误:', err);
      });

      // 设置重连处理
      this.subscriber.on('close', () => {
        logger.warn('[PubSub] Subscriber连接关闭，尝试重连');
        this.handleReconnect();
      });

      // 订阅失效频道
      await this.subscriber.subscribe(this.CHANNEL);

      // 设置消息处理器
      this.subscriber.on('message', (channel: string, message: string) => {
        if (channel === this.CHANNEL) {
          this.handleInvalidationMessage(message);
        }
      });

      this.isInitialized = true;
      this.reconnectAttempts = 0;
      logger.info('[PubSub] 服务初始化成功');
    } catch (error) {
      logger.error('[PubSub] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 处理重连
   * @private
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error('[PubSub] 重连次数超过最大限制，停止重连');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      try {
        this.reconnectAttempts++;
        logger.info(`[PubSub] 尝试重连 (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

        // 重新订阅
        if (this.subscriber && this.subscriber.status !== 'end') {
          await this.subscriber.subscribe(this.CHANNEL);
          this.reconnectAttempts = 0;
          logger.info('[PubSub] 重连成功');
        }
      } catch (error) {
        logger.error('[PubSub] 重连失败:', error);
        this.handleReconnect();
      }
    }, this.RECONNECT_DELAY);
  }

  /**
   * 处理失效消息
   * @private
   */
  private handleInvalidationMessage(message: string): void {
    try {
      const payload: InvalidationPayload = JSON.parse(message);

      logger.info(
        `[PubSub] 收到失效消息: scope=${payload.scope} ` +
          `key=${payload.key || '*'} version=${payload.version}`
      );

      // 执行所有注册的回调
      for (const callback of this.callbacks) {
        try {
          const result = callback(payload);
          if (result instanceof Promise) {
            result.catch((err) => {
              logger.error('[PubSub] 回调执行失败:', err);
            });
          }
        } catch (err) {
          logger.error('[PubSub] 回调执行失败:', err);
        }
      }
    } catch (error) {
      logger.error('[PubSub] 解析失效消息失败:', error);
    }
  }

  /**
   * 发布失效消息
   * @param payload - 失效载荷
   */
  async publish(payload: InvalidationPayload): Promise<void> {
    if (!this.isInitialized || !this.publisher) {
      logger.warn('[PubSub] 服务未初始化，跳过发布');
      return;
    }

    try {
      const message = JSON.stringify(payload);
      const subscribers = await this.publisher.publish(this.CHANNEL, message);

      logger.info(
        `[PubSub] 发布失效消息: scope=${payload.scope} ` +
          `key=${payload.key || '*'} subscribers=${subscribers}`
      );
    } catch (error) {
      logger.error('[PubSub] 发布失效消息失败:', error);
      throw error;
    }
  }

  /**
   * 订阅失效消息（注册回调）
   * @param callback - 回调函数
   * @returns 取消订阅函数
   */
  subscribe(callback: InvalidationCallback): () => void {
    this.callbacks.push(callback);

    // 返回取消订阅函数
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index !== -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * 批量发布失效消息（合并广播）
   * @param payloads - 失效载荷数组
   */
  async publishBatch(payloads: InvalidationPayload[]): Promise<void> {
    if (!this.isInitialized || !this.publisher) {
      logger.warn('[PubSub] 服务未初始化，跳过批量发布');
      return;
    }

    try {
      const pipeline = this.publisher.pipeline();

      for (const payload of payloads) {
        const message = JSON.stringify(payload);
        pipeline.publish(this.CHANNEL, message);
      }

      const results = await pipeline.exec();

      const totalSubscribers = results
        ? results.reduce((sum: number, [, count]) => sum + ((count as number) || 0), 0)
        : 0;

      logger.info(
        `[PubSub] 批量发布失效消息: count=${payloads.length} ` +
          `totalSubscribers=${totalSubscribers}`
      );
    } catch (error) {
      logger.error('[PubSub] 批量发布失效消息失败:', error);
      throw error;
    }
  }

  /**
   * 关闭Pub/Sub服务
   */
  async close(): Promise<void> {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }

      if (this.subscriber) {
        await this.subscriber.unsubscribe(this.CHANNEL);
        this.subscriber.disconnect();
      }

      if (this.publisher) {
        this.publisher.disconnect();
      }

      this.isInitialized = false;
      this.callbacks = [];

      logger.info('[PubSub] 服务已关闭');
    } catch (error) {
      logger.error('[PubSub] 关闭服务失败:', error);
      throw error;
    }
  }

  /**
   * 健康检查
   * @returns 健康状态
   */
  async healthCheck(): Promise<{
    status: string;
    publisher: string;
    subscriber: string;
    subscribers: number;
  }> {
    try {
      const publisherStatus = this.publisher?.status || 'disconnected';
      const subscriberStatus = this.subscriber?.status || 'disconnected';

      // 测试发布功能
      let subscribers = 0;
      if (this.publisher && publisherStatus === 'ready') {
        subscribers = await this.publisher.publish(
          'health:check',
          JSON.stringify({ timestamp: Date.now() })
        );
      }

      const status =
        publisherStatus === 'ready' && subscriberStatus === 'ready' ? 'healthy' : 'unhealthy';

      return {
        status,
        publisher: publisherStatus,
        subscriber: subscriberStatus,
        subscribers
      };
    } catch (error) {
      logger.error('[PubSub] 健康检查失败:', error);
      return {
        status: 'unhealthy',
        publisher: 'error',
        subscriber: 'error',
        subscribers: 0
      };
    }
  }
}

// 单例导出
export const pubsub = new PubSubService();

/**
 * 辅助函数：发布配置失效消息
 * @param scope - 作用域
 * @param key - 配置key（可选）
 * @param version - 版本号（可选）
 */
export async function invalidateConfig(
  scope: string,
  key?: string,
  version?: string
): Promise<void> {
  await pubsub.publish({
    scope,
    key,
    version: version || 'latest',
    timestamp: Date.now()
  });
}

/**
 * 辅助函数：批量发布配置失效消息
 * @param invalidations - 失效配置数组
 */
export async function invalidateConfigBatch(
  invalidations: Array<{ scope: string; key?: string; version?: string }>
): Promise<void> {
  const payloads: InvalidationPayload[] = invalidations.map((inv) => ({
    scope: inv.scope,
    key: inv.key,
    version: inv.version || 'latest',
    timestamp: Date.now()
  }));

  await pubsub.publishBatch(payloads);
}

export default pubsub;
