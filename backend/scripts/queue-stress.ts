import { configManager } from '../src/config/config.manager.js';
import { initializeDatabase, db } from '../src/config/database.js';
import { initializeRedis, closeRedis } from '../src/config/redis.js';
import queueService from '../src/services/queue.service.js';

const [, , queueArg, totalJobsArg, concurrencyArg] = process.argv;
const queueName = queueArg ?? 'task_processing';
const totalJobs = Number.parseInt(totalJobsArg ?? '50', 10);
const concurrency = Number.parseInt(concurrencyArg ?? '5', 10);
const jobName = '__diagnostic__';

async function initialize() {
  // 1. 初始化配置管理器
  await configManager.initialize();
  console.log('[queue-stress] ConfigManager 初始化完成');

  // 2. 初始化数据库
  await initializeDatabase();
  console.log('[queue-stress] Database 初始化完成');

  // 3. 初始化Redis
  await initializeRedis();
  console.log('[queue-stress] Redis 初始化完成');

  // 4. 初始化队列服务
  await queueService.initialize();
  console.log('[queue-stress] QueueService 初始化完成');
}

async function main() {
  // 执行初始化
  await initialize();

  console.log(`[queue-stress] 准备向 ${queueName} 注入 ${totalJobs} 个任务 (并发=${concurrency})`);

  // 注意：registerProcessor 需要 await
  await queueService.registerProcessor(
    queueName,
    jobName,
    async () => {
      await wait(50);
    },
    { concurrency }
  );
  console.log('[queue-stress] 处理器注册完成');

  const payloads = Array.from({ length: totalJobs }).map((_, index) => ({
    name: jobName,
    data: {
      index,
      enqueuedAt: Date.now()
    }
  }));

  const start = Date.now();
  await queueService.addBulkJobs(queueName, payloads);
  await waitForDrain(queueName, totalJobs);
  const duration = Date.now() - start;

  console.log(
    `[queue-stress] 队列 ${queueName} 已完成 ${totalJobs} 个任务，耗时 ${duration}ms，平均 ${(duration / totalJobs).toFixed(2)} ms/任务`
  );
}

async function waitForDrain(queue: string, expected: number) {
  const timeoutAt = Date.now() + 60000;
  while (Date.now() < timeoutAt) {
    const stats = await queueService.getQueueStats(queue);
    const remaining = (stats.waiting ?? 0) + (stats.active ?? 0);
    if (remaining === 0) {
      console.log(`[queue-stress] 队列 ${queue} 已清空，完成 ${expected} 个任务`);
      return;
    }
    console.log(`[queue-stress] 队列 ${queue} 剩余 ${remaining} 个任务，继续等待...`);
    await wait(500);
  }
  throw new Error(`[queue-stress] 等待队列 ${queue} 清空超时`);
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main()
  .catch((error) => {
    console.error('[queue-stress] 执行失败', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queueService.close().catch(() => undefined);
    await closeRedis().catch(() => undefined);
    // 只有在数据库已初始化时才调用destroy
    try {
      await db.destroy();
    } catch {
      // 忽略未初始化的情况
    }
  });

