# 后端代码规范指南

## 1. 命名规范

### 1.1 基本规则

| 类型 | 规范 | 示例 |
|-----|------|------|
| 变量 | camelCase | `userId`, `taskList` |
| 函数 | camelCase | `getUser()`, `createTask()` |
| 类 | PascalCase | `UserService`, `TaskController` |
| 接口 | PascalCase | `UserProfile`, `TaskConfig` |
| 类型别名 | PascalCase | `RequestHandler`, `ApiResponse` |
| 枚举 | PascalCase | `TaskStatus`, `ErrorType` |
| 枚举成员 | UPPER_CASE | `PENDING`, `COMPLETED` |
| 常量 | UPPER_CASE | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT` |
| 文件名 | kebab-case | `user.service.ts`, `error-handler.ts` |

### 1.2 特殊约定

```typescript
// ✅ 正确
const userId: string;
function getUserById(id: string): Promise<User>;
class UserService { }
interface UserConfig { }
enum TaskStatus { PENDING, RUNNING }
const MAX_RETRIES = 3;

// ❌ 错误
const user_id: string;         // 应使用 camelCase
function GetUserById();        // 函数应使用 camelCase
class user_service { }         // 类应使用 PascalCase
enum taskStatus { pending }    // 枚举应使用 PascalCase
```

---

## 2. TypeScript 类型规范

### 2.1 避免使用 `any`

```typescript
// ❌ 避免
function processData(data: any): any {
  return data.value;
}

// ✅ 推荐
function processData<T extends { value: unknown }>(data: T): T['value'] {
  return data.value;
}

// ✅ 如果确实需要动态类型,使用 unknown 并进行类型检查
function processUnknown(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String((data as { value: unknown }).value);
  }
  return '';
}
```

### 2.2 明确函数返回类型

```typescript
// ✅ 推荐：明确返回类型
async function getUser(id: string): Promise<User | null> {
  return await db('users').where({ id }).first();
}

// ❌ 不推荐：隐式返回类型
async function getUser(id: string) {
  return await db('users').where({ id }).first();
}
```

### 2.3 使用严格的空值检查

```typescript
// ✅ 推荐：使用可选链和空值合并
const userName = user?.profile?.name ?? 'Unknown';

// ❌ 不推荐：使用 || 进行空值检查（可能误判 0 或空字符串）
const userName = user && user.profile && user.profile.name || 'Unknown';
```

---

## 3. 异步代码规范

### 3.1 正确处理 Promise

```typescript
// ✅ 正确：使用 await 或 void
await someAsyncFunction();
void someAsyncFunction(); // 明确表示不等待

// ❌ 错误：悬空的 Promise
someAsyncFunction(); // ESLint 会报 no-floating-promises 错误
```

### 3.2 错误处理

```typescript
// ✅ 推荐：使用 try-catch 并记录日志
async function processTask(taskId: string): Promise<void> {
  try {
    await doSomething(taskId);
  } catch (error) {
    logger.error('[ProcessTask] 处理失败', { taskId, error });
    throw AppError.fromError(error, ERROR_CODES.TASK_EXECUTION_FAILED);
  }
}
```

---

## 4. 文件结构规范

### 4.1 服务文件结构

```typescript
// user.service.ts

// 1. 导入声明（按类型分组）
import { Knex } from 'knex';                    // 第三方库
import { db } from '../config/database.js';      // 内部模块
import logger from '../utils/logger.js';         // 工具
import type { User } from '../types/user.js';    // 类型（单独分组）

// 2. 接口/类型定义
interface UserCreateInput {
  phone: string;
  password: string;
}

// 3. 类定义
class UserService {
  // 3.1 私有属性
  private readonly db: Knex;

  // 3.2 构造函数
  constructor() {
    this.db = db;
  }

  // 3.3 公共方法
  async create(input: UserCreateInput): Promise<User> {
    // ...
  }

  // 3.4 私有方法
  private hashPassword(password: string): string {
    // ...
  }
}

// 4. 导出
export default new UserService();
```

### 4.2 控制器文件结构

```typescript
// user.controller.ts

// 1. 导入
import type { Request, Response, NextFunction } from 'express';
import userService from '../services/user.service.js';
import AppError from '../utils/AppError.js';

// 2. 控制器类
class UserController {
  // 每个方法对应一个路由处理
  async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.findById(req.params.id);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
}

// 3. 导出
export default new UserController();
```

---

## 5. 注释规范

### 5.1 JSDoc 注释

```typescript
/**
 * 创建用户
 * @param input - 用户创建输入
 * @param input.phone - 手机号
 * @param input.password - 密码（明文）
 * @returns 创建的用户对象
 * @throws {AppError} 当手机号已存在时抛出
 */
async create(input: UserCreateInput): Promise<User> {
  // ...
}
```

### 5.2 行内注释

```typescript
// ✅ 解释"为什么"而不是"是什么"
// 使用事务确保配额扣减和任务创建的原子性
await db.transaction(async (trx) => {
  await quotaService.deduct(userId, 1, trx);
  await taskService.create(taskData, trx);
});

// ❌ 不要解释代码本身在做什么
// 从数据库获取用户
const user = await db('users').where({ id }).first();
```

---

## 6. 错误处理规范

### 6.1 使用统一的错误码

```typescript
import { ERROR_CODES } from '../config/error-codes.js';
import AppError from '../utils/AppError.js';

// ✅ 推荐：使用预定义的错误码
throw AppError.custom(ERROR_CODES.USER_NOT_FOUND, '用户不存在');

// ❌ 不推荐：使用魔法数字
throw new Error('用户不存在'); // 没有错误码
```

### 6.2 错误日志格式

```typescript
// ✅ 推荐：结构化日志
logger.error('[ServiceName] 操作失败', {
  userId,
  action: 'createTask',
  error: error.message,
  stack: error.stack
});

// ❌ 不推荐：非结构化日志
console.log('Error: ' + error.message);
```

---

## 7. 测试规范

### 7.1 测试文件命名

```
src/services/user.service.ts
tests/unit/services/user.service.test.ts
tests/integration/api/users.test.ts
```

### 7.2 测试用例结构

```typescript
describe('UserService', () => {
  describe('create', () => {
    it('should create user with valid input', async () => {
      // Arrange
      const input = { phone: '13800138000', password: 'password123' };
      
      // Act
      const user = await userService.create(input);
      
      // Assert
      expect(user.phone).toBe(input.phone);
      expect(user.id).toBeDefined();
    });

    it('should throw error when phone already exists', async () => {
      // ...
    });
  });
});
```

---

## 8. ESLint 规则说明

项目使用以下 ESLint 规则（见 `eslint.config.mjs`）：

| 规则 | 级别 | 说明 |
|-----|------|------|
| `no-explicit-any` | warn | 避免使用 any 类型 |
| `no-unsafe-*` | warn | 避免不安全的类型操作 |
| `naming-convention` | warn | 强制命名规范 |
| `no-floating-promises` | error | 必须处理 Promise |
| `await-thenable` | error | await 只能用于 Promise |
| `prefer-nullish-coalescing` | warn | 推荐使用 ?? 而非 \|\| |
| `prefer-optional-chain` | warn | 推荐使用 ?. 而非 && |

运行检查：
```bash
npm run lint        # 检查
npm run lint:fix    # 自动修复
```
