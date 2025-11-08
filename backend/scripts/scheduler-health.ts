import queueService from '../src/services/queue.service.js';
import cronJobsService from '../src/services/cronJobs.service.js';
import { checkAll } from '../src/services/health.service.js';
import { closeRedis } from '../src/config/redis.js';
import { db } from '../src/config/database.js';

async function main() {
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
    await db.destroy().catch(() => undefined);
  });
