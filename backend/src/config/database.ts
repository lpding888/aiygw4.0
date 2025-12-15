/**
 * 数据库连接配置 - 使用ConfigManager统一配置管理
 * P0-003优化: 连接池监控 + 健康检查 + 优雅关闭
 */

import knex, { type Knex } from 'knex';
import configManager from './config.manager.js';
import logger from '../utils/logger.js';
import metricsService from '../services/metrics.service.js';

// 连接池连接类型
interface PoolConnection {
  query: (sql: string, callback: (err: Error | null) => void) => void;
}

// 连接池统计类型
interface PoolStats {
  numUsed?: () => number;
  numFree?: () => number;
  numPendingAcquires?: () => number;
  min?: number;
  max?: number;
}

let _db: Knex | null = null;
let monitorInterval: NodeJS.Timeout | null = null;

/**
 * 初始化数据库连接
 * 使用ConfigManager获取配置，支持配置验证
 */
export async function initializeDatabase(): Promise<Knex> {
  if (_db) {
    logger.info('[DATABASE] 数据库已初始化，返回现有连接');
    return _db;
  }

  try {
    logger.info('[DATABASE] 正在初始化数据库连接...');

    // 从ConfigManager获取数据库配置
    // 重要：useDynamic=false 避免循环依赖（db未初始化时无法查询system_configs表）
    const dbConfig = {
      host: await configManager.getRequired('DB_HOST', false),
      port: await configManager.getNumber('DB_PORT', 3306, false),
      user: await configManager.getRequired('DB_USER', false),
      password: await configManager.getRequired('DB_PASSWORD', false),
      database: await configManager.getRequired('DB_NAME', false),
      charset: 'utf8mb4'
    };

    // 连接池配置 (同样使用静态配置)
    const poolConfig = {
      min: await configManager.getNumber('DATABASE_POOL_MIN', 5, false),
      max: await configManager.getNumber('DATABASE_POOL_MAX', 40, false),
      acquireTimeoutMillis: await configManager.getNumber('DATABASE_POOL_ACQUIRE_TIMEOUT', 10000, false),
      createTimeoutMillis: 5000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: await configManager.getNumber('DATABASE_POOL_IDLE', 30000, false),
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false,

      // P0-003: 健康检查 - 每个新连接都执行SELECT 1验证
      afterCreate: (conn: PoolConnection, done: (err: Error | null, conn?: PoolConnection) => void) => {
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

    // 创建Knex实例
    _db = knex({
      client: 'mysql2',
      connection: dbConfig,
      pool: poolConfig,
      migrations: {
        directory: './src/db/migrations',
        tableName: 'knex_migrations'
      },
      seeds: {
        directory: './src/db/seeds'
      },
      log: {
        warn(message) {
          logger.warn('[DATABASE] ' + message);
        },
        error(message) {
          logger.error('[DATABASE] ' + message);
        },
        deprecate(message) {
          logger.warn('[DATABASE] Deprecated: ' + message);
        },
        debug(message) {
          logger.debug('[DATABASE] ' + message);
        }
      }
    });

    // 慢查询监控配置 (使用静态配置)
    const slowQueryThresholdMs = await configManager.getNumber('SLOW_QUERY_THRESHOLD_MS', 1000, false);
    const queryStartTimes = new Map<string, number>();

    // 监听查询开始事件
    _db.on('query', (query: { __knexQueryUid?: string; sql?: string }) => {
      if (query.__knexQueryUid) {
        queryStartTimes.set(query.__knexQueryUid, Date.now());
      }
    });

    // 监听查询完成事件 - 检测慢查询
    _db.on('query-response', (_response: unknown, query: { __knexQueryUid?: string; sql?: string }) => {
      if (query.__knexQueryUid) {
        const startTime = queryStartTimes.get(query.__knexQueryUid);
        queryStartTimes.delete(query.__knexQueryUid);

        if (startTime) {
          const duration = Date.now() - startTime;

          // 记录慢查询
          if (duration >= slowQueryThresholdMs) {
            const sql = query.sql || 'UNKNOWN';
            const truncatedSql = sql.length > 200 ? sql.slice(0, 200) + '...' : sql;

            logger.warn('[DATABASE SLOW QUERY] 🐢 慢查询检测', {
              duration: `${duration}ms`,
              threshold: `${slowQueryThresholdMs}ms`,
              sql: truncatedSql
            });

            // 上报慢查询指标
            metricsService.recordTaskFailed('database', 'slow_query');
          }
        }
      }
    });

    // 监听查询错误事件
    _db.on('query-error', (error: Error, query: { __knexQueryUid?: string; sql?: string }) => {
      if (query.__knexQueryUid) {
        queryStartTimes.delete(query.__knexQueryUid);
      }

      const sql = query.sql || 'UNKNOWN';
      const truncatedSql = sql.length > 200 ? sql.slice(0, 200) + '...' : sql;

      logger.error('[DATABASE QUERY ERROR] ❌ 查询执行失败', {
        error: error.message,
        sql: truncatedSql
      });

      // 上报查询错误指标
      metricsService.recordTaskFailed('database', 'query_error');
    });

    // 测试连接
    await _db.raw('SELECT 1');
    logger.info('[DATABASE] ✅ 数据库连接成功', {
      host: dbConfig.host,
      database: dbConfig.database,
      poolMin: poolConfig.min,
      poolMax: poolConfig.max,
      slowQueryThreshold: `${slowQueryThresholdMs}ms`
    });

    // P0-003: 启动连接池监控（非测试环境）
    const nodeEnv = await configManager.getString('NODE_ENV', 'development');
    if (nodeEnv !== 'test') {
      startPoolMonitoring();
    }

    return _db;
  } catch (error) {
    logger.error('[DATABASE] ❌ 数据库连接失败', error);
    throw error;
  }
}

/**
 * 获取数据库实例
 */
export function getDatabase(): Knex {
  if (!_db) {
    throw new Error('数据库未初始化，请先调用 initializeDatabase()');
  }
  return _db;
}

/**
 * P0-003: 连接池监控
 * 每30秒输出一次连接池指标
 */
function startPoolMonitoring(): void {
  if (monitorInterval) {
    return; // 已经在监控中
  }

  monitorInterval = setInterval(() => {
    try {
      if (!_db) return;

      const pool = (_db.client as unknown as { pool?: PoolStats }).pool;
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

        // 上报Prometheus指标
        metricsService.setDbPoolStats({ used, free, pending });
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn(`[DATABASE POOL] 获取连接池状态失败: ${err.message}`);
    }
  }, 30000); // 30秒

  // 使用unref防止定时器阻止进程退出
  monitorInterval.unref();

  logger.info('[DATABASE POOL] 连接池监控已启动');
}

/**
 * 停止连接池监控
 */
function stopPoolMonitoring(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('[DATABASE POOL] 连接池监控已停止');
  }
}

/**
 * P0-003: 优雅关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (!_db) {
    logger.warn('[DATABASE] 数据库未初始化，无需关闭');
    return;
  }

  logger.info('[DATABASE] 🔌 正在关闭数据库连接池...');

  try {
    // 停止监控
    stopPoolMonitoring();

    // 销毁连接池
    await _db.destroy();
    _db = null;

    logger.info('[DATABASE] ✅ 数据库连接池已关闭');
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`[DATABASE] ❌ 关闭数据库连接池失败: ${err.message}`);
    throw err;
  }
}

/**
 * 导出db实例 (使用Proxy实现延迟初始化和向后兼容)
 * 注意：Knex既可以作为对象使用(db.select)，也可以作为函数使用(db('table_name'))
 * 因此代理需要同时支持 get 和 apply trap
 */
const dbHandler: ProxyHandler<Knex> = {
  get(_target, prop) {
    if (!_db) {
      throw new Error(
        '数据库未初始化，请先在server.ts中调用 initializeDatabase()。\n' +
        '提示: 在app启动流程中添加: await initializeDatabase();'
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_db as any)[prop];
  },
  apply(_target, _thisArg, args) {
    if (!_db) {
      throw new Error(
        '数据库未初始化，请先在server.ts中调用 initializeDatabase()。\n' +
        '提示: 在app启动流程中添加: await initializeDatabase();'
      );
    }
    // Knex作为函数调用: db('table_name')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_db as any)(...args);
  }
};

// 使用函数作为代理目标，这样才能支持 apply trap
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = new Proxy(function () { } as any as Knex, dbHandler);

export type Database = typeof db;

