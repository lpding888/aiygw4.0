# AI 照后端服务说明

服装 AI 处理 SaaS 的后端 API，基于 Node.js/Express + MySQL + Redis + BullMQ。

## 架构总览
- **API 层**：Express 路由与控制器，统一经 `middlewares` 处理鉴权/鉴权、限流与错误上报。
- **服务层**：`services/` 内聚业务（认证、支付、缓存、模板、健康检查等），遵循单一职责。
- **数据访问层**：Knex 仓储（`repositories/`），负责 SQL 与脱敏/加密。
- **异步任务**：BullMQ 队列（`queue.service.ts`）+ Worker（如 PipelineWorker、VideoPolling）。
- **观测与安全**：Winston 日志、Prometheus 指标、Sentry/Slack Webhook（需配置）、BullBoard 只读监控。
- **存储**：MySQL 8 (数据)、Redis 6 (缓存/队列)、COS (对象存储)。

## 环境与快速开始
```bash
npm install
cp .env.example .env   # 按需填写 DB/Redis/COS/SMS/微信 等配置
npm run db:migrate
npm run dev            # http://localhost:3000
```
关键环境变量：`DB_*`、`REDIS_*`、`COS_*`、`JWT_SECRET`、`SMTP_*`、`TENCENT_SMS_*`、`WECHAT_*`、`ENABLE_BULL_BOARD`。

## API 文档
- Swagger UI：`/api-docs`，JSON：`/api-docs.json`（`src/config/swagger.config.ts`）。
- 主要路由：`src/routes`、管理端路由在 `src/routes/admin`。
- 若需生成静态文档，可在根目录补充 `API_DOCUMENTATION.md`，并同步 Swagger schema。

## 代码注释与规范
- 公共方法、导出接口/类型需带 JSDoc（说明参数/返回值/异常）。示例：
  ```ts
  /**
   * 获取模板详情
   * @param id 模板ID
   * @returns 模板实体，不存在时抛 AppError
   */
  async getTemplateById(id: string): Promise<PromptTemplate> { ... }
  ```
- 对安全/性能敏感的逻辑（缓存失效、外部调用重试、幂等保证）需写简短说明。
- 统一使用 ESLint/Prettier (`npm run lint` / `npm run format`)。

## 部署（生产）
```bash
npm ci
npm run build
npm run db:migrate           # 确保迁移完成
NODE_ENV=production pm2 start ecosystem.config.js
pm2 logs                     # 观察启动/错误日志
```
运维要点：
- 配置 BullBoard 认证：`ENABLE_BULL_BOARD=true` 且设置 `BULL_BOARD_WHITELIST_IPS` / `BULL_BOARD_USERNAME` / `BULL_BOARD_PASSWORD`。
- 监控：Prometheus 抓取 `/metrics`；Sentry/Slack Webhook 配置 `NOTIFICATION_WEBHOOK_URL`。
- 短信/邮件：生产必须配置 `TENCENT_SMS_*`、`SMTP_*`；COS/支付/微信等外部依赖需对应密钥。

## 故障排查
- **迁移失败**：检查 `DB_*` 连接、权限；使用 `npm run db:rollback` 回滚重试。
- **Redis/队列异常**：确认 `REDIS_HOST/PORT`，查看 `/admin/queues`（已加只读+认证）。
- **签名/鉴权错误**：JWT 依赖 `JWT_SECRET`；微信回调需 `WECHAT_OFFICIAL_TOKEN`。
- **外部调用失败**：COS/SMS/支付等检查密钥、地域、网络出口；查看 `notification.service` 推送的告警。
- **性能/缓存**：LRU + Redis 双层缓存，遇到不一致可调用相关 `deletePattern` 或版本化缓存失效接口。

## 可用脚本
```bash
npm start              # 生产启动
npm run dev            # 开发热重载
npm run db:migrate     # 迁移
npm run db:rollback    # 回滚
npm run lint           # 代码检查
npm run format         # 代码格式化
npm test               # 单测（如配置了用例）
```

## 许可证
待定
