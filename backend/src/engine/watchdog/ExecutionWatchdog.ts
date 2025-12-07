import logger from '../../utils/logger.js';
import quotaService from '../../services/quota.service.js';
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

            // 2. TODO: Monitor BullMQ Stalled Jobs
            // const stalled = await pipelineQueue.getJobCounts('stalled');
            // if (stalled > 0) { ... }

        } catch (error) {
            logger.error('[Watchdog] Check cycle failed:', error);
        }
    }
}

export const executionWatchdog = new ExecutionWatchdog();
