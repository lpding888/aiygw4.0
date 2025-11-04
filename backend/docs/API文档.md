# API文档

**更新时间：** 2025-11-03
**负责人：** 老王
**版本：** 1.0.0

艹，这个文档详细记录了所有API接口，按照OpenAPI 3.0规范编写！

---

## 📋 目录

- [基础信息](#基础信息)
- [认证方式](#认证方式)
- [统一推理API](#统一推理api)
- [COS直传API](#cos直传api)
- [知识库管理API](#知识库管理api)
- [错误码](#错误码)

---

## 基础信息

**Base URL：**
- 开发环境：`http://localhost:3000`
- 生产环境：`https://api.aizhao.icu`

**Content-Type：** `application/json`

**API版本：** v1

---

## 认证方式

所有API请求都需要在请求头中携带JWT Token：

```http
Authorization: Bearer <your_jwt_token>
```

### 获取Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

**响应：**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

## 统一推理API

### POST /api/ai/chat

艹，这个接口提供OpenAI兼容的Chat Completions API，支持流式和非流式输出！

#### 请求参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| model | string | 是 | 模型名称（如：gpt-4, claude-3-opus） |
| messages | array | 是 | 聊天消息数组 |
| temperature | number | 否 | 采样温度（0-2，默认1） |
| max_tokens | number | 否 | 最大生成token数 |
| top_p | number | 否 | 核采样参数（0-1，默认1） |
| stream | boolean | 否 | 是否流式输出（默认false） |
| tools | array | 否 | 工具定义（Tool Calling） |
| tool_choice | string\|object | 否 | 工具选择策略 |
| user | string | 否 | 用户ID（用于审计） |

#### 消息格式

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string; // 工具名称（role=tool时）
  tool_call_id?: string; // 工具调用ID
  tool_calls?: ToolCall[]; // 工具调用列表
}
```

#### 请求示例

**非流式：**
```bash
curl -X POST https://api.aizhao.icu/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {
        "role": "system",
        "content": "你是一个有帮助的AI助手"
      },
      {
        "role": "user",
        "content": "介绍一下量子计算"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 500
  }'
```

**流式（SSE）：**
```bash
curl -X POST https://api.aizhao.icu/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "你好"}
    ],
    "stream": true
  }'
```

#### 响应示例

**非流式响应：**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "量子计算是一种利用量子力学原理进行信息处理的计算方式..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 150,
    "total_tokens": 175
  }
}
```

**流式响应（SSE）：**
```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":123,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":"量"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":123,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"子"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":123,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"计"},"finish_reason":null}]}

data: [DONE]
```

#### 工具调用（Tool Calling）

```bash
curl -X POST https://api.aizhao.icu/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "北京今天天气怎么样？"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "获取指定城市的天气信息",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "城市名称"
              }
            },
            "required": ["location"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'
```

**工具调用响应：**
```json
{
  "id": "chatcmpl-tool123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\":\"北京\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ]
}
```

---

## COS直传API

### POST /api/admin/uploads/sts

艹，这个接口生成腾讯云COS临时密钥，支持前端直传文件！

#### 请求参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| filename | string | 是 | 文件名 |
| contentType | string | 是 | 文件MIME类型 |
| action | string | 否 | 操作类型：upload/download/all（默认upload） |
| durationSeconds | number | 否 | 有效期（秒，默认1800） |

#### 请求示例

```bash
curl -X POST https://api.aizhao.icu/api/admin/uploads/sts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "filename": "avatar.png",
    "contentType": "image/png",
    "action": "upload",
    "durationSeconds": 1800
  }'
```

#### 响应示例

```json
{
  "credentials": {
    "tmpSecretId": "AKIDxxxxxx",
    "tmpSecretKey": "xxxxxxxx",
    "sessionToken": "xxxxxxxx"
  },
  "expiredTime": 1234567890,
  "expiration": "2025-11-03T12:30:00Z",
  "bucket": "my-bucket-123456",
  "region": "ap-guangzhou",
  "uploadUrl": "https://my-bucket-123456.cos.ap-guangzhou.myqcloud.com/user-123/avatar.png",
  "key": "user-123/avatar.png"
}
```

#### 前端使用示例

```typescript
// 1. 获取STS临时密钥
const stsResponse = await fetch('/api/admin/uploads/sts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    filename: file.name,
    contentType: file.type
  })
});

const { credentials, bucket, region, key } = await stsResponse.json();

// 2. 使用临时密钥上传文件
const cos = new COS({
  getAuthorization: (options, callback) => {
    callback({
      TmpSecretId: credentials.tmpSecretId,
      TmpSecretKey: credentials.tmpSecretKey,
      SecurityToken: credentials.sessionToken,
      ExpiredTime: credentials.expiredTime
    });
  }
});

cos.putObject({
  Bucket: bucket,
  Region: region,
  Key: key,
  Body: file
}, (err, data) => {
  if (err) {
    console.error('上传失败:', err);
  } else {
    console.log('上传成功:', data.Location);
  }
});
```

---

## 知识库管理API

### POST /api/admin/kb/documents

艹，这个接口上传文档到知识库并创建embedding任务！

#### 请求参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| kbId | string | 是 | 知识库ID |
| title | string | 是 | 文档标题 |
| content | string | 是 | 文档内容 |
| format | string | 是 | 文档格式：text/markdown/pdf/docx |
| metadata | object | 否 | 文档元数据（作者、分类等） |

#### 请求示例

```bash
curl -X POST https://api.aizhao.icu/api/admin/kb/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "kbId": "kb-001",
    "title": "产品使用手册",
    "content": "第一章：快速开始\n\n本章介绍如何快速开始使用本产品...",
    "format": "markdown",
    "metadata": {
      "author": "产品团队",
      "category": "文档",
      "version": "1.0"
    }
  }'
```

#### 响应示例

```json
{
  "documentId": "doc-abc123",
  "jobId": "job-xyz789",
  "status": "queued",
  "message": "文档已加入处理队列"
}
```

### GET /api/admin/kb/documents

获取知识库文档列表。

#### 查询参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| kbId | string | 是 | 知识库ID |
| page | number | 否 | 页码（默认1） |
| limit | number | 否 | 每页数量（默认20） |
| status | string | 否 | 状态筛选：pending/processing/completed/failed |

#### 请求示例

```bash
curl "https://api.aizhao.icu/api/admin/kb/documents?kbId=kb-001&page=1&limit=20&status=completed" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 响应示例

```json
{
  "documents": [
    {
      "id": "doc-abc123",
      "kbId": "kb-001",
      "title": "产品使用手册",
      "format": "markdown",
      "status": "completed",
      "chunksCount": 25,
      "createdAt": "2025-11-03T10:00:00Z",
      "updatedAt": "2025-11-03T10:05:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### POST /api/admin/kb/query

检索知识库文档（向量相似度搜索）。

#### 请求参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| kbId | string | 是 | 知识库ID |
| query | string | 是 | 查询文本 |
| topK | number | 否 | 返回结果数量（默认5） |
| threshold | number | 否 | 相似度阈值（0-1，默认0.7） |

#### 请求示例

```bash
curl -X POST https://api.aizhao.icu/api/admin/kb/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "kbId": "kb-001",
    "query": "如何快速开始使用产品？",
    "topK": 5,
    "threshold": 0.7
  }'
```

#### 响应示例

```json
{
  "results": [
    {
      "documentId": "doc-abc123",
      "chunkId": "chunk-001",
      "text": "第一章：快速开始\n\n本章介绍如何快速开始使用本产品...",
      "score": 0.92,
      "metadata": {
        "title": "产品使用手册",
        "author": "产品团队"
      }
    },
    {
      "documentId": "doc-abc123",
      "chunkId": "chunk-002",
      "text": "1. 安装产品：访问官网下载最新版本...",
      "score": 0.85,
      "metadata": {
        "title": "产品使用手册",
        "author": "产品团队"
      }
    }
  ],
  "total": 2,
  "query": "如何快速开始使用产品？"
}
```

### GET /api/admin/kb/queue-stats

获取知识库处理队列统计信息。

#### 请求示例

```bash
curl "https://api.aizhao.icu/api/admin/kb/queue-stats" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 响应示例

```json
{
  "queue": "kb-ingestion",
  "counts": {
    "waiting": 3,
    "active": 2,
    "completed": 150,
    "failed": 5,
    "delayed": 0
  },
  "throughput": {
    "lastHour": 25,
    "last24Hours": 180
  }
}
```

---

## 错误码

艹，所有错误响应都遵循统一格式！

### 错误响应格式

```json
{
  "error": "错误信息描述",
  "code": "ERROR_CODE",
  "details": {
    "field": "具体字段",
    "message": "详细错误信息"
  }
}
```

### HTTP状态码

| 状态码 | 描述 | 场景 |
|--------|------|------|
| 200 | 成功 | 请求成功 |
| 201 | 已创建 | 资源创建成功 |
| 400 | 请求错误 | 参数验证失败 |
| 401 | 未授权 | 未提供或token无效 |
| 403 | 禁止访问 | 权限不足 |
| 404 | 未找到 | 资源不存在 |
| 429 | 请求过多 | 触发限流 |
| 500 | 服务器错误 | 内部错误 |
| 503 | 服务不可用 | 服务维护中 |

### 常见错误代码

| 错误代码 | 描述 | 解决方案 |
|----------|------|----------|
| INVALID_TOKEN | Token无效或过期 | 重新登录获取新token |
| INSUFFICIENT_PERMISSIONS | 权限不足 | 联系管理员授权 |
| INVALID_PARAMETERS | 参数验证失败 | 检查请求参数格式 |
| PROVIDER_UNAVAILABLE | Provider不可用 | 等待服务恢复或切换Provider |
| RATE_LIMIT_EXCEEDED | 超出速率限制 | 降低请求频率 |
| KB_NOT_FOUND | 知识库不存在 | 检查知识库ID |
| DOCUMENT_PROCESSING_FAILED | 文档处理失败 | 检查文档格式和内容 |

---

## 限流策略

艹，老王实施了严格的限流策略防止滥用！

| 用户类型 | 限制 | 时间窗口 |
|----------|------|----------|
| 免费用户 | 10次/分钟 | 60秒 |
| 付费用户 | 100次/分钟 | 60秒 |
| VIP用户 | 1000次/分钟 | 60秒 |

**限流响应：**
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60,
  "limit": 10,
  "remaining": 0
}
```

---

## 联系支持

- **技术支持邮箱：** support@aizhao.icu
- **API问题反馈：** https://github.com/your-org/api-issues
- **文档更新：** 请提交PR到docs仓库

艹，有问题就来问老王！这文档写得够清楚了吧！
