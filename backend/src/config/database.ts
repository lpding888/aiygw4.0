/**
 * 数据库连接配置 - TypeScript ESM版本
 * 艹！P0-003优化:连接池监控+健康检查+优雅关闭
 */

import knex from 'knex';
import knexConfig, { type Environment as KnexEnvironment } from './knex-config.js';
import logger from '../utils/logger.js';
import metricsService from '../services/metrics.service.js';

const environment = (process.env.NODE_ENV ?? 'development') as KnexEnvironment;
const config = knexConfig[environment] ?? knexConfig.development;

// P0-003: 添加连接池配置(健康检查)
interface PoolConnection {
  query: (sql: string, callback: (err: Error | null) => void) => void;
}

const poolConfig = {
  ...config.pool,
  propagateCreateError: false,
  afterCreate: (conn: PoolConnection, done: (err: Error | null, conn?: PoolConnection) => void) => {
    // 健康检查: 执行SELECT 1确保连接可用
    conn.query('SELECT 1', (err: Error | null) => {
      if (err) {
        logger.error(`[DATABASE] ❌ 连接健康检查失败: ${err.message}`);
      } else {
        logger.debug('[DATABASE] ✅ 新连接创建成功并通过健康检查');
      }
      done(err, conn);
    });
  }
};

export const db = knex({
  ...config,
  pool: poolConfig
});

export type Database = typeof db;

// P0-003: 连接池监控 - 每30秒输出一次连接池指标
let monitorInterval: NodeJS.Timeout | null = null;

if (process.env.NODE_ENV !== 'test') {
  // 测试环境不启用监控(避免干扰测试输出)
  monitorInterval = setInterval(() => {
    try {
      interface PoolStats {
        numUsed?: () => number;
        numFree?: () => number;
        numPendingAcquires?: () => number;
        min?: number;
        max?: number;
      }

      const pool = (db.client as unknown as { pool?: PoolStats }).pool;
      if (pool) {
        const used = pool.numUsed?.() ?? 0;
        const free = pool.numFree?.() ?? 0;
        const pending = pool.numPendingAcquires?.() ?? 0;
        logger.info('[DATABASE POOL] 📊 连接池状态:', {
          used,
          free,
          pending,
          min: pool.min ?? 0,
          max: pool.max ?? 0
        });
        metricsService.setDbPoolStats({ used, free, pending });
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn(`[DATABASE POOL] 获取连接池状态失败: ${err.message}`);
    }
  }, 30000); // 30秒

  // 艹！使用unref防止定时器阻止进程退出
  monitorInterval.unref();
}

// P0-003: 优雅关闭
process.on('SIGINT', async () => {
  logger.info('[DATABASE] 🔌 正在关闭数据库连接池...');
  try {
    await db.destroy();
    logger.info('[DATABASE] ✅ 数据库连接池已关闭');
    process.exit(0);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`[DATABASE] ❌ 关闭数据库连接池失败: ${err.message}`);
    process.exit(1);
  }
});

// 进程退出时也关闭连接池
process.on('SIGTERM', async () => {
  logger.info('[DATABASE] 🔌 收到SIGTERM,正在关闭数据库连接池...');
  try {
    await db.destroy();
    logger.info('[DATABASE] ✅ 数据库连接池已关闭');
    process.exit(0);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`[DATABASE] ❌ 关闭数据库连接池失败: ${err.message}`);
    process.exit(1);
  }
});
