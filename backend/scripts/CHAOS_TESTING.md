# 混沌工程测试文档

## 📋 概述

本文档介绍 AI 衣柜平台 Pipeline 执行引擎的混沌工程测试套件，用于验证系统在极端情况下的健壮性和恢复能力。

## 🎯 测试目标

验证系统在以下极端场景下的表现：

1. **环形依赖检测** - 确保拓扑排序能正确识别各种环形依赖
2. **Worker 崩溃恢复** - 验证 BullMQ 的重试机制和状态恢复
3. **Redis 连接故障** - 测试 Redis 断开时的重连和数据持久性
4. **并发竞态条件** - 验证 CAS 机制在并发场景下的原子性
5. **资源耗尽场景** - 测试大规模 DAG 和超时处理
6. **数据流异常** - 验证数据绑定异常时的错误处理

## 📂 测试文件

```
backend/scripts/
├── chaos-engineering.ts      # 主测试套件（环形依赖、Redis、并发等）
├── chaos-worker-crash.ts     # Worker 崩溃专项测试
└── CHAOS_TESTING.md          # 本文档
```

## 🚀 快速开始

### 前置条件

1. **Redis 运行中**
   ```bash
   # 检查 Redis 是否运行
   redis-cli ping
   # 应该返回 PONG
   ```

2. **后端服务运行中**
   ```bash
   cd backend
   npm run dev
   # 服务应该在 http://localhost:4000 运行
   ```

3. **管理员账户存在**
   - Email: `admin@aiygw.com`
   - Password: `admin123`

   如果没有，请先创建管理员账户。

### 运行测试

#### 方式 1: 运行完整测试套件

```bash
# 在 backend 目录下
npm run chaos:full
```

这会依次运行：
1. 基础混沌测试（环形依赖、Redis、并发等）
2. Worker 崩溃测试

#### 方式 2: 分别运行测试

```bash
# 1. 运行基础混沌测试
npm run chaos:all

# 2. 运行 Worker 崩溃测试
npm run chaos:worker

# 3. 运行 Happy Path 验证（快速检查）
npm run verify:happy-path
```

#### 方式 3: 直接运行脚本

```bash
# 使用 tsx 直接运行
tsx scripts/chaos-engineering.ts
tsx scripts/chaos-worker-crash.ts
```

## 📊 测试详情

### 1. 基础混沌测试 (`chaos-engineering.ts`)

#### Test Suite 1: 环形依赖检测

| 测试用例 | 描述 | 验证点 |
|---------|------|--------|
| 简单环 (A→B→A) | 两个节点互相依赖 | TopologySorter 抛出 CYCLE_DETECTED 错误 |
| 复杂环 (A→B→C→D→B) | 多节点环形依赖 | 正确识别环中的所有节点 |
| 自环 (A→A) | 节点依赖自己 | 检测到自环依赖 |
| 孤立节点 | 节点与图断开连接 | 抛出 ISOLATE_NODE 错误 |

#### Test Suite 2: Redis 连接故障

| 测试用例 | 描述 | 验证点 |
|---------|------|--------|
| 连接断开 - 状态持久性 | 模拟 Redis 连接断开后重连 | 数据在断开后仍然保持 |
| 连接超时处理 | 连接到不存在的 Redis 实例 | 正确处理连接错误 |

#### Test Suite 3: 并发竞态条件

| 测试用例 | 描述 | 验证点 |
|---------|------|--------|
| CAS 机制 - 并发状态修改 | 两个 Worker 同时修改状态 | 只有一个操作成功（原子性） |
| 多个执行同时写入节点输出 | 10 个节点并发写入 | 所有输出正确保存，无数据丢失 |

#### Test Suite 4: 资源耗尽场景

| 测试用例 | 描述 | 验证点 |
|---------|------|--------|
| 大规模 DAG - 100 节点线性链 | 100 个串行节点 | 拓扑排序生成 100 个批次 |
| 大规模 DAG - 并行扇出 | 1 个根节点 → 50 个并行节点 | 正确识别 2 个批次（串行+并行） |

#### Test Suite 5: 数据流异常

| 测试用例 | 描述 | 验证点 |
|---------|------|--------|
| 缺失上游数据 | 尝试获取不存在的节点输出 | 返回 null 而不是崩溃 |
| 无效的 Binding 引用 | Binding 引用不存在的节点 | 协议验证通过，运行时检测 |

#### Test Suite 6: Protocol 验证

| 测试用例 | 描述 | 验证点 |
|---------|------|--------|
| 拒绝无效版本 | version='2.0' | 抛出 Protocol Violation 错误 |
| 拒绝未知节点类型 | type='unknown_type' | 抛出验证错误 |
| 移除未知字段 | 注入恶意字段 | Zod strict 模式移除未知字段 |

### 2. Worker 崩溃测试 (`chaos-worker-crash.ts`)

#### 测试场景

| 测试用例 | 描述 | 验证点 |
|---------|------|--------|
| Worker 崩溃和恢复 | Worker 在执行中崩溃 | • BullMQ 自动重试<br>• 新 Worker 接管任务<br>• 状态一致性 |
| 多次 Worker 崩溃 | 耗尽重试次数 | • 重试限制生效<br>• Job 进入 failed 状态 |
| Stalled Job 恢复 | Worker 持有锁但不响应 | • BullMQ 检测 stalled 状态<br>• 重新分配任务 |

## 📈 测试输出示例

### 成功输出

```
🧪 Running: 环形依赖 - 简单环 (A→B→A)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✓ 成功检测到环形依赖
✅ PASSED (125ms)

...

════════════════════════════════════════════════════════════
📊 TEST SUMMARY
════════════════════════════════════════════════════════════

Total Tests: 18
✅ Passed: 18
❌ Failed: 0
⏱️  Total Duration: 15432ms

✅ 环形依赖 - 简单环 (A→B→A) (125ms)
✅ 环形依赖 - 复杂环 (A→B→C→B) (89ms)
...

🎉 所有混沌工程测试通过！系统具有足够的健壮性。
```

### 失败输出

```
🧪 Running: CAS 机制 - 并发状态修改
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ FAILED (234ms): 预期只有 1 个操作成功，但有 2 个成功
```

## 🔧 故障排查

### 常见问题

#### 1. Redis 连接失败

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**解决方案：**
```bash
# 检查 Redis 是否运行
redis-cli ping

# 如果没有运行，启动 Redis
redis-server
```

#### 2. 登录失败

```
Error: Login failed
```

**解决方案：**
- 确保后端服务运行在 `http://localhost:4000`
- 验证管理员账户存在（email: `admin@aiygw.com`）
- 检查数据库迁移是否完成：`npm run db:migrate`

#### 3. Worker 测试超时

```
Test timeout after 30000ms
```

**解决方案：**
- 检查 BullMQ Worker 是否正常运行
- 验证 Redis 连接稳定
- 增加测试超时时间

#### 4. 端口冲突

```
Error: listen EADDRINUSE: address already in use :::4000
```

**解决方案：**
```bash
# 找到占用端口的进程
lsof -i :4000

# 终止进程
kill -9 <PID>
```

## 🎓 测试原理

### 1. 拓扑排序和环检测

使用 Kahn 算法的变体：
- 计算所有节点的入度
- 从入度为 0 的节点开始
- 如果无法访问所有节点 → 存在环或孤立节点

### 2. BullMQ 重试机制

```typescript
{
  attempts: 3,          // 最多重试 3 次
  backoff: {
    type: 'exponential',
    delay: 1000          // 指数退避，初始延迟 1 秒
  }
}
```

### 3. CAS (Compare-And-Swap) 状态管理

使用 Redis Lua 脚本保证原子性：
```lua
-- 只有当前状态 == 期望状态时才更新
if redis.call('HGET', key, 'status') == expected then
    redis.call('HSET', key, 'status', newStatus)
    return {1, newStatus}
else
    return {0, current}
end
```

### 4. Stalled Job 检测

BullMQ 定期检查：
- Job 持有锁的时长是否超过 `lockDuration`
- 如果超过 → 标记为 stalled
- 自动重新加入队列

## 📝 扩展测试

### 添加新测试用例

在 `chaos-engineering.ts` 中添加：

```typescript
await runTest('你的测试名称', async () => {
    // 1. 准备测试数据
    const testData = ...;

    // 2. 执行测试操作
    const result = await someOperation(testData);

    // 3. 验证结果
    if (result !== expected) {
        throw new Error('验证失败');
    }

    console.log('   ✓ 验证成功');
});
```

### 自定义测试配置

修改脚本顶部的配置：

```typescript
const API_BASE = 'http://127.0.0.1:4000/api';
const ADMIN_EMAIL = 'admin@aiygw.com';
const ADMIN_PASSWORD = 'admin123';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
```

## 🔍 监控和调试

### 启用详细日志

在测试脚本中设置：
```typescript
process.env.LOG_LEVEL = 'debug';
```

### 使用 BullMQ Dashboard

访问 BullMQ 监控面板：
```
http://localhost:4000/admin/bull-board
```

可以查看：
- 队列中的任务状态
- 失败任务详情
- 重试历史

## ✅ 验收标准

系统通过所有测试意味着：

1. ✅ **拓扑引擎健壮** - 能正确检测各种异常图结构
2. ✅ **故障恢复能力强** - Worker 崩溃后能自动恢复
3. ✅ **数据一致性保证** - Redis 断开不会导致数据丢失
4. ✅ **并发安全** - 无竞态条件，状态管理原子性
5. ✅ **可扩展性好** - 能处理大规模 DAG
6. ✅ **错误处理完善** - 异常数据流不会导致系统崩溃

## 📚 参考资料

- [BullMQ 文档](https://docs.bullmq.io/)
- [Redis Lua 脚本](https://redis.io/docs/manual/programmability/eval-intro/)
- [Kahn 算法](https://en.wikipedia.org/wiki/Topological_sorting#Kahn's_algorithm)
- [混沌工程原则](https://principlesofchaos.org/)

## 🤝 贡献

如果你发现新的边界情况或想添加新的测试用例，请：

1. 在对应的测试文件中添加新的测试函数
2. 更新本文档的测试详情部分
3. 确保所有测试通过
4. 提交 Pull Request

## 📞 支持

如果遇到问题：

1. 检查 [故障排查](#故障排查) 部分
2. 查看 Backend 日志：`tail -f backend/logs/app.log`
3. 联系开发团队
