# BullMQ监控面板安全配置

## 概述
BullMQ监控面板已加固安全保护，提供三层防护：

1. **IP白名单**：限制可访问IP地址范围
2. **Basic Auth认证**：用户名密码验证
3. **只读模式**：生产环境禁止修改操作

## 环境变量配置

在`.env`文件中添加以下配置：

```bash
# BullMQ监控面板配置
ENABLE_BULL_BOARD=true                                # 是否启用监控面板
BULL_BOARD_USERNAME=admin                              # Basic Auth用户名
BULL_BOARD_PASSWORD=your_secure_password_here          # Basic Auth密码(必填)
BULL_BOARD_READONLY=true                               # 生产环境只读模式(推荐)

# IP白名单配置（可选，支持CIDR格式）
BULL_BOARD_WHITELIST_IPS=127.0.0.1,192.168.1.0/24,10.0.0.0/8

# 示例：
# - 单个IP: 127.0.0.1
# - 多个IP: 127.0.0.1,192.168.1.100
# - CIDR范围: 192.168.1.0/24  (192.168.1.0 - 192.168.1.255)
# - 混合: 127.0.0.1,192.168.1.0/24,10.0.0.1
```

## 访问策略

监控面板会按以下优先级验证访问：

### 策略1: IP白名单（最高优先级）
- 如果配置了`BULL_BOARD_WHITELIST_IPS`
- 且请求IP在白名单中
- 则**直接放行，无需密码**

### 策略2: Basic Auth认证
- 如果未配置IP白名单，或IP不在白名单中
- 则需要提供正确的用户名和密码
- 用户名: `BULL_BOARD_USERNAME` (默认: admin)
- 密码: `BULL_BOARD_PASSWORD` (必须设置)

### 策略3: 开发环境例外
- 开发环境(`NODE_ENV=development`)
- 本地访问(`127.0.0.1`)
- 自动放行（无需认证）

## 只读模式

生产环境默认启用只读模式，禁止以下操作：
- ❌ 重试失败任务
- ❌ 删除任务
- ❌ 清空队列
- ❌ 暂停/恢复队列
- ✅ 查看任务列表
- ✅ 查看任务详情
- ✅ 查看队列统计

如需在生产环境启用写权限：
```bash
BULL_BOARD_READONLY=false  # 不推荐！
```

## 安全最佳实践

### 1. 强密码策略
```bash
# ❌ 弱密码
BULL_BOARD_PASSWORD=admin123

# ✅ 强密码
BULL_BOARD_PASSWORD=$(openssl rand -base64 32)
```

### 2. 结合Nginx使用
```nginx
location /admin/queues {
    # IP白名单
    allow 192.168.1.0/24;
    deny all;

    # 转发到后端
    proxy_pass http://localhost:3000;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### 3. 使用VPN
- 将监控面板限制在VPN网络内
- 配置VPN网段到IP白名单
- 示例: `BULL_BOARD_WHITELIST_IPS=10.8.0.0/24`

### 4. 定期轮换密码
```bash
# 每季度更新一次密码
BULL_BOARD_PASSWORD=$(date +%s | sha256sum | base64 | head -c 32)
```

## 访问示例

### 浏览器访问
1. 访问: `http://your-domain.com/admin/queues`
2. 输入用户名: `admin`
3. 输入密码: (配置的密码)

### curl命令访问
```bash
# Basic Auth方式
curl -u admin:your_password http://localhost:3000/admin/queues

# 或使用Authorization头
AUTH=$(echo -n "admin:your_password" | base64)
curl -H "Authorization: Basic $AUTH" http://localhost:3000/admin/queues
```

## 日志监控

所有访问尝试都会记录日志：

```
[BullBoard] IP白名单验证通过 { clientIP: '192.168.1.100' }
[BullBoard] Basic Auth验证通过 { clientIP: '203.0.113.50' }
[BullBoard] 未授权访问尝试 { clientIP: '198.51.100.1', userAgent: '...' }
```

## 故障排查

### 问题1: 无法访问面板
**现象**: 401 Unauthorized

**解决**:
1. 检查是否配置了密码: `BULL_BOARD_PASSWORD`
2. 检查IP是否在白名单: `BULL_BOARD_WHITELIST_IPS`
3. 确认请求包含正确的Authorization头

### 问题2: IP白名单不生效
**现象**: 即使IP在白名单，仍需密码

**解决**:
1. 检查反向代理是否正确转发`X-Forwarded-For`头
2. 确认IP格式正确（支持CIDR: `192.168.1.0/24`）
3. 查看日志确认识别到的客户端IP

### 问题3: 只读模式限制操作
**现象**: 无法重试任务

**解决**:
- 这是预期行为（生产环境保护）
- 如需修改，设置: `BULL_BOARD_READONLY=false`
- 或在开发/测试环境操作

## 环境配置检查清单

在生产环境部署前，确认以下配置：

- [ ] `ENABLE_BULL_BOARD=true`
- [ ] `BULL_BOARD_PASSWORD`已设置强密码
- [ ] `BULL_BOARD_READONLY=true`
- [ ] `BULL_BOARD_WHITELIST_IPS`已配置（推荐）
- [ ] Nginx/防火墙额外保护（可选）
- [ ] 密码已安全存储（密钥管理系统）

---

**安全提醒**:
- 永远不要将密码提交到代码仓库
- 使用环境变量或密钥管理服务存储敏感信息
- 定期审查访问日志，发现异常访问
