import { Redis, type RedisOptions } from 'ioredis';
import logger from './logger.js';

const buildRedisUrl = (): string => {
  const directUrl = process.env.REDIS_URL?.trim();
  if (directUrl) {
    return directUrl;
  }

  const protocol = process.env.REDIS_TLS === 'true' ? 'rediss:' : 'redis:';
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = process.env.REDIS_PORT ?? '6379';
  const db = process.env.REDIS_DB ?? '0';
  const url = new URL(`${protocol}//${host}:${port}/${db}`);

  if (process.env.REDIS_PASSWORD?.length) {
    url.password = process.env.REDIS_PASSWORD;
  }

  return url.toString();
};

type AsyncOrSync<T> = T | Promise<T>;

export type MessageHandler = (message: string, channel: string) => AsyncOrSync<void>;
export type PatternMessageHandler = (
  message: string,
  channel: string,
  pattern: string
) => AsyncOrSync<void>;

interface ManagedClients {
  command: Redis | null;
  subscriber: Redis | null;
  patternSubscriber: Redis | null;
}

export class RedisManager {
  private clients: ManagedClients = {
    command: null,
    subscriber: null,
    patternSubscriber: null
  };

  private channelHandlers = new Map<string, Set<MessageHandler>>();
  private patternHandlers = new Map<string, Set<PatternMessageHandler>>();
  private readonly redisUrl: string = buildRedisUrl();
  private readonly baseOptions: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: null as unknown as number | null,
    enableReadyCheck: true
  };

  private createClient(label: keyof ManagedClients): Redis {
    const client = new Redis(this.redisUrl, this.baseOptions);

    client.on('error', (error: unknown) => {
      logger.error(`[Redis] ${label} 客户端错误`, { error });
    });

    client.on('reconnecting', () => {
      logger.warn(`[Redis] ${label} 客户端正在重连`);
    });

    return client;
  }

  private async getCommandClient(): Promise<Redis> {
    if (!this.clients.command) {
      this.clients.command = this.createClient('command');
    }
    return this.clients.command;
  }

  private async getSubscriberClient(): Promise<Redis> {
    if (!this.clients.subscriber) {
      const subscriber = this.createClient('subscriber');
      subscriber.on('message', (channel: string, message: string) => {
        const handlers = this.channelHandlers.get(channel);
        if (!handlers) return;
        handlers.forEach((handler) => {
          Promise.resolve(handler(message, channel)).catch((error) => {
            logger.error('[Redis] 订阅回调执行失败', { channel, error });
          });
        });
      });
      this.clients.subscriber = subscriber;
    }
    return this.clients.subscriber;
  }

  private async getPatternSubscriber(): Promise<Redis> {
    if (!this.clients.patternSubscriber) {
      const patternSubscriber = this.createClient('patternSubscriber');
      patternSubscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
        const handlers = this.patternHandlers.get(pattern);
        if (!handlers) return;
        handlers.forEach((handler) => {
          Promise.resolve(handler(message, channel, pattern)).catch((error) => {
            logger.error('[Redis] 模式订阅回调执行失败', { pattern, channel, error });
          });
        });
      });
      this.clients.patternSubscriber = patternSubscriber;
    }
    return this.clients.patternSubscriber;
  }

  // ===== 基础命令 =====
  async get(key: string): Promise<string | null> {
    const client = await this.getCommandClient();
    return client.get(key);
  }

  async set(key: string, value: string): Promise<'OK' | null> {
    const client = await this.getCommandClient();
    return client.set(key, value);
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    const client = await this.getCommandClient();
    return client.setex(key, seconds, value);
  }

  async del(...keys: string[]): Promise<number> {
    const client = await this.getCommandClient();
    return client.del(...keys);
  }

  async exists(key: string): Promise<number> {
    const client = await this.getCommandClient();
    return client.exists(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    const client = await this.getCommandClient();
    return client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    const client = await this.getCommandClient();
    return client.ttl(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const client = await this.getCommandClient();
    return client.keys(pattern);
  }

  async flushall(): Promise<'OK'> {
    const client = await this.getCommandClient();
    return client.flushall();
  }

  async publish(channel: string, message: string): Promise<number> {
    const client = await this.getCommandClient();
    return client.publish(channel, message);
  }

  // ===== 列表操作 (部分示例，保留原有API) =====
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const client = await this.getCommandClient();
    return client.lrange(key, start, stop);
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    const client = await this.getCommandClient();
    return client.lpush(key, ...values);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    const client = await this.getCommandClient();
    return client.rpush(key, ...values);
  }

  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    const client = await this.getCommandClient();
    return client.ltrim(key, start, stop);
  }

  // ===== Set 操作 =====
  async sadd(key: string, ...members: string[]): Promise<number> {
    const client = await this.getCommandClient();
    return client.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const client = await this.getCommandClient();
    return client.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    const client = await this.getCommandClient();
    return client.smembers(key);
  }

  // ===== Pub/Sub =====
  async subscribe(channel: string, handler: MessageHandler): Promise<() => Promise<void>> {
    const subscriber = await this.getSubscriberClient();
    let handlers = this.channelHandlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.channelHandlers.set(channel, handlers);
      await subscriber.subscribe(channel);
      logger.info('[Redis] 订阅频道', { channel });
    }
    handlers.add(handler);
    return async () => this.unsubscribe(channel, handler);
  }

  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    const subscriber = this.clients.subscriber;
    if (!subscriber) {
      return;
    }

    const handlers = this.channelHandlers.get(channel);
    if (!handlers) {
      return;
    }

    if (handler) {
      handlers.delete(handler);
    } else {
      handlers.clear();
    }

    if (handlers.size === 0) {
      await subscriber.unsubscribe(channel);
      this.channelHandlers.delete(channel);
      logger.info('[Redis] 取消订阅频道', { channel });
    }
  }

  async psubscribe(pattern: string, handler: PatternMessageHandler): Promise<() => Promise<void>> {
    const subscriber = await this.getPatternSubscriber();
    let handlers = this.patternHandlers.get(pattern);
    if (!handlers) {
      handlers = new Set();
      this.patternHandlers.set(pattern, handlers);
      await subscriber.psubscribe(pattern);
      logger.info('[Redis] 模式订阅', { pattern });
    }
    handlers.add(handler);
    return async () => this.punsubscribe(pattern, handler);
  }

  async punsubscribe(pattern: string, handler?: PatternMessageHandler): Promise<void> {
    const subscriber = this.clients.patternSubscriber;
    if (!subscriber) {
      return;
    }

    const handlers = this.patternHandlers.get(pattern);
    if (!handlers) {
      return;
    }

    if (handler) {
      handlers.delete(handler);
    } else {
      handlers.clear();
    }

    if (handlers.size === 0) {
      await subscriber.punsubscribe(pattern);
      this.patternHandlers.delete(pattern);
      logger.info('[Redis] 取消模式订阅', { pattern });
    }
  }
}

const redisManager = new RedisManager();

export default redisManager;
