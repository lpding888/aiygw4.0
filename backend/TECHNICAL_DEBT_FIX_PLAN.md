# 技术债务修复计划

## 总览
发现16个文件包含TODO/FIXME/HACK标记，需要系统性修复。

## 修复分类

### 🔴 P0 - 关键功能缺失（需立即实现）

#### 1. ExecutionWatchdog - BullMQ停滞任务监控
- **文件**: `src/engine/watchdog/ExecutionWatchdog.ts:44`
- **问题**: 缺少BullMQ停滞任务监控
- **方案**: 实现`monitorStalledJobs()`方法，集成queue.service
- **预计工作量**: 30分钟

#### 2. KMS删除方法缺失
- **文件**: `src/services/mcp-endpoints.service.ts:250`
- **问题**: KMS服务缺少delete方法
- **方案**: 在kms.service.ts中实现deleteSecret方法
- **预计工作量**: 20分钟

#### 3. 错误通知服务集成 ✅
- **文件**: `src/middlewares/error-handler.ts:75`
- **问题**: Critical错误未集成通知服务
- **方案**: 创建notification.service.ts，支持邮件/Slack/钉钉；未配置Webhook时降级日志
- **预计工作量**: 1小时

### 🟡 P1 - 功能完善（中期实现）

#### 4. Prompt模板标签提取 ✅
- **文件**: `src/services/promptTemplate.service.ts:713`
- **问题**: getPopularTags方法返回空数组
- **方案**: 从已发布模板tags列聚合Top N标签
- **预计工作量**: 1.5小时

#### 5. Prompt模板评分存储 ✅
- **文件**: `src/services/promptTemplate.service.ts:722`
- **问题**: rateTemplate方法仅记录日志
- **方案**: 使用prompt_template_ratings表存储/更新评分，回填avg_rating/rating_count
- **预计工作量**: 1小时

#### 6. 短信服务集成 ✅
- **文件**: `src/services/auth.service.ts:188`, `src/services/unified-login.service.ts:426`
- **问题**: 生产环境未对接腾讯云短信
- **方案**: 使用tencentcloud-sdk-nodejs集成SMS，封装sms.service.ts；未配密钥降级日志
- **预计工作量**: 1小时

#### 7. Provider健康检查实现 ✅
- **文件**: `src/services/providerHealth.service.ts`
- **问题**: 健康检查逻辑空壳
- **方案**: 基于health_url/endpoint_url发起HTTP探活，5秒超时
- **预计工作量**: 30分钟

#### 8. 微信公众号回调签名/消息处理 ✅
- **文件**: `src/controllers/wechat-login.controller.ts`
- **问题**: 签名校验与消息处理缺失
- **方案**: 按官方token+timestamp+nonce校验sha1签名，验证失败返回403；消息记录并回执success
- **预计工作量**: 45分钟

#### 9. 会员套餐判定精细化 ✅
- **文件**: `src/services/feature.service.ts:232`
- **问题**: 仅判断isMember
- **方案**: 支持 free/member/admin 三档访问判定
- **预计工作量**: 20分钟

#### 10. 视频结果下载返回值落地 ✅
- **文件**: `src/services/videoPolling.service.ts:199`
- **问题**: COS下载逻辑缺失，返回模拟
- **方案**: 最简返回源视频地址及占位封面/缩略图，避免假数据
- **预计工作量**: 20分钟

#### 11. 腾讯云CI/SCF健康检查 ✅
- **文件**: `src/providers/handlers/tencentCi.handler.ts`, `src/providers/handlers/scf.handler.ts`
- **问题**: 健康检查空壳
- **方案**: 检查密钥配置，缺失则判定不健康；CI执行返回显式未集成错误
- **预计工作量**: 20分钟

#### 12. 配置快照回滚提示 ✅
- **文件**: `src/services/configSnapshot.service.ts:222,231`
- **问题**: 回滚公告/轮播图未实现
- **方案**: 显式抛出未启用错误，避免静默成功
- **预计工作量**: 10分钟

#### 13. 视频/CI/SCF 等剩余项 ✅
- **状态**: 已完成或显式标记不支持

#### 7. 推荐关系绑定
- **文件**: `src/services/auth.service.ts:227`
- **问题**: 推荐关系未真正绑定
- **方案**: 调用distribution.service.bindReferrer方法
- **预计工作量**: 30分钟

#### 8. Pipeline Worker节点状态颗粒度
- **文件**: `src/engine/worker/PipelineWorker.ts:69`
- **问题**: 节点状态未在Redis中细化存储
- **方案**: 实现exec:{runId}:nodes:{nodeId}状态键
- **预计工作量**: 45分钟

### 🟢 P2 - 安全和优化（长期改进）

#### 9. BullMQ监控面板安全
- **文件**: `src/app.ts:256`
- **问题**: 生产环境监控面板安全警告
- **方案**: 实现IP白名单中间件 + Basic Auth
- **预计工作量**: 30分钟

#### 10. 其他文件中的TODO
- `controllers/providers.controller.ts`
- `controllers/wechat-login.controller.ts`
- `providers/handlers/scf.handler.ts`
- `providers/handlers/tencentCi.handler.ts`
- `services/configSnapshot.service.ts`
- `services/feature.service.ts`
- `services/providerHealth.service.ts`
- `services/unified-login.service.ts`
- `services/videoPolling.service.ts`

需逐个审查并制定修复方案。

## 修复顺序

1. ✅ KMS删除方法（P0，依赖少）
2. ✅ BullMQ停滞任务监控（P0，依赖少）
3. ✅ 推荐关系绑定（P1，依赖少）
4. ✅ Pipeline节点状态（P1，架构改进）
5. ✅ BullMQ面板安全（P2，安全加固）
6. ⏳ 通知服务（P0，需新建服务）
7. ⏳ 短信服务（P1，需配置）
8. ⏳ 标签提取（P1，算法实现）
9. ⏳ 评分存储（P1，数据库迁移）
10. ⏳ 其他TODO审查

## 预计总工作量
- P0任务: 1.5小时
- P1任务: 5小时
- P2任务: 1小时
- 其他审查: 2小时
- **总计: 约9.5小时**

---

**开始时间**: 2025-12-08
**目标完成**: 本周内完成所有P0和P1任务
