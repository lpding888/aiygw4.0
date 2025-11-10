import cron, { type ScheduledTask } from 'node-cron';

import commissionService from './commission.service.js';
import providerHealthService from './providerHealth.service.js';
import taskService from './task.service.js';
import logger from '../utils/logger.js';

type JobMetric = {
  name: string;
  schedule: string;
  intervalMs: number;
  enabled: boolean;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastError?: string | null;
};

const parseToggle = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return !['0', 'false', 'no'].includes(value.toLowerCase());
};

export type CronJobMetric = JobMetric;

class CronJobsService {
  private jobs: ScheduledTask[] = [];
  private jobMetrics = new Map<string, JobMetric>();
  private config = {
    enableProviderHealthCheck: parseToggle(process.env.CRON_ENABLE_PROVIDER_HEALTH, true),
    enableTaskCleanup: parseToggle(process.env.CRON_ENABLE_TASK_CLEANUP, true),
    enableCommissionUnfreeze: parseToggle(process.env.CRON_ENABLE_COMMISSION_UNFREEZE, true)
  };

  startAll(): void {
    try {
      logger.info('[CronJobsService] 启动定时任务服务', this.config);

      if (this.config.enableProviderHealthCheck) {
        this.scheduleProviderHealthCheck();
      } else {
        this.registerDisabledJob('provider-health', '*/10 * * * *', 10 * 60 * 1000);
      }

      if (this.config.enableTaskCleanup) {
        this.scheduleTaskCleanup();
      } else {
        this.registerDisabledJob('task-cleanup', '0 * * * *', 60 * 60 * 1000);
      }

      if (this.config.enableCommissionUnfreeze) {
        this.scheduleUnfreezeCommissions();
      } else {
        this.registerDisabledJob('commission-unfreeze', '0 * * * *', 60 * 60 * 1000);
      }

      logger.info(`[CronJobsService] 已启动 ${this.jobs.length} 个定时任务`);
    } catch (error) {
      const err = error as Error;
      logger.error(`[CronJobsService] 启动定时任务失败: ${err.message}`, error);
    }
  }

  stopAll(): void {
    try {
      logger.info('[CronJobsService] 停止所有定时任务');

      for (const job of this.jobs) {
        if (job) {
          job.stop();
        }
      }

      this.jobs = [];
      logger.info('[CronJobsService] 所有定时任务已停止');
    } catch (error) {
      const err = error as Error;
      logger.error(`[CronJobsService] 停止定时任务失败: ${err.message}`, error);
    }
  }

  scheduleProviderHealthCheck(): void {
    this.scheduleJob({
      name: 'provider-health',
      cronExpr: '*/10 * * * *',
      intervalMs: 10 * 60 * 1000,
      fn: async () => {
        logger.info('[CronJobs] 开始执行 Provider 健康检查');
        const result = await providerHealthService.checkAllProviders();
        if (!result) {
          logger.info('[CronJobs] 没有需要检查的 Provider');
          return;
        }

        logger.info(
          `[CronJobs] Provider 健康检查完成 total=${result.total} success=${result.success} fail=${result.fail}`
        );

        if (result.fail > 0) {
          const unhealthyProviders = await providerHealthService.getUnhealthyProviders();
          logger.warn('[CronJobs] 发现不健康的 Provider', { unhealthyProviders });
        }
      }
    });
  }

  scheduleTaskCleanup(): void {
    this.scheduleJob({
      name: 'task-cleanup',
      cronExpr: '0 * * * *',
      intervalMs: 60 * 60 * 1000,
      fn: async () => {
        logger.info('[CronJobs] 开始执行任务清理');
        const deleted = await taskService.cleanupTimeoutTasks();
        logger.info('[CronJobs] 任务清理完成', { deleted });
      }
    });
  }

  scheduleUnfreezeCommissions(): void {
    this.scheduleJob({
      name: 'commission-unfreeze',
      cronExpr: '0 * * * *',
      intervalMs: 60 * 60 * 1000,
      fn: async () => {
        logger.info('[CronJobs] 开始执行解冻佣金任务');
        await commissionService.unfreezeCommissions();
        logger.info('[CronJobs] 解冻佣金任务完成');
      }
    });
  }

  getStatus(): {
    totalJobs: number;
    activeJobs: number;
    jobs: JobMetric[];
  } {
    return {
      totalJobs: this.jobMetrics.size,
      activeJobs: this.jobs.length,
      jobs: Array.from(this.jobMetrics.values())
    };
  }

  private registerDisabledJob(name: string, cronExpr: string, intervalMs: number): void {
    this.jobMetrics.set(name, {
      name,
      schedule: cronExpr,
      intervalMs,
      enabled: false,
      lastError: 'disabled'
    });
    logger.warn(`[CronJobsService] 任务 ${name} 已通过环境变量关闭`);
  }

  private scheduleJob(options: {
    name: string;
    cronExpr: string;
    intervalMs: number;
    fn: () => Promise<void>;
  }): void {
    try {
      const metric: JobMetric = {
        name: options.name,
        schedule: options.cronExpr,
        intervalMs: options.intervalMs,
        enabled: true
      };
      this.jobMetrics.set(options.name, metric);

      const job = cron.schedule(options.cronExpr, async () => {
        metric.lastRunAt = new Date().toISOString();
        try {
          await options.fn();
          metric.lastSuccessAt = metric.lastRunAt;
          metric.lastError = null;
        } catch (error) {
          const err = error as Error;
          metric.lastError = err?.message ?? 'unknown error';
          logger.error(`[CronJobs] 任务 ${options.name} 执行异常: ${metric.lastError}`, error);
        }
      });

      this.jobs.push(job);
      logger.info(
        `[CronJobsService] 任务 ${options.name} 已启动 (cron=${options.cronExpr}, interval=${options.intervalMs}ms)`
      );
    } catch (error) {
      const err = error as Error;
      logger.error(`[CronJobsService] 调度任务 ${options.name} 失败: ${err.message}`, error);
    }
  }
}

export const cronJobsService = new CronJobsService();
export default cronJobsService;
