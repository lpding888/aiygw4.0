# Repository Guidelines

## 项目结构
- `backend/`：TypeScript + Express API。业务分层在 `backend/src/{controllers,services,models,utils,config}`，数据库迁移在 `backend/migrations/`，测试在 `backend/tests/`。
- `frontend/`：Next.js 14 网页工作台。页面/路由在 `frontend/src/app/`，复用组件在 `frontend/src/components/`，测试在 `frontend/tests/` 与 `frontend/__tests__/`。
- `miniapp/`、`scf/`、`deploy/`、`docs/`、`skills/`：小程序/云函数/运维/规格与验收文档/角色流程手册，按 README 约定扩展。

## 构建、测试与开发命令
- Node 版本以 `.nvmrc` 为准（v20.11.0）。
- 后端：`cd backend && npm install`；本地开发 `npm run dev`；构建 `npm run build`（产物到 `backend/dist/`）。
- 前端：`cd frontend && npm install`；本地开发 `npm run dev`；构建/预览 `npm run build && npm start`。
- 全栈本地依赖可参考 `docker-compose.local.yml`。
 - 环境变量模板：后端 `backend/.env.dev.example`，前端 `frontend/.env.local.example`。

## 代码风格与命名
- 默认 2 空格缩进，单引号、行宽 100、末尾无多余逗号（见 `.prettierrc`）。
- TS/JS 统一走 ESLint + Prettier：后端 `npm run lint/format`，前端 `npm run lint`。
- 文件命名：后端使用 `kebab-case` 并带职责后缀（如 `account.controller.ts`）；前端组件用 `PascalCase.tsx`，Storybook 用 `*.stories.tsx`。

## 测试规范
- 后端 Jest：单测 `backend/tests/**/*.test.ts`，集成测试 `*.integration.test.ts`；运行 `npm run test:unit` / `npm run test:integration` / `npm run test:coverage`。
- 前端 Jest + Playwright：单测在 `frontend/tests/unit` 或 `__tests__`，E2E 在 `frontend/tests/e2e/**/*.spec.ts`；运行 `npm test` / `npm run test:e2e`。
- 新增/修复逻辑必须补齐对应测试，避免降低覆盖率。

## 提交与 Pull Request
- 使用 Conventional Commits：`feat|fix|chore|style(scope): 简短说明`，scope 常用 `backend`、`frontend`（例：`fix(backend): 修复配额回滚`）。
- 从 `develop` 拉 `feature/*` 或 `fix/*` 分支；禁止直接推送 `main`。
- PR 需说明动机/影响范围、关联 Issue/任务卡；UI 变更附截图；通过 lint 与相关测试后再请求评审。

## 文档与角色流程
- 需求规格、API 约定、验收与历史交付在 `docs/`；开发前先对齐对应文档与任务卡。
- 角色化协作或 AI 辅助开发时，参考 `skills/*/FLOW.md` 与 `CHECKLIST.md` 做过程自检。

## 安全与配置
- 不要提交真实密钥、token 或生产配置；新增环境变量先补到 `.env*.example` 并在 PR 中说明用途。
