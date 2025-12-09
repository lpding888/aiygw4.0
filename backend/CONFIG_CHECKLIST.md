# 配置清单

## 📋 环境变量配置清单

本文档列出所有支持的环境变量及其说明。

### ✅ 必需配置 (生产环境必填)

| 配置项 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| **数据库** |
| `DB_HOST` | string | 数据库主机地址 | `localhost` |
| `DB_USER` | string | 数据库用户名 | `root` |
| `DB_PASSWORD` | string | 数据库密码 | `your_password` |
| `DB_NAME` | string | 数据库名称 | `ai_wardrobe_prod` |
| **安全** |
| `JWT_SECRET` | string | JWT签名密钥 (≥32字符) | `your_jwt_secret_32_chars_min` |
| `ENCRYPTION_KEY_V1` | string | 数据加密密钥 (32字符) | `your_encryption_key_32_chars` |
| **存储** |
| `COS_BUCKET` | string | 腾讯云COS存储桶 | `my-bucket-1234567890` |
| `COS_REGION` | string | COS地域 | `ap-guangzhou` |
| **缓存** |
| `REDIS_HOST` | string | Redis主机地址 | `localhost` |

---

### 🔧 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| **服务器** |
| `NODE_ENV` | enum | `development` | 运行环境: development/production/test/staging |
| `PORT` | number | `3000` | 服务监听端口 |
| `FRONTEND_URL` | string | `http://localhost:3001` | 前端URL (CORS配置) |
| `API_PREFIX` | string | `/api` | API路由前缀 |
| **数据库连接池** |
| `DB_PORT` | number | `3306` | 数据库端口 |
| `DATABASE_POOL_MIN` | number | `5` | 最小连接数 |
| `DATABASE_POOL_MAX` | number | `40` | 最大连接数 |
| `DATABASE_POOL_IDLE` | number | `30000` | 空闲超时(毫秒) |
| `DATABASE_POOL_ACQUIRE_TIMEOUT` | number | `10000` | 获取连接超时(毫秒) |

---

### 🔐 安全配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| **JWT** |
| `JWT_ACCESS_EXPIRES_IN` | string | `15m` | 访问令牌过期时间 |
| `JWT_REFRESH_EXPIRES_IN` | string | `7d` | 刷新令牌过期时间 |
| `JWT_EXPIRE` | string | `7d` | JWT过期时间 (兼容) |
| **加密** |
| `ENCRYPTION_KEY_V2` | string | - | 加密密钥V2 (可选) |
| `ENCRYPTION_ALGORITHM` | string | `aes-256-gcm` | 加密算法 |
| **限流** |
| `RATE_LIMIT_WINDOW_MS` | number | `60000` | 限流时间窗口(毫秒) |
| `RATE_LIMIT_MAX_REQUESTS` | number | `100` | 时间窗口内最大请求数 |
| `CORS_ORIGINS` | string | - | 允许的跨域来源 (逗号分隔) |
| `ALLOWED_HOSTS` | string | - | 允许的主机 (逗号分隔) |

---

### 💾 Redis配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `REDIS_HOST` | string | `localhost` | Redis主机地址 |
| `REDIS_PORT` | number | `6379` | Redis端口 |
| `REDIS_PASSWORD` | string | - | Redis密码 (可选) |
| `REDIS_DB` | number | `0` | 缓存数据库索引 |
| `REDIS_BULLMQ_DB` | number | `2` | BullMQ队列数据库索引 |
| `REDIS_URL` | string | - | Redis连接URL (可选) |

---

### 🚀 BullMQ配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `BULLMQ_PREFIX` | string | `ai_photo` | 队列键前缀 |
| `BULLMQ_KEEP_COMPLETED_SECONDS` | number | `86400` | 保留完成任务时间(秒) |
| `BULLMQ_KEEP_COMPLETED_COUNT` | number | `1000` | 保留完成任务数量 |
| `BULLMQ_KEEP_FAILED_COUNT` | number | `500` | 保留失败任务数量 |
| `BULLMQ_DEFAULT_ATTEMPTS` | number | `3` | 默认重试次数 |
| `WORKER_CONCURRENCY` | number | `5` | Worker并发数 |
| **监控面板** |
| `ENABLE_BULL_BOARD` | boolean | `false` | 启用BullMQ监控面板 |
| `BULL_BOARD_READONLY` | boolean | `true` | 只读模式 |
| `BULL_BOARD_USERNAME` | string | `admin` | Basic Auth用户名 |
| `BULL_BOARD_PASSWORD` | string | - | Basic Auth密码 |
| `BULL_BOARD_WHITELIST_IPS` | string | - | IP白名单 (逗号分隔) |

---

### ☁️ 腾讯云COS配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `COS_SECRET_ID` | string | - | 腾讯云SecretId (可选) |
| `COS_SECRET_KEY` | string | - | 腾讯云SecretKey (可选) |
| `COS_BUCKET` | string | **(必需)** | COS存储桶名称 |
| `COS_REGION` | string | **(必需)** | COS地域 |
| `COS_DOMAIN` | string | - | 自定义CDN域名 |

---

### 📧 SMTP邮件配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `SMTP_HOST` | string | - | SMTP服务器地址 |
| `SMTP_PORT` | number | - | SMTP端口 (通常465或587) |
| `SMTP_SECURE` | boolean | `true` | 是否使用SSL/TLS |
| `SMTP_USER` | string | - | SMTP用户名 (邮箱地址) |
| `SMTP_PASSWORD` | string | - | SMTP密码或授权码 |
| `SMTP_FROM` | string | - | 发件人邮箱 |
| `SMTP_FROM_NAME` | string | `AI衣柜` | 发件人名称 |

---

### 📱 短信服务配置 (腾讯云SMS)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `SMS_SECRET_ID` | string | - | 腾讯云SecretId |
| `SMS_SECRET_KEY` | string | - | 腾讯云SecretKey |
| `SMS_SDK_APP_ID` | string | - | 短信应用ID |
| `SMS_SIGN_NAME` | string | - | 短信签名 |
| `SMS_TEMPLATE_CODE` | string | - | 短信模板ID |

---

### 🤖 LLM服务配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| **DeepSeek** |
| `DEEPSEEK_API_KEY` | string | - | DeepSeek API密钥 |
| `DEEPSEEK_API_URL` | string | `https://api.deepseek.com/...` | API端点 |
| **Hunyuan** |
| `HUNYUAN_API_KEY` | string | - | 腾讯混元API密钥 |
| `HUNYUAN_API_SECRET` | string | - | 腾讯混元API Secret |
| **快手AI** |
| `KUAI_API_KEY` | string | - | 快手AI API密钥 |
| **RunningHub** |
| `RUNNINGHUB_API_KEY` | string | - | RunningHub API密钥 |
| **腾讯云** |
| `TENCENT_SECRET_ID` | string | - | 腾讯云SecretId |
| `TENCENT_SECRET_KEY` | string | - | 腾讯云SecretKey |

---

### 💬 微信配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| **微信公众号** |
| `WECHAT_APP_ID` | string | - | 公众号AppID |
| `WECHAT_APP_SECRET` | string | - | 公众号AppSecret |
| **微信小程序** |
| `WECHAT_MINIAPP_ID` | string | - | 小程序AppID |
| `WECHAT_MINIAPP_SECRET` | string | - | 小程序AppSecret |
| **微信开放平台** |
| `WECHAT_OFFICIAL_APP_ID` | string | - | 开放平台AppID |
| `WECHAT_OFFICIAL_APP_SECRET` | string | - | 开放平台AppSecret |
| **服务器配置** |
| `WECHAT_TOKEN` | string | - | 服务器令牌 |
| `WECHAT_ENCODING_AES_KEY` | string | - | 消息加密密钥 |

---

### 💳 支付配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| **微信支付** |
| `WECHAT_PAY_MCH_ID` | string | - | 商户号 |
| `WECHAT_PAY_API_KEY` | string | - | API密钥 |
| `WECHAT_PAY_CERT_PATH` | string | - | 证书路径 |
| **支付宝** |
| `ALIPAY_APP_ID` | string | - | 应用ID |
| `ALIPAY_PRIVATE_KEY` | string | - | 应用私钥 |

---

### 📊 日志和监控配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `LOG_LEVEL` | enum | `info` | 日志级别: error/warn/info/debug |
| `SENTRY_DSN` | string | - | Sentry错误追踪DSN |
| `SENTRY_ENVIRONMENT` | string | - | Sentry环境标识 |
| `SENTRY_TRACES_SAMPLE_RATE` | number | `0.1` | 性能追踪采样率 (0-1) |

---

### 💼 业务配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| **配额** |
| `PLAN_MONTHLY_QUOTA` | number | `100` | 月度基础配额 |
| `QUOTA_COST_BASIC_CLEAN` | number | `1` | 基础清洁费用 |
| `QUOTA_COST_MODEL_POSE12` | number | `1` | 模特姿势费用 |
| `QUOTA_COST_VIDEO_GENERATE` | number | `5` | 视频生成费用 |
| **功能开关** |
| `ENABLE_REGISTRATION` | boolean | `true` | 启用用户注册 |
| `ENABLE_EMAIL_VERIFICATION` | boolean | `false` | 启用邮箱验证 |

---

## 🔐 敏感配置清单

以下配置包含敏感信息，**切勿提交到版本控制或公开**：

- `DB_PASSWORD` - 数据库密码
- `JWT_SECRET` - JWT密钥
- `ENCRYPTION_KEY_V1` / `ENCRYPTION_KEY_V2` - 加密密钥
- `COS_SECRET_KEY` - 腾讯云密钥
- `SMTP_PASSWORD` - SMTP密码
- `SMS_SECRET_KEY` - 短信服务密钥
- 所有包含`API_KEY`、`SECRET`、`PASSWORD`的配置

**安全建议**：
1. 使用环境变量或密钥管理服务存储
2. 生产环境密钥长度≥32字符
3. 定期轮换密钥
4. 不同环境使用不同密钥

---

## ✅ 配置验证检查清单

部署前请确认：

### 开发环境
- [ ] 数据库连接配置
- [ ] JWT_SECRET已设置
- [ ] ENCRYPTION_KEY_V1已设置
- [ ] COS配置完整
- [ ] Redis连接正常

### 生产环境
- [ ] **所有必需配置已填写**
- [ ] 密钥长度≥32字符
- [ ] 未使用示例/默认密钥
- [ ] SMTP邮件服务已配置
- [ ] 日志级别设为`info`或`warn`
- [ ] Sentry错误追踪已配置
- [ ] 限流参数已调整
- [ ] BullMQ监控面板安全加固
- [ ] CORS来源已限制

---

**最后更新**: 2025-12-08
