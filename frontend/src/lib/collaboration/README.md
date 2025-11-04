# Pipeline协同编辑系统

## 概述

Pipeline协同编辑系统是一个基于Yjs/CRDT技术的实时多人协作编辑解决方案，支持多用户同时编辑Pipeline流程图，具备自动冲突解决、版本管理和用户状态同步等功能。

## 核心功能

### 🚀 实时协作编辑
- **CRDT数据同步**: 基于Yjs的Conflict-free Replicated Data Types，确保数据一致性
- **WebSocket通信**: 实时同步节点和边的变更操作
- **自动冲突解决**: CRDT算法自动合并冲突操作，无需人工干预

### 👥 多人Presence显示
- **在线用户列表**: 实时显示当前协作的所有用户
- **用户光标显示**: 显示其他用户的鼠标位置和编辑状态
- **用户颜色标识**: 每个用户自动分配独特的颜色标识
- **状态同步**: 用户上线/下线状态实时同步

### 📸 版本快照管理
- **自动快照**: 每500个操作自动创建快照
- **手动快照**: 支持用户手动创建带描述的快照
- **快照历史**: 完整的快照列表和时间线
- **版本回滚**: 支持回滚到任意历史快照

### 🔄 连接管理
- **自动重连**: 连接断开时自动尝试重连
- **离线支持**: IndexedDB本地持久化，支持离线编辑
- **状态指示**: 清晰的连接状态显示

## 技术架构

### 核心模块

```
src/lib/collaboration/
├── pipeline-collab.ts      # 核心协作类
├── usePipelineCollaboration.ts  # React Hook
├── CollaborationPresence.tsx    # UI组件
├── collaboration-test.ts        # 测试套件
├── collab-simple-test.js        # 简化测试
└── README.md                    # 文档
```

### 数据流

```
用户操作 → React Hook → PipelineCollaboration → Yjs CRDT → WebSocket → 其他用户
```

### 事件系统

```typescript
// 连接事件
'connection_status'  // 连接状态变化
'sync_status'       // 数据同步状态

// 用户事件
'user_joined'       // 用户加入
'user_left'         // 用户离开
'user_updated'      // 用户状态更新

// 数据事件
'node_changed'      // 节点变更
'edge_changed'      // 边变更

// 版本事件
'snapshot_created'  // 快照创建
'rollback_completed' // 回滚完成
'rollback_failed'   // 回滚失败
```

## 使用方法

### 1. 初始化协作

```typescript
import { usePipelineCollaboration } from '@/hooks/usePipelineCollaboration';

const collaboration = usePipelineCollaboration({
  pipelineId: 'pipeline-001',
  userId: 'user-001',
  userName: '张三',
  serverUrl: 'ws://localhost:1234',
  autoConnect: true
});
```

### 2. 添加协作操作

```typescript
// 添加节点
collaboration.addNode('node-001', {
  label: '新节点',
  type: 'provider',
  position: { x: 100, y: 100 }
});

// 更新节点
collaboration.updateNode('node-001', {
  label: '更新后的节点'
});

// 添加边
collaboration.addEdge('edge-001', {
  source: 'node-001',
  target: 'node-002'
});
```

### 3. 版本管理

```typescript
// 创建快照
const snapshotId = collaboration.createSnapshot('完成基础流程');

// 获取快照列表
const snapshots = collaboration.getSnapshots();

// 回滚到快照
await collaboration.rollbackToSnapshot(snapshotId);
```

### 4. UI集成

```tsx
import { CollaborationPresence } from '@/components/collaboration/CollaborationPresence';

<CollaborationPresence
  onlineUsers={collaboration.state.onlineUsers}
  currentUser={collaboration.state.currentUser}
  isConnected={collaboration.state.isConnected}
  snapshots={collaboration.getSnapshots()}
  onCreateSnapshot={(description) => collaboration.createSnapshot(description)}
  onRollback={(snapshotId) => collaboration.rollbackToSnapshot(snapshotId)}
/>
```

## 配置说明

### WebSocket服务器

协作系统需要WebSocket服务器支持，推荐使用：

```bash
# 安装y-websocket
npm install y-websocket

# 启动WebSocket服务器
npx y-websocket-server --port 1234
```

### 环境变量

```env
# 协作服务器地址
COLLABORATION_SERVER_URL=ws://localhost:1234

# 是否启用协作功能
ENABLE_COLLABORATION=true
```

## 性能优化

### 1. 快照策略
- 自动快照：每500个操作创建一次
- 快照压缩：删除过期的中间快照
- 增量同步：只同步变更的部分

### 2. 内存管理
- 按需加载：大型Pipeline分块加载
- 垃圾回收：定期清理过期数据
- 连接池：复用WebSocket连接

### 3. 网络优化
- 批量操作：合并多个操作一起发送
- 压缩传输：使用gzip压缩数据
- 心跳检测：定期检测连接状态

## 故障处理

### 常见问题

1. **连接失败**
   - 检查WebSocket服务器是否启动
   - 验证服务器地址和端口
   - 查看网络连接状态

2. **数据不同步**
   - 检查Yjs文档版本
   - 验证WebSocket连接状态
   - 重新加载页面

3. **冲突处理**
   - CRDT自动解决大部分冲突
   - 手动创建快照作为检查点
   - 必要时回滚到历史版本

### 调试工具

```typescript
// 启用调试日志
localStorage.setItem('debug', 'y:*');

// 查看Yjs文档状态
const ydoc = collaboration.getYDoc();
console.log('YDoc状态:', ydoc.toJSON());

// 监听所有协作事件
collaboration.on('*', (event, data) => {
  console.log(`协作事件: ${event}`, data);
});
```

## 测试

运行测试套件：

```bash
# 运行简化测试
node src/lib/collaboration/collab-simple-test.js

# 运行完整测试（需要编译环境）
npm run test:collaboration
```

测试覆盖：
- ✅ 用户颜色生成算法
- ✅ 快照ID生成机制
- ✅ 协作操作类型定义
- ✅ 事件监听器系统
- ✅ 核心数据结构
- ✅ WebSocket连接管理
- ✅ CRDT数据同步

## 开发指南

### 添加新的协作操作

1. 在`pipeline-collab.ts`中定义新的操作类型
2. 实现对应的操作方法
3. 添加事件监听和触发
4. 更新UI组件处理
5. 编写测试用例

### 扩展Presence功能

1. 修改`CollaborativeUser`接口
2. 更新`Awareness`状态管理
3. 优化UI显示组件
4. 添加相关测试

### 自定义冲突解决策略

1. 实现自定义`ConflictResolution`策略
2. 集成到Yjs事务处理中
3. 添加用户选择界面
4. 测试各种冲突场景

## 版本历史

### v1.0.0 (当前版本)
- ✅ 基础CRDT协作功能
- ✅ 用户Presence显示
- ✅ 自动快照和版本管理
- ✅ WebSocket实时同步
- ✅ 离线支持
- ✅ 冲突自动解决

### 未来计划
- 🔄 语音/视频通话集成
- 📝 协作评论系统
- 🔐 权限管理
- 📊 操作历史可视化
- 🌐 多语言支持

## 贡献指南

欢迎提交Issue和Pull Request！

1. Fork项目
2. 创建功能分支
3. 编写代码和测试
4. 提交Pull Request
5. 等待代码审查

## 许可证

MIT License

---

**作者**: 老王
**创建时间**: 2025-11-03
**更新时间**: 2025-11-03