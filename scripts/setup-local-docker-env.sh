
# 停止并移除可能已存在的旧容器
docker-compose -f docker-compose.local.yml down -v

# 启动 MySQL 和 Redis
docker-compose -f docker-compose.local.yml up -d mysql redis

# 等待数据库启动
echo "等待 MySQL 启动..."
sleep 15

# 运行数据库迁移和种子数据
# 这里我们需要利用本地的 backend 代码来操作容器内的数据库
# 但注意：容器内的 MySQL 端口映射到了本地的 3306
# 所以我们可以直接用本地的 npm run db:migrate 来操作，只要 .env 配置正确

# 1. 创建一个临时的 .env.docker.local 用于连接本地 Docker 数据库
echo "配置数据库连接..."
# 备份现有的 .env (如果存在)
if [ -f backend/.env ]; then
  cp backend/.env backend/.env.bak
fi

# 写入连接本地 Docker MySQL 的配置
cat > backend/.env <<EOL
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=devroot
DB_NAME=ai_photo
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
JWT_SECRET=dev_jwt_secret_local_docker
LOG_LEVEL=info
EOL

# 2. 安装依赖 (如果还没安装)
cd backend
if [ ! -d "node_modules" ]; then
  echo "安装后端依赖..."
  npm install
fi

# 3. 运行迁移
echo "运行数据库迁移..."
npm run db:migrate

# 4. 运行种子数据 (初始化数据)
echo "初始化种子数据..."
npm run db:seed

# 5. 恢复原来的 .env (可选，或者保留用于本地开发连接 Docker 库)
# mv .env.bak .env

echo "✅ 本地 Docker 环境 (MySQL + Redis) 搭建完成！"
echo "现在您可以启动后端服务了：cd backend && npm run dev"
