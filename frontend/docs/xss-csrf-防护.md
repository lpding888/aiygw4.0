# SEC-E-02: XSS/CSRF 防护文档

> **艹！XSS和CSRF是Web安全的两大杀手，老王我做了全面防护！**

---

## 📋 目录

- [XSS防护 (DOMPurify)](#xss防护-dompurify)
- [CSRF防护 (Token机制)](#csrf防护-token机制)
- [Cookie安全配置](#cookie安全配置)
- [使用示例](#使用示例)
- [安全测试](#安全测试)
- [常见问题](#常见问题)

---

## XSS防护 (DOMPurify)

### 什么是XSS

**跨站脚本攻击 (Cross-Site Scripting, XSS)** 是指攻击者在网页中注入恶意脚本，当其他用户访问时，脚本会被执行。

**危害**：
- 窃取用户Cookie、Session
- 劫持用户账号
- 篡改页面内容
- 钓鱼攻击

### DOMPurify净化工具

老王我封装了 `sanitize.ts`，提供4种净化模式：

| 模式 | 说明 | 使用场景 |
|------|------|---------|
| **strict** | 只允许纯文本 | 用户名、标题等 |
| **basic** | 允许基本格式化 | 评论、简介 |
| **rich** | 允许富文本 | 文章内容、描述 |
| **template** | 允许模板标签 | 模板预览 |

### 使用示例

#### 1. 净化用户输入

```tsx
import { sanitizeHtml } from '@/lib/security/sanitize';

// ❌ 危险：直接渲染用户输入
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ 安全：先净化再渲染
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userInput, 'basic') }} />
```

#### 2. 净化富文本内容

```tsx
import { sanitizeHtml } from '@/lib/security/sanitize';

function ArticleContent({ content }: { content: string }) {
  // 使用rich模式，允许完整的富文本标签
  const safeContent = sanitizeHtml(content, 'rich');

  return (
    <div
      className="article-content"
      dangerouslySetInnerHTML={{ __html: safeContent }}
    />
  );
}
```

#### 3. 净化模板预览

```tsx
import { sanitizeHtml } from '@/lib/security/sanitize';

function TemplatePreview({ template }: { template: string }) {
  // 使用template模式，允许button、input等
  const safeTemplate = sanitizeHtml(template, 'template');

  return (
    <div
      className="template-preview"
      dangerouslySetInnerHTML={{ __html: safeTemplate }}
    />
  );
}
```

#### 4. 净化URL

```tsx
import { sanitizeUrl } from '@/lib/security/sanitize';

function SafeLink({ href, children }: { href: string; children: React.ReactNode }) {
  const safeHref = sanitizeUrl(href);

  // 如果URL不安全，不渲染链接
  if (!safeHref) {
    return <span>{children}</span>;
  }

  return (
    <a href={safeHref} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
```

#### 5. 净化对象

```tsx
import { sanitizeObject } from '@/lib/security/sanitize';

// API响应可能包含XSS攻击
const apiResponse = await fetch('/api/articles/123').then(r => r.json());

// 净化整个对象
const safeData = sanitizeObject(apiResponse, 'rich');
```

---

## CSRF防护 (Token机制)

### 什么是CSRF

**跨站请求伪造 (Cross-Site Request Forgery, CSRF)** 是指攻击者诱导用户访问恶意网站，利用用户已登录的身份，向目标网站发送恶意请求。

**危害**：
- 修改用户数据
- 发起转账、支付
- 修改密码、邮箱
- 执行敏感操作

### CSRF Token机制

老王我实现了 **Double Submit Cookie** 模式：

1. **服务端生成Token**：随机生成token和secret，计算HMAC签名
2. **存储到Cookie**：HttpOnly Cookie（防止XSS窃取）
3. **客户端提交**：在请求头中携带 `X-CSRF-Token`
4. **服务端验证**：对比Cookie中的token和请求头中的token

### 使用示例

#### 1. 服务端生成Token

```tsx
// app/layout.tsx
import { generateCsrfToken } from '@/lib/security/csrf';
import { CsrfTokenProvider } from '@/components/CsrfTokenProvider';

export default async function RootLayout({ children }) {
  // 生成CSRF token
  const csrfToken = await generateCsrfToken();

  return (
    <html>
      <body>
        {/* 注入token到meta标签 */}
        <CsrfTokenProvider token={csrfToken} />
        {children}
      </body>
    </html>
  );
}
```

#### 2. 客户端使用Token

**方式1：使用 `useCsrfToken` Hook**

```tsx
'use client';

import { useCsrfToken } from '@/hooks/useCsrfToken';

export function DeleteButton({ id }: { id: string }) {
  const csrfToken = useCsrfToken();

  const handleDelete = async () => {
    const response = await fetch(`/api/items/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken || '', // 添加CSRF token
      },
    });

    if (!response.ok) {
      throw new Error('删除失败');
    }
  };

  return <button onClick={handleDelete}>删除</button>;
}
```

**方式2：使用 `useFetchWithCsrf` Hook**

```tsx
'use client';

import { useFetchWithCsrf } from '@/hooks/useCsrfToken';

export function CreateForm() {
  const fetchWithCsrf = useFetchWithCsrf();

  const handleSubmit = async (data: any) => {
    // 自动添加CSRF token
    const response = await fetchWithCsrf('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('创建失败');
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

#### 3. 服务端验证Token

Token验证已集成到 `middleware.ts`，自动验证以下请求：

- ✅ POST、PUT、PATCH、DELETE 请求
- ✅ `/api/*` 路径

**验证失败响应**：

```json
{
  "error": "CSRF token验证失败",
  "code": "CSRF_TOKEN_INVALID"
}
```

---

## Cookie安全配置

### SameSite属性

老王我在 `middleware.ts` 中配置了 Cookie 的 `SameSite` 属性：

```typescript
response.cookies.set('auth-storage', value, {
  httpOnly: false,        // zustand需要客户端访问
  secure: true,           // 只在HTTPS下传输（生产环境）
  sameSite: 'strict',     // 防止CSRF攻击
  path: '/',
});
```

**SameSite取值**：

| 取值 | 说明 | 安全性 |
|------|------|--------|
| **Strict** | 完全禁止第三方Cookie | 🔒 最安全 |
| **Lax** | 允许GET请求携带Cookie | 🔒 较安全 |
| **None** | 允许所有第三方Cookie | ⚠️ 不安全 |

### HttpOnly属性

**CSRF Token Cookie** 设置为 `HttpOnly`，防止被JavaScript读取：

```typescript
cookieStore.set(CSRF_TOKEN_NAME, csrfToken, {
  httpOnly: true,         // 防止XSS窃取
  secure: true,
  sameSite: 'strict',
  maxAge: 3600,           // 1小时过期
});
```

### Secure属性

**生产环境**强制使用 `Secure`，只在HTTPS下传输Cookie：

```typescript
secure: process.env.NODE_ENV === 'production'
```

---

## 使用示例

### 场景1：用户评论

```tsx
'use client';

import { useState } from 'react';
import { sanitizeHtml } from '@/lib/security/sanitize';
import { useFetchWithCsrf } from '@/hooks/useCsrfToken';

export function CommentForm({ articleId }: { articleId: string }) {
  const [content, setContent] = useState('');
  const fetchWithCsrf = useFetchWithCsrf();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. 净化内容（防止XSS）
    const safeContent = sanitizeHtml(content, 'basic');

    // 2. 提交（自动添加CSRF token）
    await fetchWithCsrf('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, content: safeContent }),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="发表评论..."
      />
      <button type="submit">提交</button>
    </form>
  );
}
```

### 场景2：富文本编辑器

```tsx
'use client';

import { useState } from 'react';
import { sanitizeHtml } from '@/lib/security/sanitize';
import { useFetchWithCsrf } from '@/hooks/useCsrfToken';
import RichTextEditor from '@/components/RichTextEditor';

export function ArticleEditor() {
  const [content, setContent] = useState('');
  const fetchWithCsrf = useFetchWithCsrf();

  const handleSave = async () => {
    // 净化富文本（允许更多标签）
    const safeContent = sanitizeHtml(content, 'rich');

    // 提交
    await fetchWithCsrf('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: safeContent }),
    });
  };

  return (
    <div>
      <RichTextEditor value={content} onChange={setContent} />
      <button onClick={handleSave}>保存</button>
    </div>
  );
}
```

### 场景3：模板预览

```tsx
'use client';

import { sanitizeHtml } from '@/lib/security/sanitize';

export function TemplatePreview({ template }: { template: string }) {
  // 使用template模式，允许button、input等
  const safeTemplate = sanitizeHtml(template, 'template');

  return (
    <div className="template-preview">
      <div
        dangerouslySetInnerHTML={{ __html: safeTemplate }}
      />
    </div>
  );
}
```

---

## 安全测试

### 测试XSS防护

**测试用例1：脚本注入**

```tsx
const maliciousInput = '<script>alert("XSS")</script>';
const safe = sanitizeHtml(maliciousInput, 'basic');
// 预期: 空字符串或纯文本
console.assert(safe === '', 'XSS防护失败');
```

**测试用例2：事件处理器**

```tsx
const maliciousInput = '<img src=x onerror="alert(1)">';
const safe = sanitizeHtml(maliciousInput, 'basic');
// 预期: <img src="x"> (移除onerror)
console.assert(!safe.includes('onerror'), 'XSS防护失败');
```

**测试用例3：javascript: 协议**

```tsx
const maliciousUrl = 'javascript:alert(1)';
const safe = sanitizeUrl(maliciousUrl);
// 预期: 空字符串
console.assert(safe === '', 'URL净化失败');
```

### 测试CSRF防护

**测试用例1：无Token请求**

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'

# 预期: 403 Forbidden
# {"error":"CSRF token验证失败","code":"CSRF_TOKEN_INVALID"}
```

**测试用例2：Token不匹配**

```bash
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: invalid-token" \
  -H "Cookie: csrf-token=valid-token" \
  -d '{"name":"test"}'

# 预期: 403 Forbidden
```

**测试用例3：正确的Token**

```bash
# 1. 获取token
TOKEN=$(curl -c cookies.txt http://localhost:3000/ | grep csrf-token)

# 2. 使用token发送请求
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $TOKEN" \
  -b cookies.txt \
  -d '{"name":"test"}'

# 预期: 200 OK
```

### 自动化测试

创建 `tests/security.test.ts`：

```typescript
import { sanitizeHtml, sanitizeUrl } from '@/lib/security/sanitize';

describe('XSS防护', () => {
  test('应该移除script标签', () => {
    const input = '<script>alert("XSS")</script>Hello';
    const output = sanitizeHtml(input, 'basic');
    expect(output).not.toContain('<script>');
    expect(output).toContain('Hello');
  });

  test('应该移除事件处理器', () => {
    const input = '<img src=x onerror="alert(1)">';
    const output = sanitizeHtml(input, 'basic');
    expect(output).not.toContain('onerror');
  });

  test('应该阻止javascript:协议', () => {
    const input = 'javascript:alert(1)';
    const output = sanitizeUrl(input);
    expect(output).toBe('');
  });
});
```

---

## 常见问题

### Q1: 为什么需要同时防护XSS和CSRF？

**A**: XSS和CSRF是两种不同的攻击：

- **XSS**：注入恶意脚本，窃取信息
- **CSRF**：伪造用户请求，执行操作

两者需要分别防护，缺一不可！

### Q2: DOMPurify会影响性能吗？

**A**: DOMPurify的性能非常好，对于普通文本（<10KB）几乎无影响。如果担心性能：

- ✅ 只在必要时净化（用户输入、API响应）
- ✅ 使用合适的模式（strict比rich快）
- ✅ 考虑在服务端净化，客户端直接渲染

### Q3: CSRF Token过期了怎么办？

**A**: Token默认1小时过期。过期后：

1. 客户端请求会收到 `403 CSRF_TOKEN_INVALID`
2. 前端应该刷新页面重新获取token
3. 或者实现token自动刷新机制

### Q4: 如何在开发环境禁用CSRF？

**A**: 不建议禁用！但如果必须：

```typescript
// middleware.ts
const isDev = process.env.NODE_ENV === 'development';

if (!isDev && UNSAFE_METHODS.includes(method)) {
  // CSRF验证
}
```

### Q5: 第三方API调用需要CSRF Token吗？

**A**: 不需要。CSRF只用于：

- ✅ 浏览器发起的请求
- ✅ 携带Cookie的请求

第三方API通常使用 **API Key** 或 **OAuth Token** 认证。

---

## 最佳实践

### ✅ DO

1. **所有用户输入都要净化**
   ```tsx
   const safe = sanitizeHtml(userInput, 'basic');
   ```

2. **使用合适的净化模式**
   - 用户名/标题 → strict
   - 评论/简介 → basic
   - 文章内容 → rich

3. **所有非安全HTTP方法添加CSRF Token**
   ```tsx
   headers: { 'X-CSRF-Token': csrfToken }
   ```

4. **Cookie设置SameSite=Strict**
   ```typescript
   sameSite: 'strict'
   ```

### ❌ DON'T

1. **不要相信用户输入**
   ```tsx
   // ❌ 危险
   <div dangerouslySetInnerHTML={{ __html: userInput }} />
   ```

2. **不要在客户端存储敏感信息**
   ```tsx
   // ❌ 危险
   localStorage.setItem('password', password);
   ```

3. **不要禁用CSRF验证**
   ```typescript
   // ❌ 危险
   // 不要为了方便而禁用CSRF
   ```

4. **不要使用SameSite=None**
   ```typescript
   // ❌ 危险
   sameSite: 'none' // 容易被CSRF攻击
   ```

---

## 总结

✅ **XSS防护完成**：DOMPurify净化 + 4种模式
✅ **CSRF防护完成**：Token机制 + SameSite Cookie
✅ **Cookie安全配置**：HttpOnly + Secure + SameSite
✅ **使用简单**：Hooks + 组件 + 工具函数
✅ **文档完善**：示例 + 测试 + 最佳实践

老王我搞的这套XSS/CSRF防护体系，保证生产环境万无一失！

有问题随时反馈，艹！
