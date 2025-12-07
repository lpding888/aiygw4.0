import { Queue, QueueOptions } from 'bullmq';
import logger from '../../utils/logger.js';

export const PIPELINE_QUEUE_NAME = 'pipeline-execution-v2';

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
};

const queueOptions: QueueOptions = {
    connection: redisConfig,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        removeOnComplete: false, // Keep for history/debugging
        removeOnFail: false      // Keep for DLQ inspection
    }
};

class PipelineQueueManager {
    private queue: Queue;

    constructor() {
        this.queue = new Queue(PIPELINE_QUEUE_NAME, queueOptions);
        logger.info(`[PipelineQueue] Initialized Queue: ${PIPELINE_QUEUE_NAME}`);
    }

    /**
     * Dispatch a batch of nodes for execution.
     * Job ID is deterministic: `runId:batchIndex` to prevent duplicate dispatches.
     */
    async dispatchBatch(runId: string, nodeIds: string[], batchIndex: number, context: any = {}) {
        const jobId = `${runId}:${batchIndex}`;

        await this.queue.add(
            'execute-batch',
            {
                runId,
                nodeIds,
                batchIndex,
                context
            },
            {
                jobId // Idempotency Key
            }
        );

        logger.info(`[PipelineQueue] Dispatched Batch ${batchIndex} for ${runId} (Nodes: ${nodeIds.length})`);
    }

    async getJob(jobId: string) {
        return this.queue.getJob(jobId);
    }

    async close() {
        return this.queue.close();
    }
}

export const pipelineQueue = new PipelineQueueManager();
