import { configManager } from '../src/config/config.manager.js';
import { initializeDatabase, db } from '../src/config/database.js';
import { initializeRedis, closeRedis } from '../src/config/redis.js';
import queueService from '../src/services/queue.service.js';
import cronJobsService from '../src/services/cronJobs.service.js';
import { checkAll } from '../src/services/health.service.js';

async function initialize() {
  // 1. 初始化配置管理器
  await configManager.initialize();
  console.log('[scheduler-health] ConfigManager 初始化完成');

  // 2. 初始化数据库
  await initializeDatabase();
  console.log('[scheduler-health] Database 初始化完成');

  // 3. 初始化Redis
  await initializeRedis();
  console.log('[scheduler-health] Redis 初始化完成');

  // 4. 初始化队列服务
  await queueService.initialize();
  console.log('[scheduler-health] QueueService 初始化完成');
}

async function main() {
  // 执行初始化
  await initialize();

  console.log('================ Scheduler / Queue 健康检查 ================');

  const healthReport = await checkAll();
  console.log('\n[health.service] 汇总报告');
  console.log(JSON.stringify(healthReport, null, 2));

  const cronStatus = cronJobsService.getStatus();
  console.log('\n[cronJobs] 当前任务状态');
  console.table(
    cronStatus.jobs.map((job) => ({
      name: job.name,
      schedule: job.schedule,
      enabled: job.enabled,
      lastRunAt: job.lastRunAt ?? 'never',
      lastSuccessAt: job.lastSuccessAt ?? 'never',
      lastError: job.lastError ?? ''
    }))
  );

  const queueStats = await queueService.getAllQueueStats();
  console.log('\n[queueService] 队列统计');
  console.log(JSON.stringify(queueStats, null, 2));
}

main()
  .catch((error) => {
    console.error('[scheduler-health] 执行失败', error);
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

