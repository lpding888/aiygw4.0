/**
 * RAG摄取Worker - BullMQ队列处理
 * 艹，这个憨批Worker负责解析→切块→嵌入→入库全链路！
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { redisConfig } from '../../config/redis.js';
import db from '../../db/index.js';
import logger from '../../utils/logger.js';
import { parser } from './parser.js';
import { chunker, type Chunk } from './chunker.js';
import { aiGateway } from '../../services/ai-gateway.service.js';

const QUEUE_NAME = 'kb-ingest';
const JOB_NAME = 'kb-ingest.process';

const createConnection = () => {
  interface RedisConfigExtended {
    host?: string;
    port?: string | number;
    password?: string;
    db?: string | number;
    maxRetriesPerRequest?: number;
  }

  return new IORedis({
    host: redisConfig.host,
    port: Number(redisConfig.port ?? 6379),
    password: redisConfig.password,
    db: Number(redisConfig.db ?? 3),
    maxRetriesPerRequest: null // BullMQ要求必须为null
  });
};

const ingestQueue = new Queue<IngestJobData>(QUEUE_NAME, {
  connection: createConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

const ingestEvents = new QueueEvents(QUEUE_NAME, { connection: createConnection() });
ingestEvents.on('completed', ({ jobId }) => {
  logger.info(`[IngestWorker] 队列任务完成 jobId=${jobId}`);
});
ingestEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error(`[IngestWorker] 队列任务失败 jobId=${jobId}`, { failedReason });
});

type JobProcessor = Job<IngestJobData>;

const ingestWorker = new Worker<IngestJobData>(QUEUE_NAME, async (job) => processIngestJob(job), {
  connection: createConnection(),
  concurrency: 5
});

ingestWorker.on('error', (error) => {
  logger.error('[IngestWorker] Worker 运行失败', error);
});

/**
 * 摄取任务数据
 */
export interface IngestJobData {
  documentId: string;
  userId: string;
  content: string;
  format: 'markdown' | 'html' | 'pdf' | 'text';
  kbId?: string;
  options?: {
    chunkSize?: number;
    overlap?: number;
  };
}

async function processIngestJob(job: JobProcessor) {
  const { documentId, userId, content, format, options = {} } = job.data;

  try {
    logger.info(`[IngestWorker] 开始处理文档: documentId=${documentId}`);
    await job.updateProgress(5);

    await db('kb_documents').where('id', documentId).update({
      status: 'processing',
      updated_at: new Date()
    });

    await job.updateProgress(20);
    const normalizedFormat: 'markdown' | 'html' | 'pdf' =
      format === 'html' || format === 'pdf' ? format : 'markdown';
    const parseResult = await parser.parse(content, normalizedFormat);
    logger.info(
      `[IngestWorker] 解析完成: documentId=${documentId} length=${parseResult.metadata.length}`
    );

    await job.updateProgress(40);
    const chunks = chunker.chunk(parseResult.text, {
      chunkSize: options.chunkSize,
      overlap: options.overlap
    });
    logger.info(`[IngestWorker] 切块完成: documentId=${documentId} chunks=${chunks.length}`);

    await job.updateProgress(60);
    const chunkRecords = chunks.map(
      (chunk: Chunk): Record<string, unknown> => ({
        document_id: documentId,
        chunk_index: chunk.index,
        text: chunk.text,
        start_pos: chunk.metadata.start,
        end_pos: chunk.metadata.end,
        length: chunk.metadata.length,
        embedding_status: 'pending',
        metadata: JSON.stringify({
          format,
          parseMetadata: parseResult.metadata
        }),
        created_at: new Date(),
        updated_at: new Date()
      })
    );

    await db('kb_chunks').insert(chunkRecords);

    await job.updateProgress(80);
    await scheduleEmbedding(documentId, chunks);

    await job.updateProgress(100);
    await db('kb_documents').where('id', documentId).update({
      status: 'completed',
      chunk_count: chunks.length,
      updated_at: new Date()
    });

    logger.info(`[IngestWorker] 处理完成: documentId=${documentId} chunks=${chunks.length}`);

    return {
      success: true,
      documentId,
      chunkCount: chunks.length
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`[IngestWorker] 处理失败: documentId=${documentId}`, err);

    await db('kb_documents').where('id', documentId).update({
      status: 'failed',
      error_message: err.message,
      updated_at: new Date()
    });

    throw error;
  }
}

async function scheduleEmbedding(documentId: string, chunks: Chunk[]): Promise<void> {
  logger.info(`[IngestWorker] 调度向量化: documentId=${documentId} chunks=${chunks.length}`);

  interface AiGatewayWithEmbed {
    embed?: (data: unknown) => unknown;
  }

  if (aiGateway && typeof (aiGateway as unknown as AiGatewayWithEmbed).embed === 'function') {
    logger.debug('[IngestWorker] aiGateway embed 能力已注册，等待后续实现');
  }
}

export async function addIngestJob(data: IngestJobData): Promise<void> {
  await ingestQueue.add(JOB_NAME, data, {
    jobId: data.documentId,
    removeOnComplete: true,
    attempts: 3
  });

  logger.info(`[IngestWorker] 添加摄取任务: documentId=${data.documentId}`);
}

export async function getQueueStats(): Promise<{
  queue: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  timestamp: string;
}> {
  const [waiting, active, completed, failed] = await Promise.all([
    ingestQueue.getWaitingCount(),
    ingestQueue.getActiveCount(),
    ingestQueue.getCompletedCount(),
    ingestQueue.getFailedCount()
  ]);

  return {
    queue: QUEUE_NAME,
    counts: { waiting, active, completed, failed },
    timestamp: new Date().toISOString()
  };
}

export async function shutdownIngestQueue(): Promise<void> {
  await Promise.allSettled([ingestWorker.close(), ingestEvents.close(), ingestQueue.close()]);
}

export default ingestQueue;
