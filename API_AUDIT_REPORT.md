# API导入使用审计报告

## 调查日期
2025-12-02

## 项目中的API文件结构

### 1. `@/lib/api.ts` ✅ **推荐使用**
**导出内容:**
```typescript
class APIClient {
  public client: AxiosInstance;  // axios实例，带认证拦截器
  auth = {...}     // 认证相关方法
  admin = {...}    // 管理后台方法
  pipeline = {...} // Pipeline相关方法
  // ... 更多业务方法
}
export const api = new APIClient();
export default api;
```

**特性:**
- ✅ 完整的认证拦截器（自动添加 Authorization: Bearer token）
- ✅ Token刷新逻辑（401时自动刷新）
- ✅ 统一错误处理
- ✅ 业务方法封装（api.admin.getUsers() 等）
- ✅ Response拦截器（自动提取 response.data）

**正确用法:**
```typescript
import api from '@/lib/api';           // 默认导入 ✅
// 或
import { api } from '@/lib/api';       // 命名导入 ✅

// 方式1: 使用业务方法（推荐）
const users = await api.admin.getUsers(params);

// 方式2: 直接使用axios实例
const response = await api.client.get('/admin/users', { params });
```

---

### 2. `@/lib/api/client.ts` ⚠️ **不推荐使用**
**导出内容:**
```typescript
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE || '/api',
  withCredentials: true,
  timeout: 30000,
});
// + 添加了重试拦截器
```

**问题:**
- ❌ **缺少认证拦截器**（不会自动添加 Authorization header）
- ❌ **缺少Token刷新逻辑**（401时不会自动刷新token）
- ❌ **没有业务方法封装**
- ⚠️ 与 @/lib/api.ts 导出的api重名，容易混淆

**不推荐用法:**
```typescript
import { api } from '@/lib/api/client';  // ❌ 不推荐

// 这样调用会缺少认证token！
const response = await api.get('/admin/users');
```

---

### 3. `@/shared/api/client.ts` ⚠️ **特定场景使用**
**导出内容:**
```typescript
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  withCredentials: true,
});
// + 租户ID拦截器（x-tenant-id）
```

**特性:**
- ✅ 自动添加租户ID到请求头（多租户系统专用）
- ❌ **缺少认证拦截器**
- ❌ **缺少Token刷新逻辑**

**适用场景:**
- 多租户系统的特定API调用

**用法:**
```typescript
import { apiClient } from '@/shared/api/client';  // 仅用于多租户场景

const response = await apiClient.get('/api/tenants');
```

---

### 4. `@/shared/api/index.ts` ⚠️ **辅助函数**
**导出内容:**
```typescript
export async function get<T>(url: string, params?: any, config?: any) { ... }
export async function post<T>(url: string, data?: any, config?: any) { ... }
export async function put<T>(url: string, data?: any, config?: any) { ... }
export async function del<T>(url: string, config?: any) { ... }
export async function patch<T>(url: string, data?: any, config?: any) { ... }
```

**问题:**
- ⚠️ 基于 @/shared/api/client.ts 的apiClient
- ❌ 同样缺少认证拦截器

---

## 问题文件清单

### 类别A: 使用 `@/lib/api/client` 的文件（❌ 错误）

| 文件 | 问题 | 影响 |
|------|------|------|
| `prompts/page.tsx` | `import { api } from '@/lib/api/client'`<br/>调用 `api.get()`, `api.post()` | ❌ 缺少认证token，可能返回401 |
| `kb/stats/page.tsx` | `import { api } from '@/lib/api/client'`<br/>调用 `api.get()`, `api.post()` | ❌ 缺少认证token |
| `kb/upload/page.tsx` | `import { api } from '@/lib/api/client'`<br/>调用 `api.get()`, `api.post()` | ❌ 缺少认证token |
| `rollback/page.tsx` | `import { api } from '@/lib/api/client'`<br/>调用 `api.get()` | ❌ 缺少认证token |

**修复方案:**
```diff
- import { api } from '@/lib/api/client';
+ import api from '@/lib/api';

// 调用方式修改:
- const response = await api.get('/admin/prompts');
+ const response = await api.client.get('/admin/prompts');
```

---

### 类别B: 使用 `@/shared/api/client` 的文件

| 文件 | 问题 | 是否需要修复 |
|------|------|------------|
| `pipelines/[id]/test/page.tsx` | `import { apiClient } from '@/shared/api/client'` | ⚠️ 需要检查是否需要多租户功能 |

**修复建议:**
- 如果不需要多租户功能，改用 `@/lib/api`
- 如果需要多租户功能，保持不变但需要单独处理认证

---

## 已修复文件清单 ✅

| 文件 | 修复内容 |
|------|---------|
| `dashboard/page.tsx` | ✅ 已改为使用 `api.admin.getOverview()` |
| `configs/page.tsx` | ✅ 已改为使用 `api.admin.xxx()` 方法 |
| `kb/page.tsx` | ✅ 已改为使用 `api.client.xxx()` |
| `providers/page.tsx` | ✅ 已使用 `adminProviders` 服务层 |

---

## 正确使用的文件清单 ✅

这些文件使用了正确的导入方式:

```
✅ dashboard/page.tsx           - import api from '@/lib/api'
✅ configs/page.tsx             - import api from '@/lib/api'
✅ kb/page.tsx                  - import api from '@/lib/api'
✅ pipelines/editor/page.tsx    - import api from '@/lib/api'
✅ pipelines/executions/page.tsx - import api from '@/lib/api'
✅ providers/page.tsx           - import api from '@/lib/api'
✅ prompts/test/page.tsx        - import api from '@/lib/api'
```

**注意:** 以下文件虽然使用了 `import { api } from '@/lib/api'`（命名导入），但这也是正确的，因为 `@/lib/api.ts` 同时导出了默认导出和命名导出：

```
✅ distribution/settings/page.tsx
✅ distribution/stats/page.tsx
✅ distributors/[id]/page.tsx
✅ distributors/page.tsx
✅ features/[featureId]/edit/page.tsx
✅ features/new/page.tsx
✅ features/page.tsx
✅ forms/builder/page.tsx
✅ system/audit/page.tsx
✅ system/config/page.tsx
✅ users/page.tsx
✅ withdrawals/page.tsx
```

---

## 修复优先级

### P0 - 立即修复（影响功能）
1. ❌ `prompts/page.tsx` - 提示词管理页面无法加载
2. ❌ `kb/stats/page.tsx` - 知识库统计页面无法加载
3. ❌ `kb/upload/page.tsx` - 知识库上传页面无法加载
4. ❌ `rollback/page.tsx` - 回滚页面无法加载

### P1 - 需要检查
5. ⚠️ `pipelines/[id]/test/page.tsx` - 检查是否需要多租户功能

---

## 修复总结

### 待修复文件数: 4个
### 已修复文件数: 4个
### 正确使用文件数: 21个

**修复进度: 0/4**

---

## 推荐的最佳实践

### ✅ 推荐做法

```typescript
// 1. 使用默认导入（推荐）
import api from '@/lib/api';

// 2. 使用业务方法（最推荐）
const users = await api.admin.getUsers(params);
const features = await api.admin.getFeatures();

// 3. 使用底层axios实例（需要自定义时）
const response = await api.client.get('/custom/endpoint');

// 4. 使用专用服务层（推荐）
import { adminProviders } from '@/lib/services/adminProviders';
const providers = await adminProviders.list(params);
```

### ❌ 不推荐做法

```typescript
// ❌ 错误1: 使用 @/lib/api/client（缺少认证）
import { api } from '@/lib/api/client';
const response = await api.get('/admin/users');

// ❌ 错误2: 使用 @/shared/api/client（缺少认证，仅用于多租户）
import { apiClient } from '@/shared/api/client';
const response = await apiClient.get('/admin/users');

// ❌ 错误3: 使用 @/shared/api 的辅助函数（缺少认证）
import { get } from '@/shared/api';
const response = await get('/admin/users');
```

---

## 下一步行动

1. ✅ 立即修复4个使用 `@/lib/api/client` 的文件
2. ⚠️ 检查 `pipelines/[id]/test/page.tsx` 的多租户需求
3. 📝 更新开发文档，明确API导入规范
4. 🔒 考虑将 `@/lib/api/client.ts` 重命名或标记为内部使用，避免混淆

---

**生成时间:** 2025-12-02
**审计人员:** AI Assistant
