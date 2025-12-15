# API 使用规范指南

> **生成时间**: 2025-12-02
> **维护团队**: 前端开发组
> **强制执行**: ✅ 所有新代码必须遵守此规范

---

## 📋 目录

1. [快速开始](#快速开始)
2. [项目中的API文件](#项目中的api文件)
3. [正确使用方法](#正确使用方法)
4. [常见错误案例](#常见错误案例)
5. [最佳实践](#最佳实践)
6. [故障排查](#故障排查)

---

## 快速开始

### ✅ 推荐做法（99%的情况）

```typescript
// 1. 导入统一API客户端
import api from '@/lib/api';

// 2. 使用业务方法（最推荐）
const users = await api.admin.getUsers(params);
const features = await api.admin.getFeatures();

// 3. 或使用底层axios实例
const response = await api.client.get('/admin/users', { params });
const data = response.data;
```

### ❌ 常见错误（会导致401）

```typescript
// ❌ 错误1: 使用 @/lib/api/client
import { api } from '@/lib/api/client';
const response = await api.get('/admin/users'); // 缺少认证token！

// ❌ 错误2: 使用 @/shared/api/client
import { apiClient } from '@/shared/api/client';
const response = await apiClient.get('/admin/users'); // 缺少认证token！
```

---

## 项目中的API文件

项目中存在3个不同的API文件，各有不同用途：

### 1️⃣ `@/lib/api.ts` ✅ **推荐使用**

**导出内容:**
```typescript
class APIClient {
  public client: AxiosInstance;  // 带认证拦截器的axios实例
  auth = {...}                   // 认证相关方法
  admin = {...}                  // 管理后台方法
  pipeline = {...}               // Pipeline相关方法
}
export const api = new APIClient();
export default api;
```

**特性:**
- ✅ 完整的认证拦截器（自动添加 `Authorization: Bearer <token>`）
- ✅ Token刷新逻辑（401时自动刷新并重试）
- ✅ 统一错误处理
- ✅ 业务方法封装（`api.admin.getUsers()` 等）
- ✅ Response拦截器（自动提取 `response.data`）

**适用场景:**
- ✅ 99%的API调用场景
- ✅ 所有管理后台页面
- ✅ 所有需要认证的API

---

### 2️⃣ `@/lib/api/client.ts` ⚠️ **仅供内部使用**

**导出内容:**
```typescript
export const api = axios.create({...});
// + 添加了重试拦截器
```

**问题:**
- ❌ **缺少认证拦截器**（不会自动添加 Authorization header）
- ❌ **缺少Token刷新逻辑**（401时不会自动刷新token）
- ❌ **没有业务方法封装**
- ⚠️ 与 `@/lib/api.ts` 导出的api重名，容易混淆

**正确用途:**
- ⚠️ 仅供 `@/lib/api.ts` 内部使用，作为底层基础
- ❌ **不要直接导入使用！**

---

### 3️⃣ `@/shared/api/client.ts` ⚠️ **特定场景使用**

**导出内容:**
```typescript
export const apiClient: AxiosInstance = axios.create({...});
// + 租户ID拦截器（x-tenant-id）
```

**特性:**
- ✅ 自动添加租户ID到请求头（`x-tenant-id`）
- ❌ **缺少认证拦截器**
- ❌ **缺少Token刷新逻辑**

**适用场景:**
- ✅ 多租户系统的特定API调用（需要 `x-tenant-id` header）
- ❌ 管理后台页面（需要认证token）

**注意:** 当前项目是"伪多租户"架构（每个用户一个workspace），大部分情况下不需要使用此文件。

---

## 正确使用方法

### 方式1: 使用业务方法（最推荐）⭐

```typescript
import api from '@/lib/api';

// 管理后台方法
const users = await api.admin.getUsers({ page: 1, pageSize: 10 });
const providers = await api.admin.getProviders();
const features = await api.admin.getFeatures();

// 认证方法
const loginResult = await api.auth.login(email, password);
await api.auth.logout();

// Pipeline方法
const pipelines = await api.pipeline.list(params);
const execution = await api.pipeline.execute(pipelineId, input);
```

**优势:**
- ✅ 类型安全（TypeScript类型提示完整）
- ✅ 自动处理认证和错误
- ✅ 代码简洁易读
- ✅ 统一的调用风格

---

### 方式2: 使用底层axios实例（需要自定义时）

```typescript
import api from '@/lib/api';

// GET请求
const response = await api.client.get('/admin/custom-endpoint', {
  params: { filter: 'active' }
});
const data = response.data;

// POST请求
const response = await api.client.post('/admin/create-user', {
  email: 'user@example.com',
  name: 'Test User'
});

// PUT请求
const response = await api.client.put(`/admin/users/${userId}`, {
  name: 'Updated Name'
});

// DELETE请求
const response = await api.client.delete(`/admin/users/${userId}`);
```

**何时使用:**
- ⚠️ 没有对应的业务方法时
- ⚠️ 需要自定义请求配置（headers、timeout等）
- ⚠️ 调用第三方API或新增的自定义端点

---

### 方式3: 使用专用服务层（推荐）

```typescript
// 导入专用服务
import { adminProviders } from '@/lib/services/adminProviders';
import { adminPrompts } from '@/lib/services/adminPrompts';

// 调用服务方法
const providers = await adminProviders.list(params);
const provider = await adminProviders.create(data);

const prompts = await adminPrompts.list(params);
const prompt = await adminPrompts.update(id, data);
```

**优势:**
- ✅ 业务逻辑封装在服务层
- ✅ 更好的代码组织和复用
- ✅ 便于单元测试
- ✅ 符合关注点分离原则

---

## 常见错误案例

### ❌ 错误1: 使用 `@/lib/api/client`

```typescript
// ❌ 错误代码
import { api } from '@/lib/api/client';

const fetchUsers = async () => {
  const response = await api.get('/admin/users');
  // ⚠️ 这会返回401错误，因为缺少Authorization header
};
```

**修复方法:**
```typescript
// ✅ 正确代码
import api from '@/lib/api';

const fetchUsers = async () => {
  const response = await api.client.get('/admin/users');
  // ✅ 自动携带认证token
};
```

---

### ❌ 错误2: 使用 `@/shared/api/client` 在管理后台

```typescript
// ❌ 错误代码
import { apiClient } from '@/shared/api/client';

const fetchProviders = async () => {
  const response = await apiClient.get('/admin/providers');
  // ⚠️ 缺少Authorization header，返回401
};
```

**修复方法:**
```typescript
// ✅ 正确代码
import api from '@/lib/api';

const fetchProviders = async () => {
  const response = await api.client.get('/admin/providers');
  // ✅ 自动携带认证token和错误处理
};
```

---

### ❌ 错误3: 直接调用axios方法（不存在）

```typescript
// ❌ 错误代码
import api from '@/lib/api';

const fetchData = async () => {
  const data = await api.get('/some-endpoint');
  // ⚠️ TypeError: api.get is not a function
};
```

**修复方法:**
```typescript
// ✅ 正确代码 - 方式1: 使用client属性
import api from '@/lib/api';

const fetchData = async () => {
  const response = await api.client.get('/some-endpoint');
  const data = response.data;
};

// ✅ 正确代码 - 方式2: 使用业务方法（如果存在）
const data = await api.admin.getSomeData();
```

---

## 最佳实践

### 1. 优先使用业务方法

```typescript
// ✅ 推荐
const users = await api.admin.getUsers(params);

// ⚠️ 可以但不如业务方法
const response = await api.client.get('/admin/users', { params });
```

### 2. 统一错误处理

```typescript
try {
  const users = await api.admin.getUsers(params);
  // 处理成功逻辑
} catch (error: any) {
  if (error.code === 'UNAUTHORIZED') {
    // 处理未授权
  } else if (error.code === 'PROVIDER_TIMEOUT') {
    // 处理超时
  } else {
    // 处理其他错误
  }
}
```

### 3. 使用TypeScript类型

```typescript
interface User {
  id: string;
  email: string;
  name: string;
}

// 带类型的API调用
const response = await api.client.get<{ users: User[] }>('/admin/users');
const users: User[] = response.data.users;
```

### 4. 创建专用服务层（推荐）

```typescript
// lib/services/adminUsers.ts
import api from '@/lib/api';

export const adminUsers = {
  async list(params: { page: number; pageSize: number }) {
    const response = await api.client.get('/admin/users', { params });
    return response.data;
  },

  async create(data: CreateUserDto) {
    const response = await api.client.post('/admin/users', data);
    return response.data;
  },

  async update(id: string, data: UpdateUserDto) {
    const response = await api.client.put(`/admin/users/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    await api.client.delete(`/admin/users/${id}`);
  }
};
```

---

## 故障排查

### 问题1: 收到401 Unauthorized错误

**可能原因:**
1. ❌ 使用了 `@/lib/api/client` 或 `@/shared/api/client`
2. ❌ Token已过期且未刷新
3. ❌ 未登录或登录状态丢失

**解决方法:**
1. 检查导入语句，确保使用 `import api from '@/lib/api'`
2. 检查浏览器控制台，查看是否有token刷新失败的日志
3. 清除浏览器缓存和localStorage，重新登录

### 问题2: TypeError: api.get is not a function

**原因:**
- `api` 对象是 `APIClient` 类的实例，不是axios实例
- 需要使用 `api.client.get()` 而不是 `api.get()`

**解决方法:**
```typescript
// ❌ 错误
const response = await api.get('/endpoint');

// ✅ 正确
const response = await api.client.get('/endpoint');

// ✅ 或使用业务方法
const data = await api.admin.someMethod();
```

### 问题3: 请求没有携带认证token

**检查清单:**
1. ✅ 确认导入的是 `@/lib/api`
2. ✅ 确认使用的是 `api.client.xxx()` 或业务方法
3. ✅ 检查浏览器localStorage中是否有access_token
4. ✅ 检查Network面板，请求头是否有 `Authorization: Bearer <token>`

---

## 代码审查检查清单

在提交代码前，请确保：

- [ ] 所有API调用都使用 `import api from '@/lib/api'`
- [ ] 没有直接导入 `@/lib/api/client` 或 `@/shared/api/client`
- [ ] 优先使用业务方法（`api.admin.xxx()`）而不是底层axios
- [ ] 正确处理错误情况（try-catch）
- [ ] 添加了适当的TypeScript类型
- [ ] 如果是重复逻辑，考虑创建专用服务层

---

## 参考资料

- **API审计报告**: [API_AUDIT_REPORT.md](./API_AUDIT_REPORT.md)
- **修复记录**: [API_AUDIT_SUMMARY.md](./API_AUDIT_SUMMARY.md)
- **认证清除指南**: [CLEAR_AUTH.md](./CLEAR_AUTH.md)

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|---------|
| 2025-12-02 | v1.0 | 初始版本，统一API使用规范 |

---

**如有疑问，请联系前端技术负责人或查阅上述参考资料。**
