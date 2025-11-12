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

type PoolDefaults = {
  min: number;
  max: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
};

const buildPoolConfig = (defaults: PoolDefaults): Knex.PoolConfig => ({
  min: parseIntWithFallback(process.env.DATABASE_POOL_MIN, defaults.min),
  max: parseIntWithFallback(process.env.DATABASE_POOL_MAX, defaults.max),
  acquireTimeoutMillis: parseIntWithFallback(
    process.env.DATABASE_POOL_ACQUIRE_TIMEOUT,
    defaults.acquireTimeoutMillis
  ),
  createTimeoutMillis: parseIntWithFallback(
    process.env.DATABASE_POOL_CREATE_TIMEOUT,
    defaults.createTimeoutMillis
  ),
  destroyTimeoutMillis: parseIntWithFallback(
    process.env.DATABASE_POOL_DESTROY_TIMEOUT,
    defaults.destroyTimeoutMillis
  ),
  idleTimeoutMillis: parseIntWithFallback(
    process.env.DATABASE_POOL_IDLE,
    defaults.idleTimeoutMillis
  ),
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200,
  propagateCreateError: false
});

export type Environment = 'development' | 'test' | 'production';

export const knexConfig: Record<Environment, Knex.Config> = {
  development: {
    client: 'mysql2',
    connection: {
      ...baseConnection,
      database: process.env.DB_NAME ?? 'ai_photo'
    },
    pool: buildPoolConfig({
      min: 2,
      max: 15,
      acquireTimeoutMillis: 8_000,
      createTimeoutMillis: 4_000,
      destroyTimeoutMillis: 4_000,
      idleTimeoutMillis: 30_000
    }),
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
    pool: buildPoolConfig({
      min: 1,
      max: 5,
      acquireTimeoutMillis: 5_000,
      createTimeoutMillis: 3_000,
      destroyTimeoutMillis: 3_000,
      idleTimeoutMillis: 10_000
    }),
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
    pool: buildPoolConfig({
      min: 5,
      max: 40,
      acquireTimeoutMillis: 10_000,
      createTimeoutMillis: 5_000,
      destroyTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000
    }),
    migrations: {
      directory: './src/db/migrations',
      tableName: 'knex_migrations'
    }
  }
};

export default knexConfig;
