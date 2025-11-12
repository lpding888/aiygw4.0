import { Redis, type RedisOptions } from 'ioredis';
import { redisConfig } from './redis.js';

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const baseConnection: RedisOptions = {
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  db: parseNumber(process.env.REDIS_BULLMQ_DB, redisConfig.db ?? 2),
  maxRetriesPerRequest: null, // BullMQ官方要求
  enableReadyCheck: false,
  keyPrefix: process.env.BULLMQ_PREFIX ?? 'ai_photo',
  lazyConnect: false
};

export const bullQueueSettings = {
  prefix: baseConnection.keyPrefix
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

export const createBullConnection = (overrides?: Partial<RedisOptions>): Redis =>
  new Redis({
    ...baseConnection,
    ...overrides
  });

export const getBullConnectionOptions = (): RedisOptions => ({
  ...baseConnection
});
