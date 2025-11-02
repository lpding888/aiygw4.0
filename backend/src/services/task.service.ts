import { db } from '../db';
import { nanoid } from 'nanoid';
import { quotaService } from './quota.service';
import { pipelineEngine } from './pipelineEngine.service';
import { logger } from '../utils/logger';

export interface TaskCreateParams {
  type: string;
  inputImageUrl?: string;
  params?: Record<string, any>;
  featureId?: string;
  inputData?: Record<string, any>;
}

export interface Task {
  id: string;
  userId: string;
  type?: string;
  featureId?: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  inputUrl?: string;
  input_data?: string;
  params?: string;
  resultUrls?: string;
  errorMessage?: string;
  errorReason?: string;
  eligible_for_refund: boolean;
  refunded: boolean;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}

/**
 * 任务服务 - 处理AI处理任务的创建、查询和状态管理
 * 使用Saga模式管理配额事务
 */
export class TaskService {
  /**
   * 创建任务（使用Saga模式）
   * @param userId - 用户ID
   * @param type - 任务类型
   * @param inputImageUrl - 输入图片URL
   * @param params - 任务参数
   */
  async create(userId: string, type: string, inputImageUrl?: string, params: Record<string, any> = {}): Promise<any> {
    let taskId: string;
    
    try {
      const validTypes = ['basic_clean', 'model_pose12', 'video_generate'];
      if (!validTypes.includes(type)) {
        throw { errorCode: 4001, message: '无效的任务类型' };
      }

      const quotaCost = this.getQuotaCost(type);

      // 生成任务ID
      taskId = nanoid();
      
      // Saga阶段1: 预留配额
      await quotaService.reserve(userId, taskId, quotaCost);

      // Saga阶段2: 创建任务记录
      const now = new Date();
      await db('tasks').insert({
        id: taskId,
        userId,
        type,
        status: 'pending',
        inputUrl: inputImageUrl || '',
        params: JSON.stringify(params),
        eligible_for_refund: true,
        refunded: false,
        created_at: now,
        updated_at: now,
      });

      // Saga阶段3: 确认扣减配额
      await quotaService.confirm(taskId);

      logger.info(`[TaskService] 任务创建成功 taskId=${taskId} userId=${userId} type=${type} quotaCost=${quotaCost}`);

      // 异步处理视频生成任务(在事务成功后)
      if (type === 'video_generate' && inputImageUrl) {
        this.processVideoGenerateTask(taskId, inputImageUrl, params)
          .catch(err => {
            logger.error(`[TaskService] 视频任务异步处理失败: ${err.message}`, { taskId });
            this.handleVideoTaskFailure(taskId, userId, err.message);
          });
      }

      return {
        taskId,
        type,
        status: 'pending',
        createdAt: now.toISOString(),
      };
    } catch (error) {
      logger.error(`[TaskService] 创建任务失败: ${error.message}`, { userId, type, error });
      
      // Saga补偿: 如果任务创建失败，取消配额预留
      if (taskId) {
        try {
          await quotaService.cancel(taskId);
          logger.info(`[TaskService] 配额预留已取消 taskId=${taskId}`);
        } catch (cancelError) {
          logger.error(`[TaskService] 取消配额预留失败: ${cancelError.message}`, { taskId });
        }
      }
      
      throw error;
    }
  }

  /**
   * 基于功能卡片创建任务（使用Saga模式）
   * @param userId - 用户ID
   * @param featureId - 功能ID
   * @param inputData - 输入数据
   */
  async createByFeature(userId: string, featureId: string, inputData: Record<string, any> = {}): Promise<any> {
    let taskId: string;
    
    try {
      // 1. 获取功能定义
      const feature = await db('feature_definitions')
        .where('feature_id', featureId)
        .whereNull('deleted_at')
        .first();

      if (!feature) {
        throw { errorCode: 4004, message: '功能不存在' };
      }

      if (!feature.is_enabled) {
        throw { errorCode: 4003, message: '功能已禁用' };
      }

      // 2. 生成任务ID
      taskId = nanoid();
      
      // Saga阶段1: 预留配额
      await quotaService.reserve(userId, taskId, feature.quota_cost);

      // Saga阶段2: 创建任务记录
      const now = new Date();
      await db('tasks').insert({
        id: taskId,
        userId,
        feature_id: featureId,
        status: 'pending',
        input_data: JSON.stringify(inputData),
        eligible_for_refund: true,
        refunded: false,
        created_at: now,
        updated_at: now,
        // 保留旧字段兼容性
        type: featureId,
        inputUrl: inputData.imageUrl || '',
        params: null
      });

      // Saga阶段3: 确认扣减配额
      await quotaService.confirm(taskId);

      logger.info(
        `[TaskService] Feature任务创建成功 taskId=${taskId} userId=${userId} ` +
        `featureId=${featureId} quotaCost=${feature.quota_cost}`
      );

      // 异步执行Pipeline（不阻塞响应）
      pipelineEngine.executePipeline(taskId, featureId, inputData)
        .catch(err => {
          logger.error(
            `[TaskService] Pipeline执行异常 taskId=${taskId} error=${err.message}`,
            { taskId, featureId, error: err }
          );
        });

      return {
        taskId,
        featureId,
        status: 'pending',
        createdAt: now.toISOString(),
        quotaCost: feature.quota_cost
      };
    } catch (error) {
      logger.error(
        `[TaskService] 创建Feature任务失败: ${error.message}`,
        { userId, featureId, error }
      );
      
      // Saga补偿: 如果任务创建失败，取消配额预留
      if (taskId) {
        try {
          await quotaService.cancel(taskId);
          logger.info(`[TaskService] 配额预留已取消 taskId=${taskId}`);
        } catch (cancelError) {
          logger.error(`[TaskService] 取消配额预留失败: ${cancelError.message}`, { taskId });
        }
      }
      
      throw error;
    }
  }

  /**
   * 更新任务状态
   * @param taskId - 任务ID
   * @param status - 新状态
   * @param data - 额外数据
   */
  async updateStatus(taskId: string, status: string, data: Record<string, any> = {}): Promise<boolean> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date()
      };

      // 如果是完成或失败状态,记录完成时间
      if (status === 'success' || status === 'failed') {
        updateData.completed_at = new Date();
      }

      // 如果有结果URLs
      if (data.resultUrls) {
        updateData.resultUrls = JSON.stringify(data.resultUrls);
      }

      // 如果有错误信息
      if (data.errorMessage) {
        updateData.errorMessage = data.errorMessage;
      }

      await db('tasks')
        .where('id', taskId)
        .update(updateData);

      logger.info(`[TaskService] 任务状态更新 taskId=${taskId} status=${status}`);

      // 如果任务失败,使用Saga模式返还配额
      if (status === 'failed') {
        const task = await db('tasks').where('id', taskId).first();
        if (task && task.eligible_for_refund && !task.refunded) {
          try {
            await quotaService.cancel(taskId);
            logger.info(`[TaskService] 任务失败,配额已返还 taskId=${taskId} userId=${task.userId}`);
          } catch (error) {
            logger.error(`[TaskService] 返还配额失败 taskId=${taskId} error=${error.message}`);
          }
        }
      }

      return true;
    } catch (error) {
      logger.error(`[TaskService] 更新任务状态失败: ${error.message}`, { taskId, status, error });
      throw error;
    }
  }

  /**
   * 获取任务详情
   * @param taskId - 任务ID
   * @param userId - 用户ID(权限验证)
   */
  async get(taskId: string, userId: string): Promise<any> {
    try {
      const task = await db('tasks')
        .where('id', taskId)
        .first();

      if (!task) {
        throw { errorCode: 4004, message: '任务不存在' };
      }

      // 权限检查:只能查看自己的任务
      if (task.userId !== userId) {
        throw { errorCode: 4003, message: '无权访问该任务' };
      }

      // 解析params和resultUrls
      const params = task.params ? JSON.parse(task.params) : {};
      const resultUrls = task.resultUrls ? JSON.parse(task.resultUrls) : [];

      return {
        id: task.id,
        type: task.type,
        status: task.status,
        inputImageUrl: task.inputImageUrl,
        params,
        resultUrls,
        coverUrl: task.coverUrl,
        thumbnailUrl: task.thumbnailUrl,
        errorMessage: task.errorMessage,
        errorReason: task.errorReason,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        completedAt: task.completed_at
      };
    } catch (error) {
      logger.error(`[TaskService] 获取任务失败: ${error.message}`, { taskId, userId, error });
      throw error;
    }
  }

  /**
   * 获取任务类型的配额消耗
   * @param type - 任务类型
   */
  getQuotaCost(type: string): number {
    const key = `QUOTA_COST_${type.toUpperCase()}`;
    return parseInt(process.env[key] || '1', 10);
  }

  /**
   * 处理视频生成任务
   * @param taskId - 任务ID
   * @param inputImageUrl - 输入图片URL
   * @param params - 任务参数
   */
  private async processVideoGenerateTask(taskId: string, inputImageUrl: string, params: Record<string, any>): Promise<void> {
    try {
      logger.info(`[TaskService] 开始处理视频生成任务 taskId=${taskId}`);

      // 更新任务状态为processing
      await this.updateStatus(taskId, 'processing');

      // 这里应该调用视频生成服务，但为了简化，我们先不实现
      // const videoResult = await videoGenerateService.processVideoTask(
      //   taskId,
      //   inputImageUrl,
      //   params
      // );

      // 保存vendorTaskId到数据库
      // await db('tasks')
      //   .where('id', taskId)
      //   .update({
      //     vendorTaskId: videoResult.vendorTaskId,
      //     updated_at: new Date()
      //   });

      logger.info(`[TaskService] 视频生成任务处理完成 taskId=${taskId}`);
    } catch (error) {
      logger.error(`[TaskService] 视频生成任务处理失败 taskId=${taskId} error=${error.message}`);
      throw error;
    }
  }

  /**
   * 处理视频任务失败
   * @param taskId - 任务ID
   * @param userId - 用户ID
   * @param errorMessage - 错误信息
   */
  private async handleVideoTaskFailure(taskId: string, userId: string, errorMessage: string): Promise<void> {
    try {
      // 更新任务状态为失败（updateStatus内部会自动返还配额）
      await this.updateStatus(taskId, 'failed', {
        errorMessage: errorMessage
      });

      logger.info(`[TaskService] 视频任务失败处理完成 taskId=${taskId} userId=${userId}`);
    } catch (error) {
      logger.error(`[TaskService] 视频任务失败处理异常 taskId=${taskId} error=${error.message}`);
    }
  }
}

export const taskService = new TaskService();