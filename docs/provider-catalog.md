# Provider Catalog 文档

艹，这个Provider Catalog系统是整个多模型聚合的核心！负责统一管理各个AI供应商的接入配置。

## 概述

Provider Catalog提供了一个统一的供应商管理系统，支持：
- 多厂商/多模型统一路由
- AES-256-GCM加密存储敏感信息
- 连接测试与健康检查
- 权重配置与负载均衡
- 超时与重试策略
- 熔断保护

## 表结构

### 1. provider_endpoints

**主要字段：**
- `provider_ref` (string, 主键) - Provider唯一引用ID
- `provider_name` (string) - Provider显示名称
- `endpoint_url` (string) - API端点URL
- `credentials_encrypted` (text) - AES加密的凭证信息
- `auth_type` (enum) - 认证类型：bearer/api_key/oauth
- `is_active` (boolean) - 是否激活
- `weight` (integer) - 负载均衡权重
- `timeout_ms` (integer) - 超时时间（毫秒）
- `max_retries` (integer) - 最大重试次数
- `created_at` / `updated_at` - 时间戳

**索引：**
- PRIMARY KEY: `provider_ref`
- INDEX: `is_active`
- INDEX: `weight`

### 2. provider_secrets

**主要字段：**
- `id` (UUID, 主键) - 密钥ID
- `provider_ref` (string, 外键) - 关联provider_endpoints
- `secret_key` (string) - 密钥键名（如api_key, secret_key）
- `secret_value_encrypted` (text) - AES加密的密钥值
- `secret_type` (enum) - 密钥类型：api_key/access_token/private_key
- `expires_at` (datetime, 可选) - 过期时间
- `created_at` / `updated_at` - 时间戳

**索引：**
- PRIMARY KEY: `id`
- INDEX: `provider_ref`
- INDEX: `secret_type`
- UNIQUE: `provider_ref, secret_key`

## 加密策略

### 加密算法
- **算法**：AES-256-GCM
- **密钥来源**：环境变量 `CRYPTO_KEY`（32字节）
- **IV生成**：每次加密生成随机IV（12字节）
- **认证标签**：GCM模式提供完整性保护（16字节）

### 存储格式
```
<iv>:<encrypted_data>:<auth_tag>
```

### 加密字段
- `provider_endpoints.credentials_encrypted`
- `provider_secrets.secret_value_encrypted`

### 输出掩码
API返回时，敏感字段自动掩码：
```json
{
  "provider_ref": "openai-001",
  "credentials": "***MASKED***",
  "api_key": "sk-***...***xyz"
}
```

## API接口

### 1. 获取Provider列表
```http
GET /admin/providers?type=LLM&enabled=true&page=1&limit=20
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "provider_ref": "openai-001",
        "provider_name": "OpenAI GPT-4",
        "endpoint_url": "https://api.openai.com/v1/chat/completions",
        "auth_type": "bearer",
        "is_active": true,
        "weight": 100,
        "timeout_ms": 30000,
        "max_retries": 3,
        "credentials": "***MASKED***"
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 20
  }
}
```

### 2. 创建Provider
```http
POST /admin/providers
Authorization: Bearer <token>
Content-Type: application/json

{
  "provider_ref": "anthropic-001",
  "provider_name": "Anthropic Claude",
  "endpoint_url": "https://api.anthropic.com/v1/messages",
  "credentials": {
    "api_key": "sk-ant-xxx"
  },
  "auth_type": "bearer",
  "weight": 80,
  "timeout_ms": 30000,
  "max_retries": 2
}
```

### 3. 更新Provider
```http
PUT /admin/providers/:ref
Authorization: Bearer <token>
Content-Type: application/json

{
  "provider_name": "Anthropic Claude 3.5",
  "is_active": true,
  "weight": 90
}
```

### 4. 测试连接
```http
POST /admin/providers/:ref/test
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "provider_ref": "openai-001",
    "status": "healthy",
    "latency_ms": 256,
    "test_time": "2025-11-03T10:30:00Z",
    "response": {
      "model": "gpt-4-turbo",
      "available": true
    }
  }
}
```

### 5. 删除Provider
```http
DELETE /admin/providers/:ref
Authorization: Bearer <token>
```

## Repository层

### 文件位置
`backend/src/repositories/providerEndpoints.repo.ts`

### 主要方法

```typescript
// 创建Provider（自动加密credentials）
async create(input: ProviderEndpointInput): Promise<ProviderEndpoint>

// 查询Provider（自动解密credentials）
async findByRef(providerRef: string): Promise<ProviderEndpoint | null>

// 查询所有Provider
async findAll(filters: {
  isActive?: boolean;
  weight?: number;
}): Promise<ProviderEndpoint[]>

// 更新Provider
async update(
  providerRef: string,
  updates: Partial<ProviderEndpointInput>
): Promise<ProviderEndpoint>

// 删除Provider
async delete(providerRef: string): Promise<void>

// 测试连接
async testConnection(providerRef: string): Promise<{
  status: string;
  latency_ms: number;
  error?: string;
}>
```

### 缓存策略
- **L1缓存**：内存LRU，TTL 5分钟
- **缓存键**：`provider:${provider_ref}`
- **失效策略**：create/update/delete时自动清除

## 集成示例

### 1. 注册OpenAI Provider

```bash
curl -X POST http://localhost:3000/admin/providers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_ref": "openai-gpt4",
    "provider_name": "OpenAI GPT-4 Turbo",
    "endpoint_url": "https://api.openai.com/v1/chat/completions",
    "credentials": {
      "api_key": "sk-proj-xxx"
    },
    "auth_type": "bearer",
    "weight": 100,
    "timeout_ms": 30000,
    "max_retries": 3
  }'
```

### 2. 测试连接

```bash
curl -X POST http://localhost:3000/admin/providers/openai-gpt4/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. 在代码中使用

```typescript
import providerEndpointsRepo from './repositories/providerEndpoints.repo';

// 获取Provider配置
const provider = await providerEndpointsRepo.findByRef('openai-gpt4');

// 使用Provider调用API
const response = await axios.post(
  provider.endpoint_url,
  {
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: 'Hello!' }]
  },
  {
    headers: {
      'Authorization': `Bearer ${provider.credentials_encrypted.api_key}`,
      'Content-Type': 'application/json'
    },
    timeout: provider.timeout_ms
  }
);
```

## 安全注意事项

### ⚠️ 重要安全规范

1. **环境变量保护**
   - `CRYPTO_KEY` 必须设置为32字节随机字符串
   - 不要将 `CRYPTO_KEY` 提交到代码仓库
   - 生产环境使用密钥管理服务（KMS）

2. **API权限**
   - Provider管理API仅限管理员角色访问
   - 使用JWT + RBAC验证身份
   - 所有请求必须带requestId用于审计

3. **数据脱敏**
   - API响应中凭证字段自动掩码
   - 日志中不记录明文凭证
   - 前端不展示完整凭证

4. **网络隔离**
   - Provider端点仅内网可访问
   - 使用防火墙限制出站连接
   - 配置反向代理隐藏真实端点

## 故障排查

### 问题1：加密失败
**错误**：`Encryption failed: Invalid key length`

**原因**：`CRYPTO_KEY` 长度不是32字节

**解决**：
```bash
# 生成32字节密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 设置环境变量
export CRYPTO_KEY=<生成的密钥>
```

### 问题2：测试连接超时
**错误**：`Connection test failed: timeout`

**检查**：
1. 端点URL是否正确
2. 凭证是否有效
3. 网络是否可达
4. timeout_ms配置是否合理

### 问题3：Provider不可用
**现象**：健康检查失败

**排查步骤**：
1. 检查 `is_active` 字段
2. 测试Provider连接
3. 查看日志错误信息
4. 验证凭证是否过期

## 监控指标

建议监控以下指标：
- `provider_test_success_rate` - 测试连接成功率
- `provider_api_latency` - API调用延迟
- `provider_error_rate` - 错误率
- `provider_cache_hit_ratio` - 缓存命中率
- `provider_credential_rotation` - 凭证轮换次数

## 最佳实践

1. **高可用配置**
   - 配置多个相同功能的Provider
   - 设置合理的权重分配
   - 启用熔断保护

2. **凭证管理**
   - 定期轮换API密钥
   - 为不同环境使用不同凭证
   - 记录凭证更新审计日志

3. **性能优化**
   - 合理设置timeout和retry
   - 使用缓存减少查询
   - 监控并调整权重

4. **安全加固**
   - 定期审计Provider配置
   - 限制管理API访问
   - 加密传输所有敏感数据

---

**相关文档：**
- [BuildingAI Sidecar集成](./buildingai-sidecar.md)
- [统一推理API设计](./ai-gateway.md)
- [熔断与重试策略](./circuit-breaker.md)

**维护者**：老王
**最后更新**：2025-11-03
