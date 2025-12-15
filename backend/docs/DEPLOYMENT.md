# 后端运维部署指南

## 1. 环境要求

### 基础环境
- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **MySQL**: >= 8.0
- **Redis**: >= 6.0

### 硬件建议
| 环境 | CPU | 内存 | 存储 |
|-----|-----|------|------|
| 开发 | 2核 | 4GB | 50GB |
| 测试 | 4核 | 8GB | 100GB |
| 生产 | 8核+ | 16GB+ | 500GB+ SSD |

---

## 2. 部署流程

### 2.1 首次部署

```bash
# 1. 克隆代码
git clone <repository-url>
cd backend

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际配置

# 4. 数据库迁移
npm run db:migrate

# 5. 启动服务
npm run start
```

### 2.2 更新部署

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装新依赖
npm install

# 3. 运行数据库迁移（如有）
npm run db:migrate

# 4. 重启服务
pm2 restart ecosystem.config.js
```

---

## 3. 高可用架构建议

### 3.1 Redis 高可用

**方案一：Redis Sentinel（推荐）**
```
┌─────────────┐
│   Sentinel  │  (监控主节点)
└──────┬──────┘
       │
┌──────▼──────┐     ┌─────────────┐
│   Master    │────►│   Slave 1   │
└─────────────┘     └─────────────┘
       │
       └───────────►┌─────────────┐
                    │   Slave 2   │
                    └─────────────┘
```

**配置示例**（.env）:
```bash
REDIS_MODE=sentinel
REDIS_SENTINELS=sentinel1:26379,sentinel2:26379,sentinel3:26379
REDIS_SENTINEL_NAME=mymaster
```

**方案二：Redis Cluster**
- 适用于大规模数据，需要分片
- 最少6个节点（3主3从）

### 3.2 MySQL 高可用

**方案一：主从复制 + 读写分离**
```
┌─────────────┐       ┌─────────────┐
│   Master    │──────►│   Slave     │
│   (写)      │       │   (读)      │
└─────────────┘       └─────────────┘
```

**配置示例**:
```bash
DB_HOST=master.mysql.local
DB_READ_HOST=slave.mysql.local
```

**方案二：MySQL Group Replication**
- 适用于需要多主写入的场景
- 自动故障转移

---

## 4. CI/CD 配置模板

### 4.1 GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy Backend

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Production
        run: |
          ssh ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }} << 'EOF'
            cd /app/backend
            git pull origin main
            npm install
            npm run db:migrate
            pm2 restart all
          EOF
```

### 4.2 Docker 构建

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist ./dist
COPY .env.production .env

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

---

## 5. 灰度发布策略

### 5.1 按流量百分比

```
                    ┌─────────────┐
                    │   Nginx     │
                    │   负载均衡   │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
       ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
       │ 旧版本   │    │ 旧版本   │    │ 新版本   │
       │  (40%)  │    │  (40%)  │    │  (20%)  │
       └─────────┘    └─────────┘    └─────────┘
```

### 5.2 按用户分组

```nginx
# nginx.conf
map $cookie_user_group $backend {
    "beta"    beta_backend;
    default   stable_backend;
}

upstream stable_backend {
    server 192.168.1.10:3000;
    server 192.168.1.11:3000;
}

upstream beta_backend {
    server 192.168.1.20:3000;
}
```

---

## 6. 监控告警配置

### 6.1 Prometheus 抓取配置

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'aiphoto-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### 6.2 告警规则

```yaml
# alerts.yml
groups:
  - name: backend-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(aiphoto_task_failed_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高错误率告警"
          
      - alert: SlowQueries
        expr: rate(aiphoto_slow_query_total[5m]) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "慢查询过多告警"
          
      - alert: DatabaseConnectionExhausted
        expr: aiphoto_db_pool_connections{state="pending"} > 5
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "数据库连接池耗尽"
```

---

## 7. 环境变量安全管理

### 7.1 敏感配置加密

使用环境变量加密工具（如 `dotenv-vault`）：
```bash
# 加密 .env 文件
npx dotenv-vault encrypt production

# 解密并注入环境
DOTENV_KEY="production_key" node dist/server.js
```

### 7.2 Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
type: Opaque
stringData:
  DB_PASSWORD: "your-secure-password"
  JWT_SECRET: "your-jwt-secret"
  ENCRYPTION_KEY_V1: "your-32-char-encryption-key"
```

---

## 8. 故障排查清单

### 8.1 常见问题

| 问题 | 检查项 | 解决方案 |
|-----|-------|---------|
| 启动失败 | 环境变量 | 运行 `npm run dev` 查看详细错误 |
| 数据库连接失败 | DB_HOST/DB_PORT | 检查网络连通性和认证 |
| Redis连接失败 | REDIS_URL | 检查Redis服务状态 |
| 内存溢出 | Node堆大小 | 增加 `--max-old-space-size` |
| 请求超时 | 队列积压 | 检查BullMQ队列状态 |

### 8.2 日志位置

- 应用日志：`logs/app-*.log`
- 错误日志：`logs/error-*.log`
- 慢查询日志：在应用日志中搜索 `[DATABASE SLOW QUERY]`
