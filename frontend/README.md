# AI照前端应用

服装AI处理 SaaS 平台的前端应用

## 技术栈

- **框架**: Next.js 14 (App Router)
- **UI库**: Ant Design
- **状态管理**: Zustand
- **HTTP客户端**: Axios
- **文件上传**: 腾讯云COS SDK
- **语言**: TypeScript

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.local.example .env.local

# 编辑.env.local文件
vim .env.local
```

### 3. 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 启动

## 可用命令

```bash
npm run dev    # 开发环境启动
npm run build  # 构建生产版本
npm start      # 生产环境启动
npm run lint   # 代码检查
```

## 项目结构

```
frontend/
├── src/
│   ├── app/              # Next.js App Router页面
│   │   ├── layout.tsx    # 根布局
│   │   ├── page.tsx      # 首页
│   │   ├── login/        # 登录页
│   │   ├── purchase/     # 会员购买页
│   │   ├── workspace/    # 工作台
│   │   ├── task/         # 任务相关页面
│   │   └── admin/        # 管理后台
│   ├── components/       # 组件
│   │   ├── auth/         # 认证相关组件
│   │   ├── upload/       # 上传组件
│   │   ├── task/         # 任务组件
│   │   └── common/       # 通用组件
│   ├── lib/              # 工具库
│   │   ├── api.ts        # API客户端
│   │   ├── cos.ts        # COS上传
│   │   └── utils.ts      # 工具函数
│   ├── hooks/            # 自定义Hooks
│   ├── store/            # 状态管理
│   │   └── authStore.ts  # 认证状态
│   └── types/            # TypeScript类型
│       └── index.ts
├── public/               # 静态资源
├── .env.local.example    # 环境变量模板
└── package.json
```

## 主要页面

- `/` - 首页(自动跳转)
- `/login` - 登录/注册页
- `/purchase` - 会员购买页
- `/workspace` - 工作台首页
- `/task/basic` - 基础修图表单
- `/task/model` - AI模特表单
- `/task/[id]` - 任务详情页
- `/admin` - 管理后台

## 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

## 许可证

[待定]
