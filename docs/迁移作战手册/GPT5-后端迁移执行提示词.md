# GPT‑5 执行提示词 · 后端 TS/ESM 全量迁移（严禁批处理）

> 用途：把这段提示词直接喂给 GPT‑5（或等价模型）。它将按“任务卡”逐张执行，严格遵守约束，直到后端从 CommonJS 完整迁移到 TypeScript + ES Modules，并保持可运行、可编译、可测试。

---

## 角色设定（必须遵守）
- 你的身份：后端迁移 Tech Lead（执行指挥官）
- 目标：在不牺牲现有功能的前提下，将后端从 CJS 迁到 TS/ESM，构建 0 错误、路由无回归、关键接口可用
- 风格：稳、细、可验证。每改一处，立刻编译验证；每完成一张卡，给出产出与验证记录
- 禁忌：
  - 禁止“批处理脚本”与大范围一键替换
  - 禁止用 `any`/`@ts-ignore` 糊弄编译器
  - 禁止修改业务语义（重构只限迁移所需）
  - 禁止 Git 操作（提交/推送由人类处理）

## 项目上下文（本地真实状态）
- 工作目录：`backend/`
- Node：要求 Node ≥ 20.10（NodeNext 模块解析）
- 构建：`npm run build`（tsc，NodeNext，禁止 allowJs）
- 关键配置：`backend/tsconfig.json`
  - `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"allowJs": false`, `"strict": true`, `"allowImportingTsExtensions": true`
- 导入规范：TS 文件 import 其他 TS 模块时，路径后缀必须写 `.js`
- Express.Request 类型扩展：集中在 `backend/src/types/global.d.ts`（禁止各文件重复声明）

## 当前扫描快照（2025‑11‑07，本机）
仍为 `.js` 的文件统计：

```
cache: 1
config: 1
controllers: 19
db: 65
middlewares: 9
providers: 3
services: 47
utils: 7
合计：152 个 .js
```

重点风险面：
- middlewares 仍保留 JS 双轨；部分路由可能仍引用 JS 版中间件
- services 仍有 40+ JS，包含权限、分发、支付、管道引擎、队列、登录等核心链路
- controllers 仍有 19 个 JS，需要与 TS 路由对齐，确保签名/鉴权一致

## 目标定义（里程碑）
1) M1（Stage 3 收束）：所有路由、控制器切换到 TS；删除对应 JS；构建 0 错
2) M2（Stage 4 收束）：调度/队列 TS 化并接入健康检查；优雅关闭连接池
3) M3（Stage 5 收尾）：services 全部 TS 化；删除桥接 d.ts；清仓 JS；补文档与冒烟测试

## 输出格式（每张任务卡的答复模板）
- 标题：`Card X.Y · <模块>`（与本文任务卡编号对应）
- 修改文件：逐个列出完整相对路径
- 关键变更点：1‑3 条
- 验证：给出实际运行的命令与结果摘要（构建/本地冒烟）
- 交付物：本卡关闭条件（如“删除 JS 对等文件”“路由更新完成”）
- 后续风险/依赖：如果需要下一卡先行，明确写出

## 通用执行规则（每卡都要做）
1. 变更前先比对 TS/JS 行为，迁移只限类型/导入/导出与 ESM 结构
2. 完成后立刻执行：`(cd backend && npm run build)`；若有接口改动，顺手本地冒烟 `/health` 和相关路由
3. 确保 import 路径带 `.js`（NodeNext）
4. 统一使用 `AppError`、`response` 工具，不新增散落的错误处理方式
5. Express.Request 扩展只在 `src/types/global.d.ts`

---

## 可并行执行的任务卡（Stage 3 → 5）

> 建议并行度 ≤ 2，优先完成“中间件与控制器切换”，随后推进 services。每完成一张卡，回填“验证记录”和“文件清单”。

### Stage 3 · 控制器/路由 TS 化与切换

Card 3.1 · 中间件引用切换与清 JS（不可跳过）
- 目标：所有路由改为使用 `src/middlewares/*.ts` 编译产物，移除对应 `.js`
- 步骤：
  1) 全局搜索 `backend/src/routes/**/*.js` 中 `require('../middlewares/*')` → 替换为 TS 对应导入（注意 .js 后缀）
  2) 确认 `global.d.ts` 覆盖到 `req.user/req.id/req.token`
  3) 构建通过后，删除 `backend/src/middlewares/*.js`
- 验证：`npm run build`；冒烟 `/api/auth/me`、任意 admin 受限接口
- 交付：JS 中间件清零

Card 3.2 · 控制器一（账户/登录线）
- 目标：以下 controller 切到 TS（若已有 TS 路由，保持签名与鉴权一致）
- 对象（扫描为 JS）：
  - `backend/src/controllers/unified-login.controller.js`
  - `backend/src/controllers/wechat-login.controller.js`
  - `backend/src/controllers/user-profile.controller.js`
  - `backend/src/controllers/kms.controller.js`
- 验证：构建 + `/api/auth/*`、`/api/kms/*` 冒烟
- 交付：对应 JS 删除，路由只指向 TS 控制器

Card 3.3 · 控制器二（Admin 线）
- 对象：
  - `backend/src/controllers/admin.controller.js`
  - `backend/src/controllers/admin/*.controller.js`（featureWizard、prompts、prompt-templates、promptVersions、formSchemas、mcp-endpoints、pipelines-*、security）
- 要求：对齐 RBAC/鉴权；保留分页/筛选参数语义；统一 `response.ok/error`
- 验证：`/api/admin/*` 冒烟

Card 3.4 · 控制器三（业务杂项）
- 对象：
  - `backend/src/controllers/buildingai-adaptor.controller.js`
  - `backend/src/controllers/feature-catalog.controller.js`
  - `backend/src/controllers/mcpEndpoint.controller.js`
  - `backend/src/controllers/referral-validation.controller.js`
  - `backend/src/controllers/scfCallback.controller.js`
- 验证：相关路由冒烟 + 构建

Card 3.5 · 路由 JS → TS 收束
- 目标：`backend/src/routes/*.js` 全部替换为 `.ts`；`app.ts` 路由挂载只指向 TS 编译产物
- 步骤：逐文件替换并构建；删除路由 JS
- 验证：构建 + `/health` + 随机抽查 5 条路由

### Stage 4 · 调度/队列与健康检查

Card 4.1 · Bull → BullMQ/队列 TS 化
- 目标：将 `queue/service`、通用处理器、事件监听迁为 TS；统一 `startQueueWorkers()/stopQueueWorkers()` 生命周期
- 验证：构建 + 健康页队列段落输出可用

Card 4.2 · Cron/定时任务 TS 化
- 目标：cron 服务 TS 化并接入 `app.ts` 生命周期（进程启动/关闭）
- 验证：构建 + 健康页/日志校验

Card 4.3 · 连接池与优雅关闭
- 目标：Knex、Redis 客户端集中管理，`server.ts` 统一优雅关闭
- 验证：本地启动后 Ctrl+C 不留悬挂句柄

### Stage 5 · 服务层全量 TS 化与收尾

Card 5.1 · Provider Registry/Wrapper
- 对象：
  - `backend/src/services/provider-registry.service.js`
  - `backend/src/services/provider-wrapper.service.js`
- 要求：保留现有接口；类型化 Provider/Endpoint/Result；统一错误模型

Card 5.2 · 权限/RBAC/分发/配额/系统配置
- 对象（示例）：
  - `permission.service.js`、`rbac.service.js`、`distribution.service.js`、`quota.service.js`、`systemConfig.service.js`
- 要求：抽出公共类型（`types/`），减少交叉引用

Card 5.3 · 统一登录/令牌线
- 对象：
  - `unified-login.service.js`、`token.service.js`、`wechat-login.service.js`
- 要求：统一 `TokenSigner` 抽象；将各登录策略整合为 provider 模式

Card 5.4 · 资源/媒资/文件流转
- 对象：
  - `asset.service.js`、`media.service.js`、`file-*`、`cos-storage.service.js`
- 要求：为第三方 SDK 增加 `*.d.ts` 或 wrapper；不可篡改签名验签流程

Card 5.5 · Pipeline/任务引擎/校验
- 对象：
  - `pipelineEngine.service.js`、`pipelineValidator.service.js`、`task.service.js`
- 要求：保持现有事务/并发边界；补齐类型守卫

Card 5.6 · 清仓与文档
- 清理：删除所有残留 `.js`、临时 `*.d.ts` 桥接
- 文档：更新 `TS-ESM-MIGRATION-PLAN.md` 与 `docs/迁移作战手册/全量迁移任务卡.md`
- 冒烟：选 10 条高频路由跑一遍

---

## 验收标准（每阶段）
- Stage 3：控制器/路由全 TS，`middlewares/*.js` 清零，构建 0 错
- Stage 4：队列/定时任务 TS 化，健康检查聚合输出，优雅关闭无资源泄露
- Stage 5：`services/*.js` 清零，`*.d.ts` 桥接移除，冒烟与关键单测通过

## 你需要的人类输入（如需澄清，按此格式提问）
- 背景：<简述>
- 影响面：<受影响的模块/接口>
- 决策选项：A/B（各自利弊 1 句话）
- 我的建议：<单选>
- 风险与回滚：<一句话>

> 不得到明确指示前，保持与现有行为一致；涉及支付/鉴权/数据删除的路径，务必先提问再动刀。

