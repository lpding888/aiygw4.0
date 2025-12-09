import logger from '../../utils/logger.js';
import quotaService from '../../services/quota.service.js';
import queueService from '../../services/queue.service.js';
// import { StateManager } from '../runner/StateManager.js';

/**
 * ExecutionWatchdog
 * Responsibilities:
 * 1. Periodic cleanup of stuck Quota Reservations.
 * 2. (Future) Monitor heartbeat of workers and reset stuck jobs.
 */
export class ExecutionWatchdog {
    private intervalParams: NodeJS.Timeout | null = null;
    private readonly CHECK_INTERVAL_MS = 60 * 1000 * 5; // 5 minutes

    start() {
        if (this.intervalParams) return;

        logger.info('[Watchdog] Starting Execution Watchdog...');
        this.intervalParams = setInterval(async () => {
            await this.runCheck();
        }, this.CHECK_INTERVAL_MS);

        // Run immediately on start
        this.runCheck();
    }

    stop() {
        if (this.intervalParams) {
            clearInterval(this.intervalParams);
            this.intervalParams = null;
        }
    }

    private async runCheck() {
        try {
            logger.info('[Watchdog] Running health check cycle...');

            // 1. Compensate Stuck Quotas
            const refunded = await quotaService.compensateStuckReservations(30); // 30 mins timeout
            if (refunded > 0) {
                logger.warn(`[Watchdog] Refunded ${refunded} stuck quota transactions.`);
            }

            // 2. Monitor BullMQ Stalled Jobs
            await this.monitorStalledJobs();

        } catch (error) {
            logger.error('[Watchdog] Check cycle failed:', error);
        }
    }

    /**
     * 监控BullMQ停滞任务
     * 停滞任务是指已被worker获取但长时间未完成的任务
     */
    private async monitorStalledJobs() {
        try {
            const queues = await queueService.getAllQueues();
            const queueNames = queues.map((q) => q.name);
            let totalStalled = 0;

            for (const queueName of queueNames) {
                const queue = await queueService.getQueue(queueName);
                if (!queue) {
                    continue;
                }

                try {
                    // 获取不同状态的任务数量
                    const counts = await queue.getJobCounts('active', 'waiting', 'delayed', 'failed');

                    // 检查活跃但长时间未更新的任务（可能停滞）
                    if (counts.active > 0) {
                        const activeJobs = await queue.getJobs(['active'], 0, 100);
                        const now = Date.now();
                        const STALL_THRESHOLD = 10 * 60 * 1000; // 10分钟

                        for (const job of activeJobs) {
                            const processedOn = job.processedOn || 0;
                            if (processedOn && now - processedOn > STALL_THRESHOLD) {
                                totalStalled++;
                                logger.warn(`[Watchdog] 发现停滞任务`, {
                                    queueName,
                                    jobId: job.id,
                                    jobName: job.name,
                                    processedOn: new Date(processedOn),
                                    stallDuration: Math.round((now - processedOn) / 1000) + 's'
                                });

                                // 尝试将停滞任务标记为失败，让其重试
                                try {
                                    await job.moveToFailed(
                                        new Error('Job stalled - watchdog intervention'),
                                        'watchdog',
                                        true
                                    );
                                    logger.info(`[Watchdog] 停滞任务已移至失败队列以触发重试`, { jobId: job.id });
                                } catch (moveError) {
                                    logger.error(`[Watchdog] 无法移动停滞任务`, { jobId: job.id, error: moveError });
                                }
                            }
                        }
                    }

                    // 记录队列健康指标
                    if (counts.failed > 100) {
                        logger.warn(`[Watchdog] 队列失败任务过多`, {
                            queueName,
                            failedCount: counts.failed
                        });
                    }

                } catch (error) {
                    logger.error(`[Watchdog] 监控队列失败: ${queueName}`, error);
                }
            }

            if (totalStalled > 0) {
                logger.warn(`[Watchdog] 总计发现 ${totalStalled} 个停滞任务已处理`);
            }

        } catch (error) {
            logger.error('[Watchdog] BullMQ停滞任务监控失败:', error);
        }
    }
}

export const executionWatchdog = new ExecutionWatchdog();
