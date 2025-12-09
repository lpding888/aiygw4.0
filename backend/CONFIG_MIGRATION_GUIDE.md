# 配置管理迁移指南

## 📋 概述

本项目已实施统一配置管理系统，使用`ConfigManager`替代直接访问`process.env.*`，提供以下优势：

✅ **类型安全** - 使用Zod进行配置验证
✅ **分层加载** - 支持默认值、环境变量、数据库动态配置
✅ **运行时验证** - 启动时验证所有必需配置
✅ **敏感信息保护** - 自动脱敏日志输出
✅ **配置热更新** - 支持动态配置无需重启

---

## 🚀 快速开始

### 1. 在应用启动时初始化

在`src/server.ts`或`src/app.ts`中，**必须在使用任何配置前初始化**：

```typescript
import configManager from './config/config.manager.js';

// 应用启动时初始化（必须在最前面）
async function bootstrap() {
  try {
    // 1. 初始化配置管理器
    await configManager.initialize();

    // 2. 之后才能启动其他服务
    const app = await createApp();
    const port = await configManager.getNumber('PORT', 3000);

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

bootstrap();
```

### 2. 在服务中使用配置

#### ❌ 旧方式（直接使用process.env）

```typescript
// 不推荐：类型不安全，无验证，无默认值
const dbHost = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.PORT || '3000');
const jwtSecret = process.env.JWT_SECRET; // 可能为undefined
```

#### ✅ 新方式（使用ConfigManager）

```typescript
import configManager from '../config/config.manager.js';

// 推荐：类型安全，有验证，有默认值
const dbHost = await configManager.getString('DB_HOST', 'localhost');
const port = await configManager.getNumber('PORT', 3000);
const jwtSecret = await configManager.getRequired('JWT_SECRET'); // 不存在时抛异常
```

---

## 📖 API使用指南

### 基础方法

#### `get<T>(key, defaultValue?, useDynamic?)`
获取配置值，返回可能为undefined

```typescript
const apiKey = await configManager.get('DEEPSEEK_API_KEY');
const redisHost = await configManager.get('REDIS_HOST', 'localhost');

// 禁用动态配置（仅从环境变量读取）
const staticValue = await configManager.get('JWT_SECRET', undefined, false);
```

#### `getRequired<T>(key, useDynamic?)`
获取必需配置，不存在时抛异常

```typescript
// 生产环境必需的配置
const dbPassword = await configManager.getRequired('DB_PASSWORD');
const jwtSecret = await configManager.getRequired('JWT_SECRET');
```

### 类型化方法

#### `getString(key, defaultValue, useDynamic?)`
获取字符串配置

```typescript
const env = await configManager.getString('NODE_ENV', 'development');
const bucket = await configManager.getString('COS_BUCKET');
```

#### `getNumber(key, defaultValue, useDynamic?)`
获取数字配置

```typescript
const port = await configManager.getNumber('PORT', 3000);
const poolMax = await configManager.getNumber('DATABASE_POOL_MAX', 20);
```

#### `getBoolean(key, defaultValue, useDynamic?)`
获取布尔配置

```typescript
const enableBoard = await configManager.getBoolean('ENABLE_BULL_BOARD', false);
const smtpSecure = await configManager.getBoolean('SMTP_SECURE', true);
```

#### `getJSON<T>(key, defaultValue, useDynamic?)`
获取JSON对象配置

```typescript
const metadata = await configManager.getJSON('FEATURE_FLAGS', {});
```

### 其他方法

#### `has(key)`
检查配置是否存在

```typescript
if (configManager.has('SENTRY_DSN')) {
  // 初始化Sentry
}
```

#### `getAll()`
获取所有配置（敏感信息已脱敏）

```typescript
const allConfig = configManager.getAll();
console.log(allConfig); // 密码和密钥会显示为 ***
```

#### `getRaw()`
获取原始配置（包含敏感信息，仅供内部使用）

```typescript
const rawConfig = configManager.getRaw();
// ⚠️ 注意：不要打印或记录到日志，包含明文密钥
```

#### `reload()`
重新加载配置

```typescript
await configManager.reload();
```

---

## 🔄 迁移步骤

### Step 1: 识别需要迁移的代码

使用以下命令搜索所有使用`process.env`的地方：

```bash
# 搜索所有 process.env 使用
grep -rn "process\.env\." src/
```

### Step 2: 逐文件迁移

#### 示例1: 数据库配置迁移

**Before:**
```typescript
// src/config/database.ts
import knex from 'knex';

export const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  }
});
```

**After:**
```typescript
// src/config/database.ts
import knex from 'knex';
import configManager from './config.manager.js';

let _db: knex.Knex | null = null;

export async function initializeDatabase() {
  if (_db) return _db;

  _db = knex({
    client: 'mysql2',
    connection: {
      host: await configManager.getString('DB_HOST', 'localhost'),
      port: await configManager.getNumber('DB_PORT', 3306),
      user: await configManager.getRequired('DB_USER'),
      password: await configManager.getRequired('DB_PASSWORD'),
      database: await configManager.getRequired('DB_NAME')
    },
    pool: {
      min: await configManager.getNumber('DATABASE_POOL_MIN', 5),
      max: await configManager.getNumber('DATABASE_POOL_MAX', 20)
    }
  });

  return _db;
}

export const db = _db!; // 启动后保证已初始化
```

#### 示例2: 服务类迁移

**Before:**
```typescript
// src/services/cos.service.ts
import COS from 'cos-nodejs-sdk-v5';

class COSService {
  private client: COS;

  constructor() {
    this.client = new COS({
      SecretId: process.env.COS_SECRET_ID,
      SecretKey: process.env.COS_SECRET_KEY
    });
  }

  async upload(file: Buffer, key: string) {
    const bucket = process.env.COS_BUCKET || 'default-bucket';
    const region = process.env.COS_REGION || 'ap-guangzhou';

    return this.client.putObject({
      Bucket: bucket,
      Region: region,
      Key: key,
      Body: file
    });
  }
}
```

**After:**
```typescript
// src/services/cos.service.ts
import COS from 'cos-nodejs-sdk-v5';
import configManager from '../config/config.manager.js';

class COSService {
  private client: COS | null = null;

  async initialize() {
    if (this.client) return;

    const secretId = await configManager.get('COS_SECRET_ID');
    const secretKey = await configManager.get('COS_SECRET_KEY');

    if (!secretId || !secretKey) {
      throw new Error('COS密钥未配置');
    }

    this.client = new COS({
      SecretId: secretId,
      SecretKey: secretKey
    });
  }

  async upload(file: Buffer, key: string) {
    await this.initialize(); // 确保已初始化

    const bucket = await configManager.getRequired('COS_BUCKET');
    const region = await configManager.getRequired('COS_REGION');

    return this.client!.putObject({
      Bucket: bucket,
      Region: region,
      Key: key,
      Body: file
    });
  }
}

export default new COSService();
```

#### 示例3: 中间件迁移

**Before:**
```typescript
// src/middlewares/auth.middleware.ts
import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  const secret = process.env.JWT_SECRET;

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
```

**After:**
```typescript
// src/middlewares/auth.middleware.ts
import jwt from 'jsonwebtoken';
import configManager from '../config/config.manager.js';

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  const secret = await configManager.getRequired('JWT_SECRET');

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
```

---

## 🔧 特殊场景处理

### 场景1: 非异步上下文中使用配置

某些情况下无法使用`await`（如类属性初始化），可以使用以下策略：

#### 方案A: 延迟初始化

```typescript
class MyService {
  private apiKey: string | null = null;

  private async ensureInitialized() {
    if (!this.apiKey) {
      this.apiKey = await configManager.getRequired('MY_API_KEY');
    }
  }

  async doSomething() {
    await this.ensureInitialized();
    // 使用 this.apiKey
  }
}
```

#### 方案B: 工厂函数

```typescript
async function createMyService() {
  const apiKey = await configManager.getRequired('MY_API_KEY');

  return new MyService(apiKey);
}

// 使用
const myService = await createMyService();
```

### 场景2: 配置依赖其他配置

```typescript
// 使用动态配置优先级
const useSSL = await configManager.getBoolean('REDIS_USE_SSL', false);
const redisUrl = useSSL
  ? `rediss://${await configManager.getString('REDIS_HOST')}:${await configManager.getNumber('REDIS_PORT')}`
  : `redis://${await configManager.getString('REDIS_HOST')}:${await configManager.getNumber('REDIS_PORT')}`;
```

### 场景3: 配置默认值来自其他配置

```typescript
// JWT刷新令牌过期时间默认为访问令牌的7倍
const accessExpire = await configManager.getString('JWT_ACCESS_EXPIRES_IN', '15m');
const refreshExpire = await configManager.getString('JWT_REFRESH_EXPIRES_IN', '7d');
```

---

## ⚙️ 环境变量更新

### 1. 更新.env文件

确保所有必需配置在`.env`文件中：

```bash
# 复制示例文件
cp .env.example .env

# 编辑配置
vim .env
```

### 2. 生产环境必需配置

以下配置在生产环境**必须配置**：

```bash
# 数据库配置
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_strong_password
DB_NAME=your_database_name

# 安全配置
JWT_SECRET=your_jwt_secret_at_least_32_characters_long
ENCRYPTION_KEY_V1=your_encryption_key_32_chars_long

# 存储配置
COS_BUCKET=your-bucket-name
COS_REGION=ap-guangzhou

# Redis配置
REDIS_HOST=your_redis_host
```

### 3. 可选配置

以下配置有默认值，可根据需要调整：

```bash
# 服务器配置
NODE_ENV=production
PORT=3000

# 连接池配置
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50

# JWT过期时间
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# 日志级别
LOG_LEVEL=info
```

---

## 🧪 测试

### 单元测试

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals';
import configManager from '../config/config.manager.js';

describe('ConfigManager', () => {
  beforeAll(async () => {
    // 设置测试环境变量
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = 'localhost';
    process.env.JWT_SECRET = 'test_secret_key_32_chars_long';

    await configManager.initialize();
  });

  it('should get string config', async () => {
    const host = await configManager.getString('DB_HOST');
    expect(host).toBe('localhost');
  });

  it('should get number config', async () => {
    const port = await configManager.getNumber('PORT', 3000);
    expect(port).toBe(3000);
  });

  it('should throw for missing required config', async () => {
    await expect(
      configManager.getRequired('NONEXISTENT_CONFIG')
    ).rejects.toThrow();
  });
});
```

---

## 📊 迁移进度跟踪

| 模块 | 文件数 | process.env数量 | 迁移状态 | 负责人 |
|------|--------|----------------|---------|--------|
| config/ | 12 | ~50 | ⏳ 进行中 | - |
| services/ | 30+ | ~150 | 🔴 待开始 | - |
| middlewares/ | 10+ | ~30 | 🔴 待开始 | - |
| controllers/ | 20+ | ~30 | 🔴 待开始 | - |
| utils/ | 10+ | ~19 | 🔴 待开始 | - |

**总进度**: 0/279 (0%)

---

## ❓ FAQ

### Q1: ConfigManager和systemConfig.service有什么区别？

**A**:
- `ConfigManager`: 静态配置管理，从环境变量加载，启动时验证
- `systemConfig.service`: 动态配置管理，从数据库加载，运行时可修改

ConfigManager会优先使用systemConfig的动态配置，如果不存在则fallback到静态配置。

### Q2: 是否需要立即迁移所有代码？

**A**: 不需要。可以渐进式迁移：
1. 先迁移核心模块（数据库、Redis、JWT）
2. 再迁移业务服务
3. 最后迁移工具类和中间件

旧代码仍然可以使用`process.env.*`，不会立即破坏。

### Q3: 如何在不支持await的地方使用配置？

**A**: 使用延迟初始化或工厂模式，参考"特殊场景处理"部分。

### Q4: 配置验证失败会怎样？

**A**: 应用启动时会抛出异常并退出，防止带着错误配置运行。

### Q5: 动态配置更新后何时生效？

**A**:
- 静态配置: 需要重启应用
- 动态配置: 下次访问时自动生效（有5分钟缓存）

---

**最后更新**: 2025-12-08
**版本**: 1.0.0
