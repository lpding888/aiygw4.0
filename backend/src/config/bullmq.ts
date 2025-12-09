import { Redis, type RedisOptions } from 'ioredis';
import configManager from './config.manager.js';
import logger from '../utils/logger.js';
import { redisConfig } from './redis.js';

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

let baseConnection: RedisOptions = {
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  db: parseNumber(process.env.REDIS_BULLMQ_DB, redisConfig.db ?? 2),
  maxRetriesPerRequest: null, // BullMQ官方要求
  enableReadyCheck: false,
  lazyConnect: false
};

export const bullQueueSettings = {
  prefix: process.env.BULLMQ_PREFIX ?? 'ai_photo'
};

export const bullJobDefaults = {
  removeOnComplete: {
    age: parseNumber(process.env.BULLMQ_KEEP_COMPLETED_SECONDS, 60 * 60 * 24),
    count: parseNumber(process.env.BULLMQ_KEEP_COMPLETED_COUNT, 1000)
  },
  removeOnFail: parseNumber(process.env.BULLMQ_KEEP_FAILED_COUNT, 500),
  attempts: parseNumber(process.env.BULLMQ_DEFAULT_ATTEMPTS, 3),
  backoff: {
    type: 'exponential' as const,
    delay: 2000
  }
};

let bullConfigLoaded = false;

/**
 * 从 ConfigManager 加载 BullMQ 配置，失败时回退到环境变量/默认值
 * 重要：使用 useDynamic=false 避免循环依赖（数据库可能未初始化）
 */
export async function loadBullmqConfig(): Promise<void> {
  if (bullConfigLoaded) return;
  try {
    // 使用静态配置避免循环依赖
    const host = await configManager.getString('REDIS_HOST', baseConnection.host as string, false);
    const port = await configManager.getNumber('REDIS_PORT', Number(baseConnection.port ?? 6379), false);
    const password = (await configManager.get('REDIS_PASSWORD', undefined, false)) || baseConnection.password;
    const bullDb = await configManager.getNumber(
      'REDIS_BULLMQ_DB',
      Number(baseConnection.db ?? 2),
      false
    );

    baseConnection = {
      ...baseConnection,
      host,
      port,
      password: password || undefined,
      db: bullDb
    };

    bullQueueSettings.prefix = await configManager.getString(
      'BULLMQ_PREFIX',
      bullQueueSettings.prefix,
      false
    );

    bullJobDefaults.removeOnComplete.age = await configManager.getNumber(
      'BULLMQ_KEEP_COMPLETED_SECONDS',
      bullJobDefaults.removeOnComplete.age as number,
      false
    );
    bullJobDefaults.removeOnComplete.count = await configManager.getNumber(
      'BULLMQ_KEEP_COMPLETED_COUNT',
      bullJobDefaults.removeOnComplete.count as number,
      false
    );
    bullJobDefaults.removeOnFail = await configManager.getNumber(
      'BULLMQ_KEEP_FAILED_COUNT',
      bullJobDefaults.removeOnFail as number,
      false
    );
    bullJobDefaults.attempts = await configManager.getNumber(
      'BULLMQ_DEFAULT_ATTEMPTS',
      bullJobDefaults.attempts as number,
      false
    );

    bullConfigLoaded = true;
    logger.info('[BullMQ] 配置已从 ConfigManager 加载完成', {
      host,
      port,
      db: bullDb,
      prefix: bullQueueSettings.prefix
    });
  } catch (error) {
    logger.warn('[BullMQ] 读取 ConfigManager 失败，继续使用环境变量配置', error);
    bullConfigLoaded = true; // 避免重复打日志
  }
}

export const createBullConnection = (overrides?: Partial<RedisOptions>): Redis =>
  new Redis({
    ...baseConnection,
    ...overrides
  });

export const getBullConnectionOptions = (): RedisOptions => ({
  ...baseConnection
});
