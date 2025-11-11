import { db } from '../config/database.js';
import { redis } from '../config/redis.js';
import queueService from './queue.service.js';
import cronJobsService, { type CronJobMetric } from './cronJobs.service.js';

export interface GlobalQueueStats {
  totalQueued: number;
  totalProcessed: number;
  totalFailed: number;
  totalCompleted: number;
  activeJobs: number;
  waitingJobs: number;
}

export interface QueuesHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  activeQueues?: number;
  totalJobs?: number;
  globalStats?: GlobalQueueStats;
  timestamp?: string;
  error?: string;
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    db: { ok: boolean; error?: string };
    redis: { ok: boolean; latencyMs?: number; error?: string };
    queues: QueuesHealthReport;
    cron: CronStatus;
    timestamp: string;
  };
}

interface CronStatus {
  totalJobs: number;
  enabledJobs: number;
  failingJobs: string[];
  staleJobs: string[];
  jobs: CronJobMetric[];
}

async function checkDB(): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.raw('SELECT 1');
    return { ok: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { ok: false, error: err?.message };
  }
}

async function checkRedis(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  try {
    const start = Date.now();
    const pong = await redis.ping();
    const latency = Date.now() - start;
    return { ok: pong === 'PONG', latencyMs: latency };
  } catch (e: unknown) {
    const err = e as Error;
    return { ok: false, error: err?.message };
  }
}

async function checkQueues(): Promise<QueuesHealthReport> {
  return (await queueService.healthCheck()) as QueuesHealthReport;
}

function checkCron(): CronStatus {
  const status = cronJobsService.getStatus();
  const now = Date.now();
  const failing = status.jobs.filter((job) => job.enabled && Boolean(job.lastError));
  const stale = status.jobs.filter((job) => {
    if (!job.enabled) return false;
    if (!job.lastRunAt) return true;
    const lastRun = Date.parse(job.lastRunAt);
    if (Number.isNaN(lastRun)) return true;
    if (job.intervalMs <= 0) return false;
    return now - lastRun > job.intervalMs * 3;
  });

  return {
    totalJobs: status.totalJobs,
    enabledJobs: status.jobs.filter((job) => job.enabled).length,
    failingJobs: failing.map((job) => job.name),
    staleJobs: stale.map((job) => job.name),
    jobs: status.jobs
  };
}

export async function checkAll(): Promise<HealthReport> {
  const [dbReport, redisReport, queuesReport] = await Promise.all([
    checkDB(),
    checkRedis(),
    checkQueues()
  ]);
  const cronReport = checkCron();
  const okDB = dbReport.ok;
  const okRedis = redisReport.ok;
  const okQueues = queuesReport.status === 'healthy';
  const okCron = cronReport.failingJobs.length === 0 && cronReport.staleJobs.length === 0;
  const score = [okDB, okRedis, okQueues, okCron].filter(Boolean).length;
  const status = score === 4 ? 'healthy' : score >= 2 ? 'degraded' : 'unhealthy';
  return {
    status,
    components: {
      db: dbReport,
      redis: redisReport,
      queues: queuesReport,
      cron: cronReport,
      timestamp: new Date().toISOString()
    }
  };
}

export default { checkAll };
