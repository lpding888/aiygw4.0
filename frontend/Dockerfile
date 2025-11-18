# ================================
# AI照前端 - 生产环境Dockerfile
# ================================
# 艹！Next.js 14多阶段构建，极致优化，兼容CI/CD

# ========== 基础镜像 ==========
FROM node:20-alpine AS base
# 安装 node-canvas 编译所需的底层库
RUN apk add --no-cache libc6-compat build-base python3 cairo-dev pango-dev libjpeg-turbo-dev giflib-dev pixman-dev freetype-dev
WORKDIR /app

# ========== 依赖安装阶段 ==========
FROM base AS deps
# 只复制依赖文件，利用缓存层
COPY package.json package-lock.json ./
# 生产构建也需要devDependencies（Next构建依赖）
RUN npm ci

# ========== 构建阶段 ==========
FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 注入构建期可覆盖的公开环境变量
ARG NEXT_PUBLIC_API_BASE=http://localhost:3000/api
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3000
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

# 复制源代码 & node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js构建Standalone产物
RUN npm run build

# ========== 运行阶段 ==========
FROM node:20-alpine AS runner
# 运行时也需要 node-canvas 依赖的共享库
RUN apk add --no-cache libc6-compat cairo pango libjpeg-turbo giflib pixman freetype
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# 创建非root用户
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# 复制构建结果
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

# 使用内置server.js启动
CMD ["node", "server.js"]
