/**
 * RAG摄取Worker - BullMQ队列处理
 * 艹，这个憨批Worker负责解析→切块→嵌入→入库全链路！
 */

import Queue from 'bull';
import db from '../../db';
import logger from '../../utils/logger';
import { parser } from './parser';
import { chunker } from './chunker';
import aiGateway from '../../services/ai-gateway.service';

/**
 * 摄取任务数据
 */
interface IngestJobData {
  documentId: string;
  userId: string;
  content: string;
  format: 'markdown' | 'html' | 'pdf';
  options?: {
    chunkSize?: number;
    overlap?: number;
  };
}

/**
 * 创建摄取队列
 */
export const ingestQueue = new Queue('kb-ingest', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3, // 最大重试3次
    backoff: {
      type: 'exponential',
      delay: 2000, // 初始延迟2秒
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/**
 * 处理摄取任务
 */
ingestQueue.process(5, async (job) => {
  const { documentId, userId, content, format, options = {} } = job.data as IngestJobData;

  try {
    logger.info(`[IngestWorker] 开始处理文档: documentId=${documentId}`);

    // 更新文档状态为processing
    await db('kb_documents')
      .where('id', documentId)
      .update({
        status: 'processing',
        updated_at: new Date(),
      });

    // 1. 解析文档
    job.progress(20);
    const parseResult = await parser.parse(content, format);

    logger.info(
      `[IngestWorker] 解析完成: documentId=${documentId} ` +
      `length=${parseResult.metadata.length}`
    );

    // 2. 切块
    job.progress(40);
    const chunks = chunker.chunk(parseResult.text, {
      chunkSize: options.chunkSize,
      overlap: options.overlap,
    });

    logger.info(
      `[IngestWorker] 切块完成: documentId=${documentId} ` +
      `chunks=${chunks.length}`
    );

    // 3. 保存chunks到数据库
    job.progress(60);
    const chunkRecords = chunks.map((chunk) => ({
      document_id: documentId,
      chunk_index: chunk.index,
      text: chunk.text,
      start_pos: chunk.metadata.start,
      end_pos: chunk.metadata.end,
      length: chunk.metadata.length,
      embedding_status: 'pending',
      metadata: JSON.stringify({
        format,
        parseMetadata: parseResult.metadata,
      }),
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await db('kb_chunks').insert(chunkRecords);

    // 4. 向量化（异步处理，不阻塞）
    job.progress(80);
    await scheduleEmbedding(documentId, chunks);

    // 5. 更新文档状态为completed
    job.progress(100);
    await db('kb_documents')
      .where('id', documentId)
      .update({
        status: 'completed',
        chunk_count: chunks.length,
        updated_at: new Date(),
      });

    logger.info(
      `[IngestWorker] 处理完成: documentId=${documentId} ` +
      `chunks=${chunks.length}`
    );

    return {
      success: true,
      documentId,
      chunkCount: chunks.length,
    };

  } catch (error: any) {
    logger.error(
      `[IngestWorker] 处理失败: documentId=${documentId}`,
      error
    );

    // 更新文档状态为failed
    await db('kb_documents')
      .where('id', documentId)
      .update({
        status: 'failed',
        error_message: error.message,
        updated_at: new Date(),
      });

    throw error;
  }
});

/**
 * 调度向量化任务
 */
async function scheduleEmbedding(documentId: string, chunks: any[]): Promise<void> {
  // 简化实现：这里应该调用embedding服务
  // 实际项目中应该创建单独的embedding队列
  logger.info(`[IngestWorker] 调度向量化: documentId=${documentId} chunks=${chunks.length}`);

  // TODO: 调用embedding API生成向量
  // const embeddings = await aiGateway.embed(chunks.map(c => c.text));

  // TODO: 保存向量到向量数据库
  // await vectorDB.upsert(embeddings);
}

/**
 * 添加摄取任务
 */
export async function addIngestJob(data: IngestJobData): Promise<void> {
  await ingestQueue.add(data, {
    jobId: data.documentId, // 幂等性保证
  });

  logger.info(`[IngestWorker] 添加摄取任务: documentId=${data.documentId}`);
}

/**
 * 获取队列统计
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const [waiting, active, completed, failed] = await Promise.all([
    ingestQueue.getWaitingCount(),
    ingestQueue.getActiveCount(),
    ingestQueue.getCompletedCount(),
    ingestQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

export default ingestQueue;
