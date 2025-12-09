import { db } from '../config/database.js';
import quotaService from './quota.service.js';
import websocketService from './websocket.service.js';
import logger from '../utils/logger.js';
import type {
  Task,
  TaskUpdateData,
  TaskWebSocketData
} from '../types/task.types.js';

type UpdateStatusPayload = {
  resultUrls?: string[];
  errorMessage?: string;
};

/**
 * 任务状态网关
 * 薄层封装任务状态更新、WebSocket 推送与配额返还，便于其他服务解耦。
 */
class TaskStatusGateway {
  private getQuotaCost(type: string): number {
    const key = `QUOTA_COST_${String(type).toUpperCase()}`;
    return Number.parseInt(process.env[key] || '1', 10);
  }

  async updateStatus(taskId: string, status: string, data: UpdateStatusPayload = {}): Promise<void> {
    try {
      const updateData: TaskUpdateData = {
        status: status as 'pending' | 'processing' | 'success' | 'failed',
        updated_at: new Date()
      };

      if (status === 'success' || status === 'failed') {
        updateData.completed_at = new Date();
      }
      if (data.resultUrls) updateData.resultUrls = JSON.stringify(data.resultUrls);
      if (data.errorMessage) updateData.errorMessage = data.errorMessage;

      await db('tasks').where('id', taskId).update(updateData);

      logger.info(`[TaskStatusGateway] 任务状态更新 taskId=${taskId} status=${status}`);

      const task = (await db('tasks').where('id', taskId).first()) as Task | undefined;
      if (task) {
        try {
          const taskData: TaskWebSocketData = {
            id: task.id,
            type: task.type,
            status: task.status,
            inputUrl: task.inputUrl,
            resultUrls: task.resultUrls ? JSON.parse(task.resultUrls) : null,
            errorMessage: task.errorMessage,
            createdAt: task.created_at,
            updatedAt: task.updated_at,
            completedAt: task.completed_at
          };

          websocketService.pushTaskStatusChange(task.userId, taskId, status, taskData);
        } catch (wsError) {
          const err = wsError as Error;
          logger.warn(`[TaskStatusGateway] WebSocket推送失败: ${err.message}`, { taskId });
        }
      }

      if (status === 'failed' && task && task.eligible_for_refund && !task.refunded) {
        try {
          await quotaService.cancel(taskId);
          await db('tasks').where('id', taskId).update({ refunded: true });
          const refundAmount = this.getQuotaCost(task.type);
          logger.info(
            `[TaskStatusGateway] 任务失败,配额已返还 taskId=${taskId} userId=${task.userId} amount=${refundAmount}`
          );
        } catch (cancelError) {
          const err = cancelError as Error;
          logger.error(`[TaskStatusGateway] 配额返还失败: ${err.message}`, { taskId });
        }
      }
    } catch (error) {
      const err = error as Error;
      logger.error(`[TaskStatusGateway] 更新任务状态失败: ${err.message}`, { taskId, status, error });
      throw err;
    }
  }
}

const taskStatusGateway = new TaskStatusGateway();
export default taskStatusGateway;
