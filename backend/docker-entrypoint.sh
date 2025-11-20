#!/bin/sh
# Backend Docker 启动脚本 - 自动运行数据库迁移

set -e

echo "=========================================="
echo "AI Photo Backend - Starting up..."
echo "=========================================="

# 等待数据库就绪
echo "⏳ 等待 MySQL 数据库就绪..."
MAX_RETRIES=30
RETRY_COUNT=0

until nc -z ${DB_HOST:-mysql} ${DB_PORT:-3306} || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  echo "数据库未就绪，重试 $RETRY_COUNT/$MAX_RETRIES..."
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ 数据库连接超时！"
  exit 1
fi

echo "✅ 数据库已就绪"

# 运行数据库迁移
echo "🔄 运行数据库迁移..."
if npm run db:migrate; then
  echo "✅ 数据库迁移成功"
else
  echo "⚠️  数据库迁移失败，但继续启动（可能是首次部署或无新迁移）"
fi

# 启动应用
echo "🚀 启动后端服务..."
exec node dist/server.js
