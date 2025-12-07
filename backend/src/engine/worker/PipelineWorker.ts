import { Worker, Job } from 'bullmq';
import { PIPELINE_QUEUE_NAME } from '../queue/PipelineQueue.js';
import { StateManager, PipelineStatus } from '../runner/StateManager.js';
import { TopologySorter } from '../runner/TopologySorter.js';
import { pipelineQueue } from '../queue/PipelineQueue.js';
import { ProtocolValidator } from '../protocol.js';
import pipelineSchemaService from '../../services/pipelineSchema.service.js';
import logger from '../../utils/logger.js';

import { nodeRegistry } from './NodeRegistry.js';

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
};

export class PipelineWorker {
    private worker: Worker;
    private stateManager: StateManager;

    constructor() {
        this.stateManager = new StateManager();

        this.worker = new Worker(PIPELINE_QUEUE_NAME, async (job: Job) => {
            return this.processJob(job);
        }, {
            connection: redisConfig,
            concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
            lockDuration: 60000 // 60s lock for long running AI tasks
        });

        this.worker.on('completed', (job) => {
            logger.info(`[PipelineWorker] Job ${job.id} completed`);
        });

        this.worker.on('failed', (job, err) => {
            logger.error(`[PipelineWorker] Job ${job?.id} failed:`, err);
        });

        logger.info('[PipelineWorker] Worker Initialized');
    }

    async processJob(job: Job) {
        const { runId, nodeIds, batchIndex } = job.data;
        logger.info(`[PipelineWorker] Processing Batch ${batchIndex} for ${runId} (${nodeIds.length} nodes)`);

        try {
            await this.stateManager.setState(runId, PipelineStatus.RUNNING);

            // Parallel Execution
            // In a real system, we might limit concurrency here too, but for now Promise.all
            await Promise.all(nodeIds.map(async (nodeId: string) => {
                await this.executeNode(runId, nodeId, job);
            }));

            // Batch Complete - Determine Next Step
            await this.handleBatchCompletion(runId, batchIndex);

        } catch (error) {
            logger.error(`[PipelineWorker] Batch Failed:`, error);
            await this.stateManager.setState(runId, PipelineStatus.FAILED, (error as Error).message);
            throw error;
        }
    }

    private async executeNode(runId: string, nodeId: string, job: Job) {
        // 1. Update State -> Running
        // TODO: Granular Node State in Redis (exec:{runId}:nodes:{nodeId})
        logger.info(`[PipelineWorker] Executing Node ${nodeId}`);

        // 2. Fetch Node Config
        const schemaId = await this.stateManager.getExecutionSchema(runId);
        if (!schemaId) throw new Error("Missing Schema ID");

        const schemaRow = await pipelineSchemaService.getSchemaById(schemaId) as any;
        const pipelineDef = ProtocolValidator.validate(schemaRow.schema_definition);
        const node = pipelineDef.nodes.find(n => n.id === nodeId);

        if (!node) {
            throw new Error(`Node ${nodeId} not found in schema`);
        }

        // 3. Resolve Bindings (Data Flow)
        if (node.bindings) {
            logger.info(`[PipelineWorker] Resolving bindings for ${nodeId}`);
            for (const [targetField, binding] of Object.entries(node.bindings)) {
                if (binding.sourceNode && binding.sourceOutput) {
                    const sourceData = await this.stateManager.getNodeOutput(runId, binding.sourceNode);
                    if (sourceData && sourceData[binding.sourceOutput] !== undefined) {
                        // Inject upstream data into node configuration
                        (node.data as any)[targetField] = sourceData[binding.sourceOutput];
                        logger.info(`[PipelineWorker] Injected ${targetField} from ${binding.sourceNode}.${binding.sourceOutput}`);
                    } else {
                        logger.warn(`[PipelineWorker] Missing upstream data for ${nodeId}.${targetField}`);
                    }
                }
            }
        }

        // 4. ACTUAL EXECUTION (Stub for now)
        // await NodeExecutorRegistry.execute(nodeType, nodeConfig, inputs)
        // Simulation: Just echo data and add a result field

        // Simulation delay
        await new Promise(r => setTimeout(r, 500));

        const output = {
            status: 'success',
            result: `Result from ${node.label}`,
            timestamp: Date.now(),
            // Pass through data for testing flow
            ...node.data
        };

        // 5. Store Output for downstream
        await this.stateManager.setNodeOutput(runId, nodeId, output);

        logger.info(`[PipelineWorker] Node ${nodeId} Completed and Output Stored`);
    }

    private async handleBatchCompletion(runId: string, currentBatchIndex: number) {
        // 1. Re-calculate Topology to find next batch
        // NOTE: Ideally, we pass the 'Plan' in the job data, but recalculating is safer (stateless)

        const schemaId = await this.stateManager.getExecutionSchema(runId);
        if (!schemaId) throw new Error("Missing Schema ID");

        const schemaRow = await pipelineSchemaService.getSchemaById(schemaId) as any;
        const pipelineDef = ProtocolValidator.validate(schemaRow.schema_definition);
        const batches = TopologySorter.sort(pipelineDef);

        const nextBatchIndex = currentBatchIndex + 1;

        if (nextBatchIndex < batches.length) {
            const nextBatch = batches[nextBatchIndex];
            logger.info(`[PipelineWorker] Dispatching Next Batch ${nextBatchIndex}`);
            await pipelineQueue.dispatchBatch(runId, nextBatch.nodeIds, nextBatchIndex);
        } else {
            logger.info(`[PipelineWorker] Pipeline ${runId} Completed Successfully`);
            await this.stateManager.setState(runId, PipelineStatus.COMPLETED);
        }
    }
}
