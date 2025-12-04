import { nanoid } from 'nanoid';
import logger from '../utils/logger.js';
import taskService from './task.service.js';
import { createHttpClient } from '../utils/httpClient.js';

// 提示：aiModel.service.ts 已被精简。
// 之前这里包含大量的 RunningHub 硬编码逻辑（如 API URL、Key、轮询等）。
// 现在这些逻辑已迁移至通过 "GenericHttpProvider" 进行配置化调用，
// 以支持 "AI智能工厂" (n8n风格) 的灵活编排。
//
// 如果您正在寻找旧的 RunningHub 代码，请查看 git 历史或 docs/ 目录下的归档。
//
// 当前文件仅保留最小骨架以维持类型兼容性，直到 Pipeline 完全接管。

interface RunningHubResponse {
  taskId?: string;
  status?: string;
  outputs?: string[];
  data?: {
    taskId?: string;
  };
}

class AIModelService {
  /**
   * 创建 AI 模特任务 (已弃用，建议使用 Pipeline)
   * 目前仅作为占位符，防止旧代码报错。
   * 实际的 API 调用逻辑应由 Pipeline Engine 驱动。
   */
  async createModelTask(
    taskId: string,
    inputImageUrl: string,
    params: Record<string, unknown> = {}
  ) {
    logger.warn('[AIModelService] createModelTask 被调用，但核心逻辑已迁移至 Pipeline 系统。');
    logger.info('[AIModelService] 这只是一个模拟响应，实际任务请通过 Pipeline 编排执行。');

    // 模拟一个处理过程，以免前端立即报错
    // 在完全切换到 Pipeline 之前，这里只能返回一个模拟状态

    // 自动更新为失败，提示用户
    await taskService.updateStatus(taskId, 'failed', {
      errorMessage: '系统升级中：请使用新的 AI 工作流编排功能来执行此任务。'
    });

    return { taskId, runningHubTaskId: 'deprecated', status: 'failed' };
  }

  // 下面的方法已全部移除，因为它们包含硬编码的 RunningHub 逻辑
  // async submitToRunningHub(...)
  // async queryRunningHubStatus(...)
  // async fetchResults(...)
  // ...
}

export default new AIModelService();
