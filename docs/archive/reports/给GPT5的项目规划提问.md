# AI衣柜项目 - 前端完整规划需求文档

## 一、项目背景

我们是一个AI SaaS平台（AI衣柜），使用AI编程助手（Claude Code）进行开发。

**技术栈**：
- 后端：Node.js + Express + TypeScript + MySQL + Redis + Bull队列
- 前端：Next.js 14 + React 18 + TypeScript + Ant Design 5 + Zustand

**当前进度**：
- 后端已完成，质量评分：**87/100 - A级（优秀项目）**
- 前端部分完成，质量评分：**62/100 - C级（初级项目）**
- 差距：**25分，落后2个等级**

---

## 二、后端现状（87分 - A级）✅

### 2.1 已实现功能（功能完整性：95/100）

#### 核心业务模块
1. **统一AI推理API（BE-API-001）**
   - Chat Completions接口（OpenAI兼容格式）
   - 支持流式/非流式响应
   - 支持Tool Calling（函数调用）
   - Provider负载均衡和故障转移
   - 支持OpenAI、Anthropic、BuildingAI三种Provider

2. **知识库管理系统（BE-RAG-003）**
   - 文档上传（支持text/markdown格式）
   - 文档分块（Chunking）和向量化（Embedding）
   - 向量检索（Cosine相似度）
   - Bull队列异步处理（ingestion队列）
   - 队列状态监控

3. **COS直传系统（BE-COS-001）**
   - STS临时密钥生成
   - 支持上传/下载/全部权限
   - 自定义权限策略
   - 多bucket支持

4. **CMS内容管理系统**
   - **Provider Catalog（BE-CMS-001）**：AI Provider管理，支持增删改查
   - **Secret管理（BE-CMS-002）**：加密存储敏感配置
   - **功能管理（BE-CMS-004）**：动态功能开关和配置
   - **RBAC权限系统（BE-CMS-005）**：基于角色的访问控制
   - **UI Schema管理（BE-CMS-006）**：前端组件配置
   - **Prompt模板中心（BE-CMS-008）**：模板版本管理和变量替换

5. **缓存系统（BE-CACHE-001）**
   - 4层缓存架构：LRU Cache → Redis → Snapshot文件 → 数据库
   - 支持TTL随机化（避免缓存雪崩）
   - Redis Pub/Sub缓存失效通知
   - 自动降级和故障恢复

#### 基础设施
- ✅ 数据库迁移（Knex migrations）
- ✅ 认证中间件（JWT）
- ✅ 错误处理中间件
- ✅ 请求日志（Morgan）
- ✅ 环境配置（dotenv）

### 2.2 后端问题（虽然87分，但仍有改进空间）

#### 🟡 需要改进的地方（-13分的原因）
1. **测试覆盖不足（70/100）**：
   - 现有：6个测试文件（3个单元测试 + 2个集成测试 + 1个API测试脚本）
   - 问题：集成测试不够全面，缺少E2E测试
   - 目标：测试覆盖率达到80%+

2. **文档可以更完善（82/100）**：
   - 已有：API文档、部署指南、开发指南
   - 缺少：架构设计文档、故障排查手册、性能优化指南

3. **监控需要加强（85/100）**：
   - 缺少：APM性能监控、分布式追踪、业务指标监控
   - 建议：接入Prometheus + Grafana

4. **安全可以提升（88/100）**：
   - 缺少：API限流（虽然设计了但未实现）、SQL注入防护测试
   - 建议：增加安全扫描工具

### 2.3 后端API清单（供前端调用）

#### 认证相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息

#### AI推理
- `POST /api/ai/chat` - Chat Completions（流式/非流式）
- `GET /api/ai/models` - 获取可用模型列表

#### 知识库管理
- `POST /api/admin/kb/documents` - 上传文档
- `GET /api/admin/kb/documents` - 获取文档列表（分页、筛选）
- `POST /api/admin/kb/query` - 检索文档
- `GET /api/admin/kb/queue-stats` - 获取ingestion队列统计
- `DELETE /api/admin/kb/documents/:id` - 删除文档

#### 文件上传
- `POST /api/admin/uploads/sts` - 获取COS STS临时密钥
- `POST /api/admin/uploads/callback` - 上传完成回调

#### Provider管理
- `GET /api/admin/providers` - 获取Provider列表
- `POST /api/admin/providers` - 创建Provider
- `PUT /api/admin/providers/:ref` - 更新Provider
- `DELETE /api/admin/providers/:ref` - 删除Provider
- `POST /api/admin/providers/:ref/test` - 测试Provider连接

#### 功能管理
- `GET /api/admin/features` - 获取功能列表
- `POST /api/admin/features` - 创建功能
- `PUT /api/admin/features/:id` - 更新功能
- `DELETE /api/admin/features/:id` - 删除功能
- `POST /api/admin/features/:id/toggle` - 切换功能状态

#### Prompt模板
- `GET /api/admin/prompts` - 获取模板列表
- `POST /api/admin/prompts` - 创建模板
- `PUT /api/admin/prompts/:id` - 更新模板
- `GET /api/admin/prompts/:id/versions` - 获取模板版本历史
- `POST /api/admin/prompts/:id/render` - 渲染模板（变量替换）

#### 用户管理
- `GET /api/admin/users` - 获取用户列表
- `PUT /api/admin/users/:id` - 更新用户信息
- `PUT /api/admin/users/:id/roles` - 更新用户角色

#### 配置管理
- `GET /api/admin/configs` - 获取配置列表
- `PUT /api/admin/configs/:key` - 更新配置

---

## 三、前端现状（62分 - C级）⚠️

### 3.1 已实现功能（功能完整性：75/100）

#### 已有页面（按目录结构）
```
app/
├── admin/                          # 管理后台
│   ├── distribution/               # 分销管理
│   │   ├── settings/page.tsx      # 分销设置
│   │   └── stats/page.tsx         # 分销统计
│   ├── distributors/              # 分销商管理
│   │   ├── page.tsx               # 分销商列表
│   │   └── [id]/page.tsx          # 分销商详情
│   ├── features/                  # 功能管理
│   │   ├── page.tsx               # 功能列表
│   │   ├── new/page.tsx           # 创建功能
│   │   └── [featureId]/edit/page.tsx  # 编辑功能
│   ├── forms/                     # 表单管理
│   │   └── builder/page.tsx       # 表单构建器
│   ├── pipelines/                 # Pipeline管理
│   │   ├── editor/page.tsx        # Pipeline编辑器
│   │   └── [id]/test/page.tsx     # Pipeline测试
│   ├── prompts/                   # Prompt管理
│   │   └── test/page.tsx          # Prompt测试器
│   ├── providers/page.tsx         # Provider管理
│   ├── template-tester/page.tsx   # 模板测试器
│   ├── withdrawals/page.tsx       # 提现管理
│   └── layout.tsx                 # 管理后台布局
├── distribution/                   # 分销商端
│   ├── apply/page.tsx             # 申请成为分销商
│   ├── commissions/page.tsx       # 佣金明细
│   ├── dashboard/page.tsx         # 分销商仪表盘
│   └── referrals/page.tsx         # 推荐记录
├── library/                        # 资源库（推测）
├── login/                          # 登录页
├── membership/                     # 会员管理
├── task/                           # 任务管理
└── workspace/                      # 工作台
```

#### 已有组件（75个tsx组件）
- **基础组件**：ErrorBoundary, Navigation, DataTable, MonacoEditor
- **表单组件**：TextField, NumberField, DateField, EnumField, ImageUploadField, MultiImageUploadField
- **业务组件**：FeatureCard, AssetCard, VideoPlayer, ImageUploader, JSONEditor
- **分销组件**：DistributorCard, ReferralCard, StatCard, CommissionCard, WithdrawalCard, StatusBadge
- **流程组件**：NodeInspector, NodeConfigDrawer, ValidationPanel, VarPicker, ForkNode, JoinNode
- **表单系统**：FormBuilder（Formio集成）, FormRenderer, UfsRenderer
- **管理后台**：FeatureWizard（BasicInfoStep, FormDesignStep, PipelineEditorStep, PreviewPublishStep）

#### 已有功能特性
- ✅ 状态管理：Zustand + slice模式（auth, ui, workbench）
- ✅ 路由保护：middleware.ts处理认证
- ✅ 表单系统：Formio → UFS适配器（已有测试）
- ✅ 路径别名：@/* 映射
- ✅ TypeScript严格模式

### 3.2 前端核心问题（-38分的原因）

#### 🔴 P0 - 致命问题（必须立即解决）

1. **测试覆盖率灾难级（10/100）** ⚠️⚠️⚠️
   - 现状：仅3个测试文件
     - `__tests__/formio-adapter.test.ts`（570行，21个测试用例）
     - `__tests__/ufs-renderer.test.tsx`
     - `tests/unit/ImageUploader.test.jsx`
   - 问题：**75个组件，0个组件测试！测试覆盖率约2.4%**
   - 对比后端：后端70分，前端10分，差距60分！
   - 影响：线上bug风险极高，重构困难

2. **缺少错误监控（0/100）** ⚠️⚠️
   - 现状：没有Sentry或其他错误监控
   - 问题：线上错误无法及时发现和定位
   - 虽然有ErrorBoundary组件，但没有全局应用，也没有上报

3. **性能监控缺失（0/100）** ⚠️⚠️
   - 现状：没有Web Vitals、首屏时间等监控
   - 问题：性能问题无法量化和优化
   - Next.js支持性能监控，但未配置

#### 🟡 P1 - 重要问题（本月内解决）

4. **文档完全缺失**
   - 缺少：前端开发指南、组件文档、API调用文档、路由说明
   - 影响：新人上手困难，维护成本高
   - 对比后端：后端有完整的API文档、部署指南、开发指南

5. **代码规范不统一（55/100）**
   - 问题：
     - 没有Prettier配置，代码格式不统一
     - ESLint规则不够严格，允许any类型（367处使用）
     - 没有commit规范
   - 影响：代码可读性差，维护困难

6. **组件复用度低**
   - 问题：很多相似组件没有抽象
     - Card类组件：FeatureCard, AssetCard, DistributorCard, ReferralCard, StatCard, CommissionCard, WithdrawalCard
     - 都是独立实现，没有BaseCard
   - DataTable组件过于简单（只是Ant Design Table的壳子）
   - 影响：代码冗余，维护成本高

7. **安全措施不足（50/100）**
   - 缺少：
     - XSS防护（没有DOMPurify）
     - CSP配置
     - CSRF保护
     - 依赖漏洞扫描（npm audit）
   - 影响：存在安全风险

#### 🟢 P2 - 次要问题（后续优化）

8. **性能优化不足（60/100）**
   - 缺少：
     - SSR/SSG（全部是客户端渲染，'use client'）
     - 图片优化（没有使用next/image）
     - Lazy Loading（组件没有使用React.lazy）
   - 影响：首屏加载慢，性能不佳

9. **缺少组件文档（Storybook）**
   - 问题：组件没有可视化文档
   - 影响：组件使用困难，设计师无法预览

### 3.3 功能缺失分析（需要GPT-5帮忙分析）

#### 已知缺失的页面（对比后端API）
1. **知识库管理页面** ❌
   - 后端有完整的KB API（上传、列表、检索、队列统计）
   - 前端完全没有对应页面

2. **Provider管理页面** ❓
   - 后端有Provider CRUD API
   - 前端有`admin/providers/page.tsx`，但不确定功能是否完整

3. **Prompt模板管理** ❓
   - 后端有完整的Prompt API（CRUD、版本、渲染）
   - 前端只有`admin/prompts/test/page.tsx`（测试器），缺少列表和编辑页面

4. **用户管理页面** ❌
   - 后端有用户管理API
   - 前端没有对应页面

5. **配置管理页面** ❌
   - 后端有配置管理API
   - 前端没有对应页面

6. **AI聊天页面** ❌
   - 后端有Chat API
   - 前端没有对应的聊天界面（这应该是核心功能！）

#### 需要GPT-5帮忙确认的问题 ❓
- 前端的workspace/、library/、task/、membership/等目录对应什么功能？
- 这些页面有没有对应的后端API？
- 分销系统（distribution）的功能是否完整？
- 功能管理（features）是否对应后端的功能管理API？

---

## 四、需要GPT-5帮忙规划的内容

### 4.1 页面完整性分析
请分析：
1. **当前前端页面与后端API的匹配度**
   - 哪些后端API有对应的前端页面？
   - 哪些后端API缺少前端页面？
   - 哪些前端页面可能没有对应的后端API？

2. **核心用户流程完整性**
   - 用户注册 → 登录 → 使用AI功能（聊天/知识库） → 管理后台
   - 管理员：Provider管理 → Prompt管理 → 功能配置 → 用户管理
   - 分销商：申请 → 推广 → 佣金 → 提现
   - 这些流程是否完整？缺少哪些页面？

3. **优先级评估**
   - 哪些页面是P0（核心功能，必须有）？
   - 哪些页面是P1（重要功能，应该有）？
   - 哪些页面是P2（次要功能，可以后做）？

### 4.2 页面规划清单
请给出：
1. **需要新增的页面列表**（按优先级排序）
   - 页面名称、路由、功能描述、对应的后端API
   - 优先级（P0/P1/P2）
   - 依赖关系（需要先完成哪些页面）

2. **需要优化的现有页面**
   - 页面名称、当前问题、优化建议

3. **需要补充的组件**
   - 组件名称、用途、优先级

### 4.3 质量提升任务规划
请给出：

#### 测试任务
1. **组件单元测试**（目标：50%覆盖率）
   - 哪些组件最需要测试？（按优先级排序）
   - 每个组件需要测试哪些场景？
   - 预计工作量（小时）

2. **页面集成测试**
   - 哪些页面需要集成测试？
   - 测试哪些用户流程？

3. **E2E测试**（Playwright）
   - 哪些关键流程需要E2E测试？
   - 测试场景列表

#### 监控任务
1. **错误监控**
   - Sentry接入步骤
   - ErrorBoundary全局配置
   - 需要监控的错误类型

2. **性能监控**
   - Web Vitals埋点
   - 需要监控的性能指标

#### 文档任务
1. **前端开发指南**
   - 需要包含哪些内容？
   - 参考后端的开发指南

2. **组件文档**
   - 哪些组件需要文档？
   - 使用Storybook还是markdown？

3. **API调用文档**
   - 前端如何调用后端API
   - axios拦截器配置

#### 代码规范任务
1. **Prettier配置**
2. **ESLint规则增强**
3. **Git commit规范**

### 4.4 输出格式要求

#### 任务卡（Markdown表格）
请按以下格式输出任务清单：

| 任务ID | 任务类型 | 任务名称 | 详细描述 | 优先级 | 预计工时 | 前置任务 | 验收标准 | 涉及文件 |
|--------|---------|---------|---------|--------|---------|---------|---------|---------|
| TASK-001 | 页面开发 | 知识库管理页面 | 实现文档上传、列表、检索功能 | P0 | 8h | - | 能完成文档CRUD | app/admin/kb/page.tsx |
| TASK-002 | 组件测试 | FeatureCard单元测试 | 测试props、点击、样式 | P0 | 2h | - | 测试覆盖率>80% | __tests__/FeatureCard.test.tsx |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

#### 分组要求
- **P0任务**：必须完成（1周内）
- **P1任务**：重要任务（1个月内）
- **P2任务**：优化任务（后续）

分别按以下类型分组：
- 页面开发
- 组件开发
- 组件测试
- 页面测试
- 监控接入
- 文档编写
- 代码规范

#### 时间线/Gantt图
- 哪些任务可以并行？
- 哪些任务有依赖关系？
- 建议的执行顺序？

#### 工作量汇总
- P0总工时
- P1总工时
- P2总工时
- 总计工时

---

## 五、约束条件

### 5.1 技术约束
- 前端框架：Next.js 14（不能更换）
- 组件库：Ant Design 5（已使用，保持一致）
- 状态管理：Zustand（已使用，保持一致）
- 测试框架：Jest + Playwright（已配置）

### 5.2 时间约束
- P0任务：希望1周内完成
- P1任务：希望1个月内完成
- P2任务：后续优化

### 5.3 AI编程约束
- 所有任务都是给Claude Code执行的
- 不需要人力资源配置
- 任务描述需要足够详细，让AI能理解
- 验收标准要明确，便于AI自检

---

## 六、期望输出（重要！）

请提供以下内容：

### 1. 功能分析报告
- 前端页面与后端API的匹配度分析
- 缺失页面清单（按优先级）
- 用户流程完整性评估

### 2. 完整任务卡（Markdown表格）
- 按优先级（P0/P1/P2）和类型分组
- 包含：任务ID、名称、描述、工时、验收标准、依赖项

### 3. 执行计划
- 任务执行顺序建议
- 并行任务标注
- 关键路径分析

### 4. 工作量评估
- P0/P1/P2分别需要多少工时
- 总工时预估
- 完成时间预估

### 5. 风险评估
- 可能遇到的技术难点
- 任务依赖风险
- 建议的规避措施

---

## 七、参考资料

### 后端文档（可参考）
- `backend/docs/API文档.md` - 完整的后端API说明
- `backend/docs/开发指南.md` - 后端开发规范
- `backend/docs/生产环境部署指南.md` - 部署说明

### 前端评估报告
- `frontend/前端质量评估报告.md` - 详细的问题分析

### 后端评估报告（摘要）
- 总分：87/100
- 功能完整性：95/100
- 代码质量：88/100
- 测试覆盖：70/100

### 前端评估报告（摘要）
- 总分：62/100
- 功能完整性：75/100
- 代码质量：55/100
- 测试覆盖：10/100 ⚠️

---

## 八、特别说明

1. **我们使用AI编程**：所有任务都是给Claude Code执行的，不需要人力
2. **任务优先级**：优先解决致命问题（测试、监控），再补充功能页面
3. **质量目标**：将前端从62分C级提升到80分B级（接近后端质量）
4. **时间目标**：P0+P1任务希望在1个月内完成

---

**请基于以上信息，给出完整的项目规划和任务卡清单！**
