import 'dotenv/config';
import { initSentry } from './config/sentry.js'; // Sentry 必须最先初始化
import configManager from './config/config.manager.js'; // ConfigManager统一配置管理
import logger from './utils/logger.js';
import { createApp, startSchedulers, stopSchedulers } from './app.js';
import { initializeRedis, closeRedis } from './config/redis.js';
import { initializeDatabase, closeDatabase } from './config/database.js';
import queueService from './services/queue.service.js';
import { shutdownIngestQueue } from './rag/ingest/worker.js';

/**
 * 服务器启动流程
 * 1. 初始化ConfigManager（配置验证）
 * 2. 初始化Sentry（错误追踪）
 * 3. 创建Express应用
 * 4. 启动HTTP服务器
 */
async function bootstrap() {
  try {
    console.log('🚀 正在启动服务...\n');

    // Step 1: 初始化配置管理器（必须第一步）
    console.log('[1/7] 📋 初始化配置管理器...');
    await configManager.initialize();
    console.log('      ✅ 配置管理器初始化完成\n');

    // Step 2: 初始化数据库连接
    console.log('[2/7] 🗄️  初始化数据库...');
    await initializeDatabase();
    console.log('      ✅ 数据库初始化完成\n');

    // Step 3: 初始化Redis
    console.log('[3/7] ⚡ 初始化Redis...');
    await initializeRedis();
    console.log('      ✅ Redis初始化完成\n');

    // Step 4: 初始化队列服务（BullMQ）
    console.log('[4/7] 🐂 初始化队列服务...');
    await queueService.initialize();
    console.log('      ✅ 队列服务初始化完成\n');

    // Step 5: 初始化Sentry（使用ConfigManager获取配置）
    console.log('[5/7] 🔍 初始化错误追踪...');
    initSentry();
    console.log('      ✅ Sentry初始化完成\n');

    // Step 6: 创建Express应用
    console.log('[6/7] 🏗️  创建应用实例...');
    const appInstance = await createApp();
    console.log('      ✅ 应用创建完成\n');

    // Step 7: 启动HTTP服务器
    console.log('[7/7] 🌐 启动HTTP服务器...');
    const PORT = await configManager.getNumber('PORT', 3000);
    const NODE_ENV = await configManager.getString('NODE_ENV', 'development');

    return { app: appInstance, PORT, NODE_ENV };
  } catch (error) {
    console.error('❌ 服务启动失败:', error);
    logger.error('[Bootstrap] 服务启动失败', error);
    throw error;
  }
}

const { app, PORT, NODE_ENV } = await bootstrap();

import socketService from './services/socket.service.js';
import { pipelineQueue } from './engine/queue/PipelineQueue.js';
import { PipelineWorker } from './engine/worker/PipelineWorker.js';
import { executionWatchdog } from './engine/watchdog/ExecutionWatchdog.js';

const server = app.listen(PORT, () => {
  console.log('\n✅ 服务器启动成功！\n');
  logger.info(`[SERVER] 🚀 启动成功 环境=${NODE_ENV} 端口=${PORT}`);
  logger.info(`[SERVER] 💊 健康检查 http://localhost:${PORT}/health`);
  logger.info(`[SERVER] 📚 API文档 http://localhost:${PORT}/api-docs`);

  // 初始化 Socket.IO
  socketService.init(server);

  // Initialize AI Factory Engine (Worker + Watchdog)
  new PipelineWorker();
  executionWatchdog.start();
  logger.info('[SERVER] AI Factory Engine started (Worker + Watchdog)');

  startSchedulers();
});

const shutdown = (signal: NodeJS.Signals) => {
  logger.warn(`[SERVER] 收到 ${signal}，准备优雅关闭`);
  stopSchedulers();
  executionWatchdog.stop(); // Stop Watchdog
  server.close(async (error) => {
    if (error) {
      logger.error('[SERVER] 关闭过程中出错', { error });
      process.exit(1);
    }
    try {
      await pipelineQueue.close(); // Close Pipeline Queue
      await queueService.close();
    } catch (e) {
      logger.warn('[SERVER] 关闭队列服务异常', { error: e });
    }
    try {
      await shutdownIngestQueue();
    } catch (e) {
      logger.warn('[SERVER] 停止知识库队列异常', { error: e });
    }
    try {
      await closeRedis();
    } catch (e) {
      logger.warn('[SERVER] 关闭 Redis 异常', { error: e });
    }
    try {
      await closeDatabase();
    } catch (e) {
      logger.warn('[SERVER] 关闭数据库连接池异常', { error: e });
    }
    logger.info('[SERVER] 服务器已关闭');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', (err) => {
  logger.error('[SERVER] 未捕获的异常', { error: err });
  shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  logger.error('[SERVER] 未处理的Promise拒绝', { reason });
  shutdown('SIGTERM');
});

export default server;
