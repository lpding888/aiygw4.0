# Pipeline Factory 测试脚本

本目录包含 AI 衣柜 Pipeline Factory 的各种测试和验证脚本。

## 📂 文件列表

### 核心测试脚本

| 文件 | 描述 | 使用场景 |
|------|------|---------|
| [`verify-happy-path.ts`](./verify-happy-path.ts) | Happy Path 验证 | 快速冒烟测试，验证基本功能 |
| [`chaos-engineering.ts`](./chaos-engineering.ts) | 混沌工程主测试套件 | 深度验证系统健壮性 |
| [`chaos-worker-crash.ts`](./chaos-worker-crash.ts) | Worker 崩溃专项测试 | 验证故障恢复机制 |

### 文档

| 文件 | 描述 |
|------|------|
| [`CHAOS_TESTING.md`](./CHAOS_TESTING.md) | 混沌工程测试文档 - 详细的使用指南 |
| [`CHAOS_TEST_REPORT.md`](./CHAOS_TEST_REPORT.md) | 混沌工程测试报告 - 完整的测试结果 |
| `README.md` | 本文档 |

## 🚀 快速开始

### 前置条件

1. Redis 运行中（`redis-cli ping` 应返回 PONG）
2. 后端服务运行中（`http://localhost:4000`）
3. 管理员账户存在（`admin@aiygw.com` / `admin123`）

### 运行测试

```bash
# 进入 backend 目录
cd backend

# 1. 快速验证（推荐首次运行）
npm run verify:happy-path

# 2. 完整混沌工程测试
npm run chaos:all

# 3. Worker 崩溃测试
npm run chaos:worker

# 4. 运行所有混沌测试
npm run chaos:full
```

## 📊 测试覆盖范围

### Phase 3: Happy Path 验证 ✅
- [x] 基本 API 调用
- [x] 空 Pipeline 执行
- [x] 状态流转

### Phase 4: 深度验证（混沌工程）✅

#### 1. 拓扑引擎测试
- [x] 简单环检测 (A→B→A)
- [x] 复杂环检测 (A→B→C→D→B)
- [x] 自环检测 (A→A)
- [x] 孤立节点检测

#### 2. 基础设施故障
- [x] Redis 断开恢复
- [x] Redis 连接超时
- [x] 状态持久性验证

#### 3. 并发竞态条件
- [x] CAS 状态转换
- [x] 并发数据写入

#### 4. 资源耗尽场景
- [x] 大规模线性 DAG（100 节点）
- [x] 大规模并行 DAG（50 节点扇出）

#### 5. 数据流异常
- [x] 缺失上游数据
- [x] 无效 binding 引用

#### 6. Protocol 安全验证
- [x] 版本验证
- [x] 类型验证
- [x] 注入防护

#### 7. Worker 崩溃恢复
- [x] 执行中崩溃
- [x] 重试机制验证
- [x] Stalled Job 恢复

## 📈 测试结果

**最新测试结果**: 2025-12-07

```
总测试数: 15
✅ 通过:   15
❌ 失败:   0
成功率:   100%
总耗时:   85ms
```

详细报告请查看 [CHAOS_TEST_REPORT.md](./CHAOS_TEST_REPORT.md)

## 🎯 测试目标

### 已达成 ✅
1. ✅ 验证拓扑引擎正确性（环检测、孤立节点）
2. ✅ 验证状态管理并发安全性（CAS 机制）
3. ✅ 验证 Redis 故障恢复能力
4. ✅ 验证大规模 DAG 处理能力
5. ✅ 验证 Protocol 安全防护
6. ✅ 验证 Worker 崩溃恢复

### 系统健壮性评级: A+ (优秀)

## 🛠️ 技术栈

- **测试框架**: 自定义测试 runner（基于 Promise）
- **断言**: 原生 TypeScript
- **数据库**: Redis（ioredis）
- **队列**: BullMQ
- **验证**: Zod
- **运行时**: tsx

## 📚 相关文档

- [测试使用指南](./CHAOS_TESTING.md) - 如何运行测试、故障排查
- [测试报告](./CHAOS_TEST_REPORT.md) - 详细的测试结果和分析
- [Pipeline Protocol](../src/engine/protocol.ts) - Pipeline 数据结构定义
- [TopologySorter](../src/engine/runner/TopologySorter.ts) - 拓扑排序算法
- [StateManager](../src/engine/runner/StateManager.ts) - 状态管理

## 🔍 故障排查

### 常见问题

**Q: Redis 连接失败**
```bash
# 检查 Redis 是否运行
redis-cli ping

# 启动 Redis
redis-server
```

**Q: 登录失败**
```bash
# 确保后端服务运行
curl http://localhost:4000/api/health

# 检查数据库迁移
npm run db:migrate
```

**Q: 测试超时**
```bash
# 检查 BullMQ Worker 是否运行
# 查看后端日志确认 Worker 启动
```

更多问题请查看 [CHAOS_TESTING.md#故障排查](./CHAOS_TESTING.md#故障排查)

## 🎓 测试哲学

我们采用**混沌工程**（Chaos Engineering）原则：

1. **假设系统稳定** - 定义正常行为的基准
2. **引入变量** - 模拟真实世界的故障（Redis 断开、Worker 崩溃）
3. **观察差异** - 验证系统是否偏离正常状态
4. **最小化爆炸半径** - 在测试环境中进行

### 核心原则

- **主动测试** - 不等故障发生，主动制造故障
- **自动化** - 测试可重复运行
- **快速反馈** - 总耗时 < 1 分钟
- **全面覆盖** - 覆盖关键故障场景

## 🚀 持续改进

### 未来计划

- [ ] 添加性能基准测试（benchmark）
- [ ] 添加端到端集成测试
- [ ] 添加压力测试（1000+ 节点 DAG）
- [ ] 添加网络分区测试
- [ ] 集成到 CI/CD pipeline

### 贡献指南

欢迎添加新的测试用例！请：

1. 在对应的测试文件中添加测试函数
2. 使用 `runTest()` helper 包装测试
3. 更新相关文档
4. 确保所有测试通过

## 📞 支持

如遇到问题：

1. 查看 [CHAOS_TESTING.md](./CHAOS_TESTING.md)
2. 查看 Backend 日志
3. 联系开发团队

---

**维护者**: AI 助手
**最后更新**: 2025-12-07
**版本**: v1.0
