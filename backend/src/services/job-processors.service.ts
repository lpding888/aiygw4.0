import logger from '../utils/logger.js';
import taskService from './task.service.js';
import imageProcessService from './imageProcess.service.js';
import aiModelService from './aiModel.service.js';
import pipelineEngine from './pipelineEngine.service.js';
import cacheService from './cache.service.js';
import { db } from '../config/database.js';

/**
 * 任务处理器服务（TS 版）
 * 这个憨批模块负责把不同类型的任务分发到对应处理器，语义保持与旧 JS 一致。
 */
class JobProcessorsService {
  private processors = new Map<string, any>();

  /** 图像处理任务处理器 */
  async imageProcessingHandler(job: any): Promise<any> {
    const { taskId, imageUrl, params, type } = job.data ?? {};
    try {
      logger.info(`[JobProcessors] 开始图像处理任务: ${taskId}, 类型: ${type}`);
      await taskService.updateStatus(taskId, 'processing');

      let result: any;
      switch (type) {
        case 'basic_clean':
          result = await imageProcessService.processBasicClean(taskId, imageUrl, params);
          break;
        default:
          throw new Error(`不支持的图像处理类型: ${type}`);
      }

      await taskService.updateStatus(taskId, 'success', { resultUrls: result } as any);
      await (cacheService as any).deletePattern?.(`user_data:user:*:${taskId}*`);
      logger.info(`[JobProcessors] 图像处理任务完成: ${taskId}`);
      return result;
    } catch (error: any) {
      logger.error(`[JobProcessors] 图像处理任务失败: ${taskId}`, error);
      await taskService.updateStatus(taskId, 'failed', { errorMessage: error.message } as any);
      throw error;
    }
  }

  /** AI 模型任务处理器 */
  async aiProcessingHandler(job: any): Promise<any> {
    const { taskId, imageUrl, params, modelType } = job.data ?? {};
    try {
      logger.info(`[JobProcessors] 开始AI处理任务: ${taskId}, 模型: ${modelType}`);
      await taskService.updateStatus(taskId, 'processing');

      let result: any;
      switch (modelType) {
        case 'model_pose12':
          result = await aiModelService.createModelTask(taskId, imageUrl, params);
          break;
        case 'ai_enhance':
          result = await (aiModelService as any).enhanceImage?.(taskId, imageUrl, params);
          break;
        case 'ai_generate':
          result = await (aiModelService as any).generateImage?.(taskId, params);
          break;
        default:
          throw new Error(`不支持的AI模型类型: ${modelType}`);
      }

      await taskService.updateStatus(taskId, 'success', { resultUrls: result } as any);
      await (cacheService as any).deletePattern?.(`user_data:user:*:${taskId}*`);
      logger.info(`[JobProcessors] AI处理任务完成: ${taskId}`);
      return result;
    } catch (error: any) {
      logger.error(`[JobProcessors] AI处理任务失败: ${taskId}`, error);
      await taskService.updateStatus(taskId, 'failed', { errorMessage: error.message } as any);
      throw error;
    }
  }

  /** Pipeline 流程任务处理器 */
  async pipelineProcessingHandler(job: any): Promise<any> {
    const { taskId, featureId, inputData } = job.data ?? {};
    try {
      logger.info(`[JobProcessors] 开始Pipeline任务: ${taskId} feature=${featureId}`);
      await taskService.updateStatus(taskId, 'processing');
      await pipelineEngine.executePipeline(taskId, featureId, inputData);
      await taskService.updateStatus(taskId, 'success', {} as any);
      await (cacheService as any).deletePattern?.(`user_data:user:*:${taskId}*`);
      logger.info(`[JobProcessors] Pipeline任务完成: ${taskId}`);
      return { completed: true };
    } catch (error: any) {
      logger.error(`[JobProcessors] Pipeline任务失败: ${taskId}`, error);
      await taskService.updateStatus(taskId, 'failed', { errorMessage: error.message } as any);
      throw error;
    }
  }

  /** 清理任务处理器（示例） */
  async cleanupHandler(job: any): Promise<any> {
    const { olderThanHours = 24 } = job.data ?? {};
    const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000);
    const deleted = await db('notifications')
      .where('created_at', '<', cutoff)
      .andWhere('read', true)
      .del();
    logger.info(`[JobProcessors] 清理完成，删除通知记录: ${deleted}`);
    return { deleted };
  }
}

export default new JobProcessorsService();
