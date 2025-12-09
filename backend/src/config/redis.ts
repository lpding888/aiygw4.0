/**
 * Redis配置 - 使用ConfigManager统一配置管理
 * 支持主Redis和BullMQ专用Redis实例
 */

import { Redis as RedisClient, type RedisOptions } from 'ioredis';
import configManager from './config.manager.js';
import logger from '../utils/logger.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  current: number;
}

let _redis: RedisClient | null = null;
let _bullmqRedis: RedisClient | null = null;

/**
 * 兼容旧代码的同步配置对象，初始化后会被更新为ConfigManager提供的值
 */
export const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number.parseInt(process.env.REDIS_DB ?? '0', 10)
};

/**
 * 初始化主Redis客户端
 */
export async function initializeRedis(): Promise<RedisClient> {
  if (_redis) {
    logger.info('[Redis] 主Redis已初始化，返回现有连接');
    return _redis;
  }

  try {
    logger.info('[Redis] 正在初始化主Redis客户端...');

    // 从ConfigManager获取Redis配置（使用静态配置避免循环依赖）
    const resolvedConfig: RedisOptions = {
      host: await configManager.getString('REDIS_HOST', 'localhost', false),
      port: await configManager.getNumber('REDIS_PORT', 6379, false),
      password: (await configManager.get('REDIS_PASSWORD', undefined, false)) || undefined,
      db: await configManager.getNumber('REDIS_DB', 0, false),
      retryStrategy: (times): number => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true  // 使用懒连接，避免重复connect错误
    };

    // 更新兼容性配置对象
    Object.assign(redisConfig, {
      host: resolvedConfig.host,
      port: resolvedConfig.port,
      password: resolvedConfig.password,
      db: resolvedConfig.db
    });

    _redis = new RedisClient(resolvedConfig);

    // 事件监听
    _redis.on('connect', () => {
      logger.info('[Redis] ✅ 连接成功', {
        host: resolvedConfig.host,
        port: resolvedConfig.port,
        db: resolvedConfig.db
      });
    });

    _redis.on('ready', () => {
      logger.info('[Redis] ✅ 准备就绪');
    });

    _redis.on('error', (err) => {
      logger.error(`[Redis] ❌ 连接错误: ${err.message}`);
    });

    _redis.on('close', () => {
      logger.warn('[Redis] ⚠️  连接关闭');
    });

    _redis.on('reconnecting', () => {
      logger.info('[Redis] 🔄 正在重连...');
    });

    // 等待连接就绪（lazyConnect=true时需要手动connect）
    await _redis.connect();

    logger.info('[Redis] 主Redis客户端初始化完成');
    return _redis;
  } catch (error) {
    logger.error('[Redis] ❌ 主Redis初始化失败', error);
    throw error;
  }
}

/**
 * 初始化BullMQ专用Redis客户端
 */
export async function initializeBullMQRedis(): Promise<RedisClient> {
  if (_bullmqRedis) {
    logger.info('[Redis] BullMQ Redis已初始化，返回现有连接');
    return _bullmqRedis;
  }

  try {
    logger.info('[Redis] 正在初始化BullMQ专用Redis客户端...');

    // 从ConfigManager获取Redis配置（使用静态配置避免循环依赖）
    const bullmqRedisConfig: RedisOptions = {
      host: await configManager.getString('REDIS_HOST', 'localhost', false),
      port: await configManager.getNumber('REDIS_PORT', 6379, false),
      password: (await configManager.get('REDIS_PASSWORD', undefined, false)) || undefined,
      db: await configManager.getNumber('REDIS_BULLMQ_DB', 2, false), // BullMQ使用独立DB
      retryStrategy: (times): number => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true  // 使用懒连接，避免重复connect错误
    };

    _bullmqRedis = new RedisClient(bullmqRedisConfig);

    // 事件监听
    _bullmqRedis.on('connect', () => {
      logger.info('[Redis] ✅ BullMQ Redis连接成功', {
        host: bullmqRedisConfig.host,
        port: bullmqRedisConfig.port,
        db: bullmqRedisConfig.db
      });
    });

    _bullmqRedis.on('ready', () => {
      logger.info('[Redis] ✅ BullMQ Redis准备就绪');
    });

    _bullmqRedis.on('error', (err) => {
      logger.error(`[Redis] ❌ BullMQ Redis错误: ${err.message}`);
    });

    _bullmqRedis.on('close', () => {
      logger.warn('[Redis] ⚠️  BullMQ Redis连接关闭');
    });

    _bullmqRedis.on('reconnecting', () => {
      logger.info('[Redis] 🔄 BullMQ Redis正在重连...');
    });

    // 等待连接就绪（lazyConnect=true时需要手动connect）
    await _bullmqRedis.connect();

    logger.info('[Redis] BullMQ Redis客户端初始化完成');
    return _bullmqRedis;
  } catch (error) {
    logger.error('[Redis] ❌ BullMQ Redis初始化失败', error);
    throw error;
  }
}

/**
 * 获取主Redis实例
 */
export function getRedis(): RedisClient {
  if (!_redis) {
    throw new Error('Redis未初始化，请先调用 initializeRedis()');
  }
  return _redis;
}

/**
 * 获取BullMQ Redis实例
 */
export function getBullMQRedis(): RedisClient {
  if (!_bullmqRedis) {
    throw new Error('BullMQ Redis未初始化，请先调用 initializeBullMQRedis()');
  }
  return _bullmqRedis;
}

/**
 * 创建新的Redis客户端（按需创建）
 */
export async function createRedisClient(overrides: Partial<RedisOptions> = {}): Promise<RedisClient> {
  const baseConfig: RedisOptions = {
    host: await configManager.getString('REDIS_HOST', 'localhost', false),
    port: await configManager.getNumber('REDIS_PORT', 6379, false),
    password: await configManager.get('REDIS_PASSWORD', undefined, false) || undefined,
    db: await configManager.getNumber('REDIS_DB', 0, false),
    retryStrategy: (times): number => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true  // 使用懒连接
  };

  return new RedisClient({
    ...baseConfig,
    ...overrides
  });
}

/**
 * 限流检查（使用滑动窗口算法）
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const redis = _redis ?? (await initializeRedis());
    const multi = redis.multi();
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // 使用Redis ZSET实现滑动窗口限流
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zadd(key, now, `${now}`);
    multi.zcard(key);
    multi.expire(key, windowSeconds);

    const results = (await multi.exec()) ?? [];
    const count = Number(results[2]?.[1] ?? 0);

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetAt = now + windowSeconds * 1000;

    return {
      allowed,
      remaining,
      resetAt,
      current: count
    };
  } catch (error) {
    logger.error(`[Redis] 限流检查失败: ${(error as Error).message}`);
    // 限流失败时，默认允许请求（降级策略）
    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + windowSeconds * 1000,
      current: 0
    };
  }
}

/**
 * 优雅关闭Redis连接
 */
export async function closeRedis(): Promise<void> {
  const promises: Promise<void>[] = [];

  if (_redis) {
    logger.info('[Redis] 🔌 正在关闭主Redis连接...');
    promises.push(
      _redis.quit().then(() => {
        _redis = null;
        logger.info('[Redis] ✅ 主Redis连接已关闭');
      }).catch((error) => {
        logger.error(`[Redis] ❌ 关闭主Redis失败: ${(error as Error).message}`);
      })
    );
  }

  if (_bullmqRedis) {
    logger.info('[Redis] 🔌 正在关闭BullMQ Redis连接...');
    promises.push(
      _bullmqRedis.quit().then(() => {
        _bullmqRedis = null;
        logger.info('[Redis] ✅ BullMQ Redis连接已关闭');
      }).catch((error) => {
        logger.error(`[Redis] ❌ 关闭BullMQ Redis失败: ${(error as Error).message}`);
      })
    );
  }

  await Promise.all(promises);
}

/**
 * 导出主Redis实例 (使用Proxy实现延迟初始化和向后兼容)
 */
export const redis = new Proxy({} as RedisClient, {
  get(target, prop) {
    if (!_redis) {
      throw new Error(
        'Redis未初始化，请先在server.ts中调用 initializeRedis()。\n' +
        '提示: 在app启动流程中添加: await initializeRedis();'
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_redis as any)[prop];
  }
});
