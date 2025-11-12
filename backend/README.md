# AI照后端服务

服装AI处理 SaaS 平台的后端API服务

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑.env文件,填入真实配置
vim .env
```

### 3. 初始化数据库

```bash
# 运行数据库迁移
npm run db:migrate
```

### 4. 启动开发服务器

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

## 可用命令

```bash
npm start          # 生产环境启动
npm run dev        # 开发环境启动(热重载)
npm run db:migrate # 运行数据库迁移
npm run db:rollback # 回滚数据库迁移
npm run db:seed    # 运行数据库种子
npm run lint       # 代码检查
npm run format     # 代码格式化
```

## 邮箱验证登录/注册

现在支持通过邮箱验证码完成注册、登录以及找回密码，便于海外用户或无手机号的场景。

- `POST /api/auth/email/send-code`：发送邮箱验证码（需要配置 SMTP）
- `POST /api/auth/email/register`：邮箱 + 验证码注册并设置密码
- `POST /api/auth/email/login`：邮箱验证码登录，未注册将自动创建账号
- `POST /api/auth/email/reset-password`：邮箱验证码重置密码

> ⚠️ 生产环境必须在 `.env` 中配置 `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD/SMTP_FROM` 等参数，否则无法发送邮箱验证码。

## 项目结构

```
backend/
├── src/
│   ├── config/           # 配置文件
│   │   ├── database.js   # 数据库配置
│   │   └── cos.js        # COS配置
│   ├── controllers/      # 控制器
│   ├── services/         # 业务逻辑
│   ├── models/           # 数据模型
│   ├── middlewares/      # 中间件
│   │   ├── auth.middleware.js
│   │   └── errorHandler.middleware.js
│   ├── routes/           # 路由
│   ├── utils/            # 工具函数
│   │   ├── logger.js     # 日志工具
│   │   └── generator.js  # ID生成器
│   ├── jobs/             # 后台任务
│   ├── db/               # 数据库
│   │   ├── migrations/   # 迁移文件
│   │   └── seeds/        # 种子文件
│   ├── app.js            # Express应用
│   └── server.js         # 启动入口
├── logs/                 # 日志目录
├── .env.example          # 环境变量模板
├── .gitignore
├── knexfile.js           # Knex配置
├── ecosystem.config.js   # PM2配置
└── package.json
```

## 数据库表

- `users` - 用户表
- `orders` - 订单表
- `tasks` - 任务表
- `verification_codes` - 验证码表

## API文档

详细的API文档请参考: [API_DOCUMENTATION.md](../API_DOCUMENTATION.md)

## 部署

### 使用PM2部署

```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start ecosystem.config.js

# 查看日志
pm2 logs

# 重启应用
pm2 restart ai-photo-api

# 停止应用
pm2 stop ai-photo-api
```

## 技术栈

- **框架**: Express.js
- **数据库**: MySQL 8.0 + Knex.js
- **认证**: JWT
- **文件存储**: 腾讯云COS
- **日志**: Winston
- **进程管理**: PM2

## 环境要求

- Node.js >= 18.0.0
- MySQL >= 8.0
- Redis >= 6.0 (用于Bull队列)

## 许可证

[待定]
