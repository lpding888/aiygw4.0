import type { Knex } from 'knex';

const parseIntWithFallback = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const baseConnection = {
  host: process.env.DB_HOST ?? 'localhost',
  port: parseIntWithFallback(process.env.DB_PORT, 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD,
  charset: 'utf8mb4'
} satisfies Partial<Knex.MySql2ConnectionConfig>;

export type Environment = 'development' | 'test' | 'production';

export const knexConfig: Record<Environment, Knex.Config> = {
  development: {
    client: 'mysql2',
    connection: {
      ...baseConnection,
      database: process.env.DB_NAME ?? 'ai_photo'
    },
    pool: {
      // P0-003优化: 提高连接池大小,避免冷启动和高并发时的连接等待
      min: parseIntWithFallback(process.env.DATABASE_POOL_MIN, 10), // 避免冷启动,保持至少10个连接
      max: parseIntWithFallback(process.env.DATABASE_POOL_MAX, 100), // 支持高并发,最多100个连接
      acquireTimeoutMillis: 10_000, // 获取连接超时10秒(原60秒太长)
      createTimeoutMillis: 5_000, // 创建连接超时5秒(原30秒太长)
      destroyTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000, // 空闲连接30秒后回收
      reapIntervalMillis: 1_000, // 每秒检查一次过期连接
      createRetryIntervalMillis: 200,
      propagateCreateError: false // 不传播创建错误(允许重试)
    },
    migrations: {
      directory: './src/db/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './src/db/seeds'
    }
  },
  test: {
    client: 'mysql2',
    connection: {
      ...baseConnection,
      database: 'test_ai_photo'
    },
    pool: {
      min: 2,
      max: 5
    },
    migrations: {
      directory: './src/db/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './src/db/seeds'
    }
  },
  production: {
    client: 'mysql2',
    connection: {
      ...baseConnection,
      database: process.env.DB_NAME ?? 'ai_photo'
    },
    pool: {
      // P0-003优化: 提高生产环境连接池大小,支持高并发
      min: parseIntWithFallback(process.env.DATABASE_POOL_MIN, 10), // 避免冷启动,保持至少10个连接
      max: parseIntWithFallback(process.env.DATABASE_POOL_MAX, 100), // 支持高并发,最多100个连接
      acquireTimeoutMillis: 10_000, // 获取连接超时10秒(原60秒太长)
      createTimeoutMillis: 5_000, // 创建连接超时5秒(原30秒太长)
      destroyTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000, // 空闲连接30秒后回收(原5分钟太长)
      reapIntervalMillis: 1_000, // 每秒检查一次过期连接
      createRetryIntervalMillis: 200, // 创建连接失败后重试间隔(原100ms改200ms)
      propagateCreateError: false // 不传播创建错误(允许重试)
    },
    migrations: {
      directory: './src/db/migrations',
      tableName: 'knex_migrations'
    }
  }
};

export default knexConfig;
