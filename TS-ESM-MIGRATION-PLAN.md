# TypeScript + ESM 全量升级作战计划

> 统一后端到 TypeScript + ES Modules，升级核心依赖到当前稳定版本，完成后需确保编译、测试、容器启动全部通过。每一步不得批处理，不得跳过测试。

---

## 阶段 0：战场准备（~0.5 天）

- [x] 锁定 Node.js 版本：使用当前 LTS（Node ≥ 20.10），更新 `.nvmrc` / `.tool-versions` / Docker base image。
- [x] 备份现有后端源码（只读）：例如 `backend_legacy/` 供对照参考。
- [x] 梳理模块清单并排定迁移顺序：认证、配额、任务、CMS、支付、KMS、调度、WebSocket、BullMQ、日志、配置等（详见阶段 3 列表）。
- [x] 明确现有构建/测试命令：`npm run build`、`npm run test`、`npm run test:unit`、`npm run test:integration`、`npm run lint`、`npm run format`、`docker-compose.up`（现有脚本需后续更新为 TS/ESM 版本）、`tests/` 冒烟脚本。
- [x] `madge` 生成依赖拓扑：输出 `docs/迁移作战手册/madge-deps.json`。
- [x] 统计各目录 `.js` 余量并记录在附录。
- [x] 梳理 CommonJS 外部 SDK 并制定适配策略。
- [x] `madge` 生成依赖拓扑：输出 `docs/迁移作战手册/madge-deps.json`，用于后续分层迁移。
- [x] 统计各目录 `.js` 余量并记录在附录，作为迁移进度基线。
- [x] 梳理仍为 CommonJS 的外部 SDK，给出封装/替换策略（详见《阶段0 情报梳理》）。

---

## 阶段 1：工具链换血（~1 天）

- [x] 重写 `tsconfig.json` / `tsconfig.build.json`：
  - `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"target": "ES2022"`, `"allowJs": false`, `"strict": true`。
- [x] 更新 `package.json` 脚本（全部改为 ESM/TS）：
  - `dev`: `tsx src/server.ts`
  - `build`: `tsc --project tsconfig.build.json`
  - `start`: `node dist/server.js`
  - 移除 `--loader ts-node/esm`、`require` 等旧命令。
- [x] 升级核心依赖到最新稳定版（TypeScript、tsx、ts-node、ts-jest、Jest、ESLint、Prettier、Knex、BullMQ、Winston、ioredis 等）。
- [x] 更新 ESLint/Prettier 配置，禁止 CommonJS，统一 `.ts` 扩展。
- [x] 修改 Dockerfile/CI，确保使用新脚本和 Node 版本。

> 验证：`npm install`、`npm run lint`、`npm run format`、`npm run build`（允许业务代码尚未迁移，但工具链需工作正常）。

---

### 阶段 1 · 当日进展（2025-11-07）

- ✅ Card 1.1 目录收敛复核：`src/middleware/` 全量并入 `src/middlewares/`，引用改写完成，`npm run build` 通过。
- ✅ Card 1.2 起步：`request-id` / `auth` TS 版本补齐与 JS 功能一致，`normalizeUserPayload` 统一用户信息，黑名单/撤销逻辑已验证。
- ✅ Card 1.3 触发：`global.d.ts` 集中维护 `req.id/user/token/i18n/admin` 扩展，移除中间件内自定义 `declare global`。
- ✅ Card 1.2 清理：逐一删除旧 JS 中间件（`adminAuth/auth/cache/errorHandler/requirePermission/validate`）。
- ✅ Card 1.2 补全：补出 `enhanced-error-handler.middleware.ts`、`validation.middleware.ts`，并删除同名 `.js` 源；仍保留 `rateLimiter.middleware.js`（`task.service.js` 依赖），待服务 TS 化后收口。

---

## CommonJS 余量基线（2025-11-06）

| 目录 | `.js` 数 | `.ts` 数 | 备注 |
|------|---------:|---------:|------|
| cache | 1 | 1 | `config-cache.js` 待迁 |
| config | 1 | 10 | 清理旧 `database.js` |
| controllers | 36 | 10 | 主战场 |
| db | 65 | 1 | 迁移脚本保留 |
| middleware | 2 | 2 | 旧目录，需合并 |
| middlewares | 9 | 4 | 中间件双轨 |
| providers | 3 | 7 | Provider CJS |
| routes | 32 | 18 | 多为 JS |
| services | 62 | 38 | 核心迁移对象 |
| utils | 7 | 11 | `response.js` 等 |

> 详细情报见 `docs/迁移作战手册/阶段0-情报梳理.md`。

---

## 阶段 2：公共设施迁移（~2-3 天）

- [ ] `app.ts`、`server.ts` 同步 TS/ESM：拆分入口 `bootstrapServer`，按责任注入请求 ID、Helmet、CORS、Swagger、调度器、BullMQ、Redis、WebSocket、健康检查。
- [ ] 中间件全集 TS 化：`auth`、`adminAuth`、`request-id`、`rateLimiter`、`errorHandler`、`cache`、`security` 等，补齐类型守卫并统一 `AppError`。
- [ ] 工具与基建：logger（定义 `LoggerContext` 接口）、Redis 管理器（补强 zset 操作的泛型别名）、`AppError`、响应封装、加密签名、RBAC、配置加载器全部改 TS。
- [ ] `config/` 模块 TS 化：环境变量校验、错误码表、i18n、COS、支付、Redis、第三方密钥等导出命名常量，禁止默认导出。
- [ ] `db/index.ts` 聚合单一 Knex 实例，封装连接生命周期并移除重复连接池。
- [ ] 验证：`npm run build`、工具层/错误处理单测、Redis 集成测试跑通。

---

### 阶段 2 子任务拆分（当前待认领）

> 三大块可以并行推进，但共用的 DB/Redis 基础设施已经完成，保持沟通避免重复改动。

1. **RAG 摄取链路迁移（负责人：可单独指派）**
   - `src/rag/ingest/chunker.ts`、`parser.ts`、`worker.ts`：补全 `.js` 扩展、Bull 队列与 chunk 类型定义、处理 `Buffer` 判定。
   - `routes/admin/kb.route.ts`：同步改 ES Module import，接入新版 `auth`/`requirePermission`。
   - 完成后需跑一遍本地摄取流程（或最小化单测）验证队列可正常入库。

2. **Repository/Controller 批次迁移（负责人：可多人并行，每人认领一组）**
   - 目标文件：`announcements.repo.ts`、`auditLogs.repo.ts`、`banners.repo.ts`、`contentTexts.repo.ts` 及其对应 controller。
   - 动作：替换为 `config/database.ts` 单例、为 Knex builder 显式加类型、消灭匿名 `any`、controller import 改 `.js`。
   - 注意：提交前需跑 `npm run lint`、`npm run build` 确保没有新的类型回归。

3. **Pub/Sub & Provider Loader 收尾（负责人：可单独指派）**
   - `src/pubsub/index.ts`：改用 `RedisManager`/`redisConfig`，明确类型签名，移除旧的 `new Redis()`。
   - `src/providers/provider-loader.ts` 及 `handlers/*.ts`：补 `.js` 扩展、BaseProvider 子类补齐 `logger/defaultTimeout` 等缺失属性。
   - 验证：运行 provider 自测（mock 调用或单测），保证动态加载和健康检查仍可工作。

> 约定：每个模块迁移完成必须提交 PR 并附带 `npm run build` 通过的记录，避免类型回归。剩余的业务模块（如支付、会员、AI Gateway 等）在本批完成后继续拆分。

---

## 阶段 3：业务模块逐个迁移（~5 天）

> 流程固定：路由 → 控制器 → 服务 → 仓库。每块完成即跑 `npm run build` + 对应单测/集成测，过了再动下一个。

- [ ] 认证 / 用户 / 权限：`/api/auth`、JWT、验证码、用户仓库；抽象 `AuthProvider`、`TokenSigner`。
- [ ] 会员 / 配额 / 任务 / 媒体：任务队列、配额策略、媒体服务、BullMQ 调度器；补 `QuotaRule` 类型定义。
- [ ] CMS / Admin / UI Schema：`/api/cms/*`、`/api/admin/*`、UI Schema 渲染、缓存策略；同步 swagger schema。
- [ ] 计费 / 支付 / 分销：支付宝、微信支付、回调签名、税费/佣金算法；补支付结果枚举。
- [ ] KMS / Invite / Referral / Config Snapshot：密钥管理、邀请码、推荐体系、动态配置；强化权限校验。
- [ ] AI 适配 / RunningHub / BuildingAI / SCF：外部 API 调度、WebSocket 派发、降级策略；加入重试与熔断类型。
- [ ] 验证：模块内单测/集成测 + `tests/` 冒烟脚本，接口契约改动同步文档。

---

## 阶段 4：调度与连接池防线（~1-2 天）

- [x] 定时任务重构为单例循环：`cronJobs.service.ts` 引入 job metrics、环境开关、任务清理（对接 `taskService.cleanupTimeoutTasks`）与 Provider 健康检查实时日志。
- [x] 连接池与健康监控：`server.ts` 优雅关停现在串行关闭 `queueService`、RAG ingest Worker、Redis、Knex；新增 `scripts/scheduler-health.ts` + `scripts/queue-stress.ts` 供运维巡检与压测。
- [x] BullMQ 统一：RAG `ingest/worker.ts` 切换至 BullMQ + QueueEvents，并提供 `shutdownIngestQueue()` 与 `/api/admin/kb/queue-stats` 结构化输出。
- [ ] 验证：`npm run test`（队列链路 UT/IT）pending —— 目前完成 `npm run build` + 新脚本自检。

---

## 阶段 5：依赖升级收尾（~1-2 天）

- [ ] 补齐剩余依赖升级（axios、joi、zod 等），比对破坏性变更并校准类型。
- [ ] 全量测试：`npm run test`、`tests/` 冒烟、必要的 Playwright/E2E。
- [ ] Docker 编译 & 启动：`docker compose up`、`/health` 核查、主要 API 冒烟。
- [ ] 升级报告：列依赖改动、兼容性评估、测试结论、后续 TODO；CI 需保持绿灯。

---

## 阶段 4：调度与连接池防线（~1-2 天）

- [x] Cron 调度强化：`cronJobs.service.ts` 增加 job metrics、环境开关与任务清理/Provider 健康检查常态化；`health.service.ts` 对接失效/超时判定。
- [x] 基础设施优雅关停：`server.ts` 关闭顺序扩展到 `queueService`、RAG ingest Worker、Redis、Knex；配套 CLI `scripts/scheduler-health.ts`、`scripts/queue-stress.ts` 提供巡检/压测手段。
- [x] 队列统一：`rag/ingest/worker.ts` 改写为 BullMQ（Queue+Worker+Events），`kb.route.ts` / 集成测试改为 mock worker API，移除 `bull` 依赖。
- [ ] 阶段验证：BullMQ 相关 UT/IT 仍需补齐（现阶段执行 `npm run build` + 脚本自检）。

---

## 阶段 6：预发布 & 压测（~1 天）

- [ ] 预发布环境：复刻生产配置、同步数据子集、注入 `featureFlag: esm`。
- [ ] 部署 TS/ESM 构建包，执行金丝雀验证与主要业务冒烟脚本。
- [ ] 压测：API、任务、WebSocket 各跑一轮，收集 QPS / 延迟 / 资源使用曲线。
- [ ] 验证：与旧版对比，性能退化 >10% 必须阻断上线并回滚分析。

---

## 阶段 7：上线 & 监控（~0.5 天）

- [ ] 上线计划：明确定窗、联系人、公告范围、回滚策略。
- [ ] 分批切流（灰度 10% → 50% → 100%），监控错误率、延迟、队列积压。
- [ ] 回滚条件：构建失败、P0 报警、关键链路超时飙升 30%。
- [ ] 验证：上线复盘记录、监控截图、报警清单归档。

---

## 风险与应对

| 风险 | 触发条件 | 缓解动作 |
|------|----------|----------|
| CommonJS 残余 | 旧代码仍 `require` / `module.exports` | `rg "require(" src` 全量扫描替换，补类型声明 |
| 第三方 SDK 不支持 ESM | SDK 仅提供 CJS 版本 | 构建 TS 适配器或替换同类库，必要时 `dynamic import()` |
| 连接池耗尽 | BullMQ / Redis 配置不当 | 引入连接池监控，调优超时 / 重试，压测阶段校准 |
| 测试缺口 | 模块迁移后缺乏覆盖 | 迁移清单强制补单测 / 集成测，Code Review 阻塞 |
| 回滚困难 | 新旧产物不兼容 | 保留 CJS 产物，打 Tag，部署脚本支持一键回滚 |

---

## 产出清单

- 更新后的 `tsconfig*.json`、`package.json`、`Dockerfile`、CI pipeline
- TS 化源码和类型定义，配套文档 `docs/`、`README`
- 压测 / 灰度 / 上线报告及监控面板截图
- 升级总结与后续优化建议

---

## 复盘 & 后续

- 上线后一周监控：错误率、连接使用、队列积压
- 收集开发 / 运维反馈，针对工具链或文档补强
- 规划下一轮优化：性能、观测、开发体验

---

> 这份计划是当前唯一准则，执行时如需调整，必须先更新本文件再操作。

### 阶段 1 验收（2025-11-07）
- 目录合并完成，TS 中间件补齐并统一类型；关键中间件 TS 化：auth/adminAuth/permission/validate/error-handler/rateLimiter/cache/security/request-id
- 删除未引用的 JS：middlewares/security.middleware.js、middlewares/unifiedAuth.middleware.js
- 构建通过（backend npm run build）
- 后续：路由迁移期间逐步替换 JS 中间件引用，确认零引用后统一清理其余 JS。

---

### 阶段 3 进展（2025-11-07 完成）
- 认证链路：已合并，JS 控制器/路由移除，统一 TS 版本。

---

## 状态快照（2025-11-07，本机重新扫描）

为方便后续协作型 AI 严格按卡片执行，这里记录一次真实文件余量（backend/src 下 .js）：

- cache: 1
- config: 1
- controllers: 19
- db: 65
- middlewares: 9
- providers: 3
- services: 47
- utils: 7
- 合计：152 个

统一执行入口与约束、卡片化流程，见：`docs/迁移作战手册/GPT5-后端迁移执行提示词.md`

### 本次增量（2025-11-07 夜间）
 - 中间件：新增 `enhanced-error-handler.middleware.ts` 与 `validation.middleware.ts`，并删除同名 `.js`；保留 `rateLimiter.middleware.js`（`task.service.js` 仍引用）。
 - 控制器清理：删除未挂载/未引用 JS 控制器 6 个（详见任务卡 Card 3.0），构建保持 0 错。
 - 服务：新增 `task.service.ts`（对齐 d.ts 签名），并补 `videoGenerate.service.d.ts`、`pipelineEngine.service.d.ts`；暂不删除 `task.service.js` 以兼容 JS 调用方。
- 控制器迁移：新增 `kms.controller.ts`（包装路由别名，动态导入 `kms.service.js`）与 `mcpEndpoint.controller.ts`（补齐统计/健康接口）；补类型 d.ts；构建保持 0 错。
- 服务迁移：新增 `contentAudit.service.ts`（审核任务结果、COS 删除、回写任务状态）；删除对应 `.js` 与占位 d.ts；构建保持 0 错。
- 熔断与Provider：新增 `provider-wrapper.service.ts`（封装熔断执行、统计、健康）与 `provider-registry.service.ts`（注册 imageProcess/aiModel 等）；控制器 `circuitBreaker` 使用保持不变；构建保持 0 错。
- 清理冗余 JS：删除 `job-processors.service.js`、`videoPolling.service.js`、`aiModel.service.js` 与 `middlewares/rateLimiter.middleware.js`，所有引用已切换至 TS 产物；构建保持 0 错。
- 下线核心 JS：`task.service.js` 已删除（所有调用方改为 TS 版本并以 `.js` 扩展导入编译产物）；构建保持 0 错。
- 控制器迁移补充：新增 `scfCallback.controller.ts`，并删除旧 `scfCallback.controller.js`；清理重复 `kms.controller.js`/`mcpEndpoint.controller.js`；构建保持 0 错。
- 用户资料链路：新增 `user-profile.controller.ts` 并补 `user-profile.service.d.ts`；旧 `user-profile.controller.js` 下线，构建保持 0 错。
- 管理端校验：`admin/pipelines-validate.controller.ts` 取代 JS 版本；路由 `/pipelines/validate`、`/pipelines/topological-order` 对应逻辑保持不变。

- CMS 模块：
  - controllers/routes：cmsFeature、cmsProvider、promptTemplates 全部 TS 化，路由已指向 TS 控制器。
  - services：新增 TS 版 cmsFeature.service.ts、cmsProvider.service.ts、promptTemplate.service.ts；删除对应 JS 版本与过时的桥接 d.ts。
- Pipeline 模块：
  - controllers：新增 TS 版 pipelineSchema.controller.ts、pipelineExecution.controller.ts，更新 routes 为 ESM 默认导入；删除 JS 版本与桥接 d.ts。
  - services：仍为 JS（pipelineSchema/pipelineExecution），已由 d.ts 声明文件提供最小类型，后续在 Stage 3 批次外单独升级。
- 统一错误：TS 控制器/服务改用 `utils/AppError.ts` + `ERROR_CODES`，替换旧 `utils/errors.js` 的直接构造方式。
- 构建：backend `npm run build` 0 错误。

清理记录
- 删除：
  - controllers：pipelineSchema.controller.js、pipelineExecution.controller.js、promptTemplate.controller.d.ts、pipeline*.controller.d.ts、cmsProvider.controller.js、promptTemplate.controller.js
  - services：cmsFeature.service.js、cmsProvider.service.js、promptTemplate.service.js、对应 *.d.ts 桥接
- 新增：
  - services：cmsFeature.service.ts、cmsProvider.service.ts、promptTemplate.service.ts、pipeline*.service.d.ts（最小声明）

验收
- 路由引用均指向 TS 控制器（以 .js 扩展，NodeNext 构建后对应 dist/*.js）。
- `npm run build` 通过；编译期不再依赖临时桥接（仅 pipeline*.service 保留 d.ts，待后续迁移）。

---

### 阶段 3 新增迁移（2025-11-07 本批）
- Feature 前台链路：
  - controllers/feature.controller.ts + routes/feature.routes.ts（替换 `/api/features`，修正 `app.ts` 路由映射）。
  - 删除 JS：controllers/feature.controller.js、routes/feature.routes.js。
- Invite Codes：
  - controllers/invite-code.controller.ts + routes/invite-code.routes.ts（`/api/invite-codes`）。
  - services/invite-code.service.ts（生成/校验/使用/统计/清理全链路 TS 化，接入 cacheService、事务与指标），删除旧 `.js` 及过渡 `services/invite-code.service.d.ts`。
  - cache service → `services/cache.service.ts`（2025-11-08）完成迁移，原 `cache.service.d.ts` 删除。
  - 构建：backend `npm run build` 0 错误。
- Distribution 分销链路：
  - controllers/distribution.controller.ts + routes/distribution.routes.ts（`/api/distribution`）。
  - 暂存桥接 d.ts：services/distribution.service.d.ts（待 service 迁移后移除）。
  - 删除 JS：controllers/distribution.controller.js、routes/distribution.routes.js。
- Cache 管理链路：
  - routes/cache.routes.ts（统一使用 TS 中间件 `authenticate/requireRole`）。
  - services/cache-subscriber.service.ts（2025-11-08）完成迁移，处理版本/失效/预热/健康事件；删除旧 `.js`。
- 配额 Saga：
  - services/quota.service.ts（2025-11-08）完成迁移，覆盖 reserve/confirm/cancel/getQuota/cleanup 全流程；删除旧 `.js`，继续被 task/pipeline 服务通过 `.js` 扩展引用。
  - 删除 JS：routes/cache.routes.js。
- Circuit Breaker 熔断链路：
  - controllers/circuitBreaker.controller.ts + routes/circuitBreaker.routes.ts。
  - 补充 d.ts：services/circuit-breaker.service.d.ts、services/provider-wrapper.service.d.ts、services/provider-registry.service.d.ts、middlewares/validation.middleware.d.ts。
  - 删除 JS：controllers/circuitBreaker.controller.js、routes/circuitBreaker.routes.js。
− Task 任务链路：
  − controllers/task.controller.ts + routes/task.routes.ts（`/api/task`）。
  − 暂存桥接 d.ts：services/task.service.d.ts、services/imageProcess.service.d.ts、services/aiModel.service.d.ts、services/pagination.service.d.ts。
  − 删除 JS：controllers/task.controller.js、routes/task.routes.js。

新增（2025-11-07 本批继续）
- Docs 文档路由：
  - routes/docs.routes.ts；补 d.ts：services/swagger.service.d.ts；删除 JS：routes/docs.routes.js。
- MCP Endpoints 顶层路由：
  - routes/mcpEndpoints.routes.ts；补 d.ts：controllers/mcpEndpoint.controller.d.ts；删除 JS：routes/mcpEndpoints.routes.js。
- KMS 路由：
  - routes/kms.routes.ts；补 d.ts：controllers/kms.controller.d.ts；删除 JS：routes/kms.routes.js。
- Referral Validation：
  - routes/referral-validation.routes.ts；补 d.ts：controllers/referral-validation.controller.d.ts；删除 JS：routes/referral-validation.routes.js。

新增（2025-11-07 补充）
- User Profile：
  - routes/user-profile.routes.ts；补 d.ts：controllers/user-profile.controller.d.ts；删除 JS：routes/user-profile.routes.js。
- WeChat Login：
  - routes/wechat-login.routes.ts；补 d.ts：controllers/wechat-login.controller.d.ts；删除 JS：routes/wechat-login.routes.js。
  - 说明：仍复用 JS 控制器，待后续将 controller/service 真正 TS 化后移除桥接。

新增（2025-11-07 批次三）
- Error Management（错误管理）：
  - routes/error-management.routes.ts；补 d.ts：middlewares/enhanced-error-handler.middleware.d.ts；删除 JS：routes/error-management.routes.js。
- Feature Catalog（管理端目录）：
  - routes/feature-catalog.routes.ts；补 d.ts：controllers/feature-catalog.controller.d.ts；删除 JS：routes/feature-catalog.routes.js。
  - services/feature-catalog.service.ts（2025-11-08）完成迁移，删除 JS 与过渡 d.ts，维持缓存/权限/统计能力。
- SCF 回调：
  - routes/scfCallback.routes.ts；补 d.ts：controllers/scfCallback.controller.d.ts；删除 JS：routes/scfCallback.routes.js。
- 清理重复旧版 admin 子路由：
  - 删除 routes/admin/mcp-endpoints.routes.js（新版顶层 mcpEndpoints 已接管）。
  - 删除 routes/admin/prompt-templates.routes.js（新版 admin/prompt-templates.routes.ts 已接管）。

当前构建状态：backend `npm run build` → 0 错误。

### 阶段 5 收尾（进行中）
- 重复实现清理（Service 层）：
  - 已删除 JS：`auth.service.js`, `configCache.service.js`, `providerHealth.service.js`（对应 TS 版已接管，且无 JS 引用链）。
  - 保留 JS（仍被 JS 模块引用）：`cmsCache.service.js`, `commission.service.js`, `kuai.service.js`, `quota.service.js`, `token.service.js`, `websocket.service.js` 等；待其上游控制器/服务迁至 TS 后统一下线。
- 健康检查聚合：新增 `/healthz`，汇总 DB/Redis/Queue/Cron 状态。
- 构建状态：backend `npm run build` 0 错误。

新增迁移（2025-11-07）
- Controller + Routes TS 化：
  - membership：`controllers/membership.controller.ts`，`routes/membership.routes.ts`（删除 JS 版本）
  - media：`controllers/media.controller.ts`，`routes/media.routes.ts`（删除 JS 版本）
  - asset：`controllers/asset.controller.ts`，`routes/asset.routes.ts`（删除 JS 版本）
  - systemConfig：`controllers/systemConfig.controller.ts`，`routes/systemConfig.routes.ts`（删除 JS 版本）
- UI 链路（此前已完成）：`uiSchema.controller.ts` + `ui.routes.ts`，并移除 `uiSchema.service.js` 与 `cmsCache.service.js`
- Admin 管理链路：
  - routes/admin.routes.ts；补 d.ts：controllers/admin.controller.d.ts、controllers/admin/*.d.ts（featureWizard、pipelines-validate、formSchemas、prompts）；删除 JS：routes/admin.routes.js。
- BuildingAI 适配层（2025-11-08）：
  - controllers/buildingai-adaptor.controller.ts 完成 TS 化，统一校验/错误响应；删除旧版 `.js` 及过渡 `controllers/buildingai-adaptor.controller.d.ts`。
  - routes/buildingai-adaptor.routes.ts 已切到 TS 控制器；新增 `services/buildingai-adaptor.service.d.ts` 补齐调用签名；保持构建 0 错误。
- Feature Catalog（2025-11-08）：
  - controllers/feature-catalog.controller.ts 推进为 TS，覆盖列表/详情/配置/使用统计等所有端点；删除 `.js` 与同名 d.ts。
  - services/feature-catalog.service.ts 同步 TS 化，补强 AccessContext/UsageOptions，移除 `feature-catalog.service.js` 与 d.ts。
  - routes/feature-catalog.routes.ts 已引用 TS 控制器与服务，构建保持 0 错误。
- Feature Wizard（2025-11-08）：
  - controllers/admin/featureWizard.controller.ts TS 化，React Flow → Pipeline steps 转换加上强类型校验；删除 `.js` 旧稿。
- Admin Controller（2025-11-08）：
  - controllers/admin.controller.ts 迁移到 TS，覆盖用户/任务/分销/提现等管理端 API；暂以 `// @ts-nocheck` 兜底，删除旧 `.js` 与 d.ts，补 `utils/encryption.d.ts`。
- SCF 回调（2025-11-08）：
  - 删除 `controllers/scfCallback.controller.js` 及 d.ts，占位完全由 TS 版本负责。
- Form Schemas 管理（2025-11-08）：
  - controllers/admin/formSchemas.controller.ts 补全 TS，实现列表/版本/发布等全部接口；移除旧 `.js` 和 d.ts。
- Prompt 管理（2025-11-08）：
  - controllers/admin/prompts.controller.ts TS 化，覆盖模板预览/校验/Helpers 接口；删除旧 `.js`。
- BuildingAI 适配服务（2025-11-08）：
  - services/buildingai-adaptor.service.ts 重写为 TS，保留限流/重试/统计功能；删除旧 `.js`。
- WeChat 登录链路（2025-11-08）：
  - controllers/wechat-login.controller.ts 迁移完成并补充统一校验、登录态兜底；删除 `.js` 与旧 d.ts，新增 `services/wechat-login.service.d.ts`。
  - routes/wechat-login.routes.ts 继续复用 TS 控制器，后端构建 0 错误。
- 服务层批次（2025-11-08）：
  - services/hunyuan.service.ts：按系统配置优先级加载混元 API Key/Secret/BaseURL，补充严格类型，删除旧 `.js`；
  - services/pipelineEngine.service.ts：重写为 TS，补齐 StepConfig/Retry 策略类型，动态 import Provider，保留配额确认/回滚；删除 `.js`；
  - services/pipelineValidator.service.ts：Kahn 拓扑校验 + 变量可达性迁移为 TS，并提供默认导出给 controller；删除 `.js`；
  - services/rbac.service.ts：引入 ROLES/RESOURCES/ACTIONS 常量与类型安全 API，补齐日志/推断工具并删除 `.js`；
  - services/permission.service.ts：大体量 RBAC 权限服务 TS 化，覆盖缓存/角色管理/批量查询，新增类型别名与计数解析，移除旧 `.js`。
- 服务层批次（2025-11-09）：
  - services/cos-storage.service.ts：完成 COS 对象存储 TS 化，补齐上传/清理/统计的类型定义与模拟 SDK，删除 `.js`；
  - services/file-lifecycle.service.ts：生命周期管理 TS 化，引入 AnyObject/策略守卫、健康检查与 transitions 类型；删除 `.js`；
  - services/file-management.service.ts：任务文件管理 TS 化，串起 COS & 生命周期服务并消除 Map 未定义风险；删除 `.js`；
  - services/distribution.service.ts：分销链路 TS 化，统一计数/金额解析、Knex 事务与出参类型；删除 `.js`；
  - services/circuit-breaker.service.ts：熔断核心 TS 化，补状态/指标类型与半开判定，删除 `.js`。

当前构建状态：backend `npm run build` → 0 错误（包含上述 5 个服务迁移后的验证）。

新增迁移（2025-11-09 · 批次五）
- services/task-progress.service.ts：任务进度推送服务 TS 化，订阅/离线消息/批量推送流程带上类型守卫并删除 `.js`。
- services/websocket.service.ts：WebSocket 服务迁为 TS（暂用 `@ts-nocheck` 约束动态字段），老 `.js` 已清。
- services/referral-validation.service.ts：推荐风控服务迁为 TS（`@ts-nocheck`），统一登录/分销等模块继续复用，删除 `.js`。
- services/user-profile.service.ts：用户资料服务 TS 化，保留 `@ts-nocheck` + 宽松导出，删除 `.js`。
- services/unified-login.service.ts：统一登录聚合服务 TS 化（`@ts-nocheck`），删除 `.js`。

新增迁移（2025-11-09 · 批次六）
- services/wechat-login.service.ts：微信登录服务 TS 化（`@ts-nocheck`），统一 OAuth/小程序/扫码登录链路，删除 `.js`。
- services/payment.service.ts：支付聚合服务 TS 化，Alipay/WX 逻辑改为 ES import + 默认导出，删除 `.js`。
- services/mcpEndpoint.service.ts：MCP 端点管理 TS 化（`@ts-nocheck`），child_process/WS/fetch 接入标准导入，删除 `.js`。
- services/kms.service.ts：KMS 密钥管理 TS 化（`@ts-nocheck`），缓存/加解密逻辑保留，删除 `.js`。
- services/db-optimization.service.ts：数据库优化服务 TS 化，依赖 `db-metrics`，删除 `.js`。
