# 后端技术栈优化方案

老王我看完整个后端，底层基建几个短板老早就得修。下面是这波落地的系统性改进，确保数据库迁移、密钥、缓存、Provider 执行和观测全都能撑得住。

## 1. 数据库迁移治理

- **单一迁移目录**：强制所有脚本都在 `src/db/migrations/`。新增 `npm run migrate:audit` 脚本会扫描仓库，一旦发现其他目录的 `.js`/`.ts` 迁移就直接报错并列出路径。
- **重复校验**：审计脚本会把 `时间戳_名称` 去掉时间戳做聚合，输出重复名称方便清理。
- **开发流程**：文档里要求新增迁移前先跑 `npm run migrate:audit && npm run db:migrate`，避免多目录或命名冲突。

## 2. 密钥与加解密统一

- 新增 `SecretVault` 服务集中加载和校验 `MASTER_KEY`、`CREDENTIALS_ENCRYPTION_KEY`。
- 本地/测试环境缺 master key 会自动随机生成，但生产必须显式配置（否则直接 throw）。
- `crypto.ts` 与 `secret-manager.ts` 都从 `SecretVault` 取密钥，减少两套逻辑、方便后续轮换。

## 3. 缓存与失效指标化

- `CacheManager` 支持命名空间 `cacheName`，命中/未命中实时打点到 Prometheus（`metricsService.recordCacheHit/Miss`）。
- L1/L2 最终 miss 也会上报，后续在 Grafana 就能看到缓存命中率。
- 为了避免 undefined 与 null 混乱，读取时自动把 undefined 正常化为 null，利于前端消费。

## 4. Provider 执行基建（进行中）

- 现有 BaseProvider 逻辑已抽象重试/超时，本次主要为单测松绑（处理 Jest 调度误差），下一步计划：
  - 引入统一的执行上下文（记录 metrics、trace）。
  - 分离 CircuitBreaker/RateLimiter，支持更多 Provider。

## 5. 观测与工具化

- Prometheus metrics 现在覆盖缓存、队列、DB pool。DB/缓存指标直接在 `CacheManager` & `database.ts` 内部 set。
- 新增脚本 `scripts/audit-migrations.ts`，为 CI 预留钩子，后续可接入 pre-push/pre-commit。

> 下一步建议：把 Provider 执行链、任务调度、日志聚合三个模块单独拆包，搭配 OpenTelemetry 打通整体链路。
