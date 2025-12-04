import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import Redis from 'ioredis';

// Explicitly load .env from backend root (assuming running from project root)
dotenv.config({ path: 'backend/.env' });

const checkConnections = async () => {
  console.log('--- 开始检查连接 ---');

  // 1. 检查 Redis
  console.log('\n正在检查 Redis 连接...');
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');
  const redisPassword = process.env.REDIS_PASSWORD;

  console.log(`Redis 配置: ${redisHost}:${redisPort}`);

  const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    connectTimeout: 5000,
    retryStrategy: () => null // Don't retry
  });

  try {
    await redis.ping();
    console.log('✅ Redis 连接成功!');
    const info = await redis.info();
    const version = info.match(/redis_version:([0-9.]+)/)?.[1];
    console.log(`   Redis 版本: ${version}`);
  } catch (error) {
    console.error('❌ Redis 连接失败:', error.message);
  } finally {
    redis.disconnect();
  }

  // 2. 检查 MySQL
  console.log('\n正在检查 MySQL 连接...');
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = parseInt(process.env.DB_PORT || '3306');
  const dbUser = process.env.DB_USER || 'root';
  const dbName = process.env.DB_NAME || 'ai_photo';

  console.log(`MySQL 配置: ${dbHost}:${dbPort} (用户: ${dbUser}, 库: ${dbName})`);

  try {
    const connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: process.env.DB_PASSWORD,
      database: dbName,
      connectTimeout: 5000
    });

    console.log('✅ MySQL 连接成功!');
    const [rows] = await connection.execute('SELECT VERSION() as version');
    // @ts-ignore
    console.log(`   MySQL 版本: ${rows[0].version}`);
    await connection.end();
  } catch (error) {
    console.error('❌ MySQL 连接失败:', error.message);
  }

  console.log('\n--- 检查结束 ---');
};

checkConnections();
