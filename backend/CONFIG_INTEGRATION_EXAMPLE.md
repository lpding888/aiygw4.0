# ConfigManager 集成示例

## 📝 如何在项目中集成ConfigManager

### Step 1: 在应用启动时初始化

修改 `src/server.ts` 或 `src/app.ts`:

```typescript
/**
 * 服务器启动入口
 */
import configManager from './config/config.manager.js';
import logger from './utils/logger.js';
import { createApp } from './app.js';

async function bootstrap() {
  try {
    console.log('🚀 正在启动服务...');

    // ✅ Step 1: 初始化配置管理器（必须第一步）
    console.log('[1/4] 初始化配置管理器...');
    await configManager.initialize();

    // ✅ Step 2: 初始化数据库连接
    console.log('[2/4] 连接数据库...');
    await initializeDatabase();

    // ✅ Step 3: 创建Express应用
    console.log('[3/4] 创建应用实例...');
    const app = await createApp();

    // ✅ Step 4: 启动HTTP服务器
    console.log('[4/4] 启动HTTP服务器...');
    const port = await configManager.getNumber('PORT', 3000);
    const env = await configManager.getString('NODE_ENV', 'development');

    app.listen(port, () => {
      logger.info(`✅ 服务器运行中`, {
        port,
        env,
        pid: process.pid,
        url: `http://localhost:${port}`
      });
    });
  } catch (error) {
    console.error('❌ 服务启动失败:', error);
    logger.error('[Bootstrap] 服务启动失败', error);
    process.exit(1);
  }
}

// 启动服务
bootstrap();

// 优雅退出
process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，正在优雅退出...');
  // 清理资源...
  process.exit(0);
});
```

### Step 2: 数据库初始化使用ConfigManager

修改 `src/config/database.ts`:

```typescript
import knex from 'knex';
import configManager from './config.manager.js';
import logger from '../utils/logger.js';

let _db: knex.Knex | null = null;

/**
 * 初始化数据库连接
 */
export async function initializeDatabase(): Promise<knex.Knex> {
  if (_db) {
    return _db;
  }

  try {
    // 从ConfigManager获取数据库配置
    const config = {
      host: await configManager.getRequired('DB_HOST'),
      port: await configManager.getNumber('DB_PORT', 3306),
      user: await configManager.getRequired('DB_USER'),
      password: await configManager.getRequired('DB_PASSWORD'),
      database: await configManager.getRequired('DB_NAME')
    };

    const pool = {
      min: await configManager.getNumber('DATABASE_POOL_MIN', 5),
      max: await configManager.getNumber('DATABASE_POOL_MAX', 40),
      acquireTimeoutMillis: await configManager.getNumber('DATABASE_POOL_ACQUIRE_TIMEOUT', 10000),
      idleTimeoutMillis: await configManager.getNumber('DATABASE_POOL_IDLE', 30000)
    };

    _db = knex({
      client: 'mysql2',
      connection: config,
      pool,
      acquireConnectionTimeout: pool.acquireTimeoutMillis,
      log: {
        warn(message) {
          logger.warn('[Database] ' + message);
        },
        error(message) {
          logger.error('[Database] ' + message);
        },
        deprecate(message) {
          logger.warn('[Database] Deprecated: ' + message);
        },
        debug(message) {
          logger.debug('[Database] ' + message);
        }
      }
    });

    // 测试连接
    await _db.raw('SELECT 1');
    logger.info('[Database] ✅ 数据库连接成功', {
      host: config.host,
      database: config.database
    });

    return _db;
  } catch (error) {
    logger.error('[Database] ❌ 数据库连接失败', error);
    throw error;
  }
}

/**
 * 获取数据库实例
 */
export function getDatabase(): knex.Knex {
  if (!_db) {
    throw new Error('数据库未初始化，请先调用 initializeDatabase()');
  }
  return _db;
}

/**
 * 导出db实例（向后兼容）
 */
export const db = new Proxy({} as knex.Knex, {
  get(target, prop) {
    return getDatabase()[prop as keyof knex.Knex];
  }
});
```

### Step 3: Redis初始化使用ConfigManager

修改 `src/config/redis.ts`:

```typescript
import Redis from 'ioredis';
import configManager from './config.manager.js';
import logger from '../utils/logger.js';

let _redis: Redis | null = null;
let _bullmqRedis: Redis | null = null;

/**
 * 初始化Redis客户端
 */
export async function initializeRedis(): Promise<Redis> {
  if (_redis) {
    return _redis;
  }

  try {
    const config = {
      host: await configManager.getString('REDIS_HOST', 'localhost'),
      port: await configManager.getNumber('REDIS_PORT', 6379),
      password: await configManager.get('REDIS_PASSWORD'),
      db: await configManager.getNumber('REDIS_DB', 0)
    };

    _redis = new Redis({
      ...config,
      retryStrategy(times) {
        if (times > 3) {
          logger.error('[Redis] 连接失败，停止重试');
          return null;
        }
        const delay = Math.min(times * 200, 2000);
        logger.warn(`[Redis] 重试连接 (${times}/3)，延迟 ${delay}ms`);
        return delay;
      }
    });

    _redis.on('connect', () => {
      logger.info('[Redis] ✅ 连接成功');
    });

    _redis.on('error', (error) => {
      logger.error('[Redis] ❌ 连接错误:', error);
    });

    return _redis;
  } catch (error) {
    logger.error('[Redis] ❌ 初始化失败', error);
    throw error;
  }
}

/**
 * 获取BullMQ专用Redis客户端
 */
export async function getBullMQRedis(): Promise<Redis> {
  if (_bullmqRedis) {
    return _bullmqRedis;
  }

  const config = {
    host: await configManager.getString('REDIS_HOST', 'localhost'),
    port: await configManager.getNumber('REDIS_PORT', 6379),
    password: await configManager.get('REDIS_PASSWORD'),
    db: await configManager.getNumber('REDIS_BULLMQ_DB', 2)
  };

  _bullmqRedis = new Redis(config);
  return _bullmqRedis;
}

export const redis = new Proxy({} as Redis, {
  get(target, prop) {
    if (!_redis) {
      throw new Error('Redis未初始化');
    }
    return _redis[prop as keyof Redis];
  }
});
```

### Step 4: 服务类使用ConfigManager

示例：`src/services/jwt.service.ts`

```typescript
import jwt from 'jsonwebtoken';
import configManager from '../config/config.manager.js';
import logger from '../utils/logger.js';

class JWTService {
  /**
   * 生成访问令牌
   */
  async generateAccessToken(payload: object): Promise<string> {
    const secret = await configManager.getRequired('JWT_SECRET');
    const expiresIn = await configManager.getString('JWT_ACCESS_EXPIRES_IN', '15m');

    return jwt.sign(payload, secret, { expiresIn });
  }

  /**
   * 生成刷新令牌
   */
  async generateRefreshToken(payload: object): Promise<string> {
    const secret = await configManager.getRequired('JWT_SECRET');
    const expiresIn = await configManager.getString('JWT_REFRESH_EXPIRES_IN', '7d');

    return jwt.sign(payload, secret, { expiresIn });
  }

  /**
   * 验证令牌
   */
  async verifyToken(token: string): Promise<object | null> {
    try {
      const secret = await configManager.getRequired('JWT_SECRET');
      return jwt.verify(token, secret) as object;
    } catch (error) {
      logger.warn('[JWT] 令牌验证失败', { error });
      return null;
    }
  }
}

export default new JWTService();
```

### Step 5: 中间件使用ConfigManager

示例：`src/middlewares/cors.middleware.ts`

```typescript
import cors from 'cors';
import type { Request } from 'express';
import configManager from '../config/config.manager.js';

/**
 * 创建CORS中间件
 */
export async function createCorsMiddleware() {
  const frontendUrl = await configManager.getString('FRONTEND_URL', 'http://localhost:3001');
  const customOrigins = await configManager.get('CORS_ORIGINS');

  // 解析允许的来源
  const allowedOrigins = customOrigins
    ? customOrigins.split(',').map((o: string) => o.trim())
    : [frontendUrl];

  return cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // 允许无来源（如Postman）
      if (!origin) return callback(null, true);

      // 检查是否在白名单中
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`来源 ${origin} 不在CORS白名单中`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
}
```

### Step 6: 完整的app.ts集成示例

```typescript
import express from 'express';
import configManager from './config/config.manager.js';
import { initializeDatabase } from './config/database.js';
import { initializeRedis } from './config/redis.js';
import { createCorsMiddleware } from './middlewares/cors.middleware.js';
import logger from './utils/logger.js';

/**
 * 创建Express应用
 */
export async function createApp() {
  const app = express();

  // 1. 基础中间件
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 2. CORS
  const corsMiddleware = await createCorsMiddleware();
  app.use(corsMiddleware);

  // 3. 日志
  const logLevel = await configManager.getString('LOG_LEVEL', 'info');
  logger.level = logLevel;

  // 4. 健康检查
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // 5. 加载路由
  const apiPrefix = await configManager.getString('API_PREFIX', '/api');
  app.use(`${apiPrefix}/auth`, (await import('./routes/auth.routes.js')).default);
  app.use(`${apiPrefix}/users`, (await import('./routes/users.routes.js')).default);

  // 6. 错误处理
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('[App] 未捕获错误:', err);
    res.status(500).json({
      success: false,
      error: {
        message: '服务器内部错误',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  });

  return app;
}
```

---

## 🧪 测试集成

### 单元测试示例

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import configManager from '../config/config.manager.js';

describe('ConfigManager Integration', () => {
  beforeAll(async () => {
    // 设置测试环境变量
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = 'localhost';
    process.env.DB_USER = 'test_user';
    process.env.DB_PASSWORD = 'test_pass';
    process.env.DB_NAME = 'test_db';
    process.env.JWT_SECRET = 'test_jwt_secret_32_chars_long___';
    process.env.ENCRYPTION_KEY_V1 = 'test_encryption_key_32_chars__';
    process.env.COS_BUCKET = 'test-bucket';
    process.env.COS_REGION = 'ap-guangzhou';
    process.env.REDIS_HOST = 'localhost';

    await configManager.initialize();
  });

  it('should initialize successfully', () => {
    expect(configManager).toBeDefined();
  });

  it('should get database config', async () => {
    const host = await configManager.getString('DB_HOST');
    expect(host).toBe('localhost');
  });

  it('should get number config', async () => {
    const port = await configManager.getNumber('PORT', 3000);
    expect(typeof port).toBe('number');
  });
});
```

---

## 📊 完成检查清单

- [ ] `config.manager.ts` 已创建
- [ ] `config.schema.ts` 已创建
- [ ] `server.ts` 已更新（初始化ConfigManager）
- [ ] `database.ts` 已更新
- [ ] `redis.ts` 已更新
- [ ] 核心服务已迁移
- [ ] 中间件已迁移
- [ ] 单元测试已编写
- [ ] 文档已更新

---

**最后更新**: 2025-12-08
