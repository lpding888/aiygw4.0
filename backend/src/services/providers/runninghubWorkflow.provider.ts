import logger from '../../utils/logger.js';
import { createHttpClient } from '../../utils/httpClient.js';
import systemConfigService from '../systemConfig.service.js';

// 通用的 RunningHub 输入参数
export interface RunningHubWorkflowInput {
  // 必填：RunningHub 的应用 ID (对应 webappId)
  workflowId: string;
  // 必填：API 节点参数列表
  nodeInfoList: Array<{
    nodeId: string;
    fieldName: string;
    fieldValue: string;
  }>;
  // 可选：超时时间 (毫秒)
  timeout?: number;
}

// 通用的 RunningHub 输出结果
export interface RunningHubWorkflowResult {
  taskId: string;
  status: 'success' | 'failed';
  outputs: string[]; // 结果图片/视频 URL 列表
  message?: string;
}

interface RunningHubResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

interface CreateTaskResponse {
  taskId: string;
}

interface TaskStatusResponse {
  taskId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  progress: number;
}

interface TaskOutputResponse {
  outputs: string[];
}

class RunninghubWorkflowProvider {
  private readonly httpClient;
  private apiKey: string | null = null;
  private apiUrl: string = 'https://www.runninghub.cn/task/openapi';

  constructor(private readonly providerRef: string) {
    logger.info(`[RunninghubWorkflowProvider] 初始化 providerRef=${providerRef}`);
    this.httpClient = createHttpClient({
      serviceName: 'runninghub',
      timeoutMs: 30000,
      maxRetries: 2
    });
  }

  /**
   * 获取 API Key (支持缓存)
   */
  private async getApiKey(): Promise<string> {
    if (this.apiKey) return this.apiKey;

    const key = await systemConfigService.get('runninghub_api_key');
    if (!key || typeof key !== 'string') {
      throw new Error('RunningHub API Key 未配置');
    }
    this.apiKey = key.trim();
    return this.apiKey;
  }

  /**
   * 执行工作流
   */
  async execute(input: RunningHubWorkflowInput, taskId: string): Promise<RunningHubWorkflowResult> {
    const { workflowId, nodeInfoList, timeout = 180000 } = input;

    if (!workflowId) {
      throw new Error('缺少必要参数: workflowId');
    }

    try {
      const apiKey = await this.getApiKey();
      logger.info(`[RunningHub] 开始创建任务 taskId=${taskId} workflowId=${workflowId}`, {
        nodeInfoList
      });

      // 1. 创建任务
      const createRes = await this.httpClient.post<RunningHubResponse<CreateTaskResponse>>(
        `${this.apiUrl}/create`,
        {
          webappId: workflowId,
          nodeInfoList,
          apiKey
        }
      );

      if (createRes.code !== 0 || !createRes.data?.taskId) {
        throw new Error(`任务创建失败: ${createRes.msg}`);
      }

      const rhTaskId = createRes.data.taskId;
      logger.info(`[RunningHub] 任务已提交 rhTaskId=${rhTaskId}`);

      // 2. 轮询等待结果 (暂时使用轮询，后续可升级为 Callback)
      return await this.pollTaskStatus(rhTaskId, apiKey, timeout);
    } catch (error) {
      const err = error as Error;
      logger.error(`[RunningHub] 执行异常 taskId=${taskId} error=${err.message}`, error);
      throw err;
    }
  }

  /**
   * 轮询任务状态
   */
  private async pollTaskStatus(
    rhTaskId: string,
    apiKey: string,
    timeoutMs: number
  ): Promise<RunningHubWorkflowResult> {
    const startTime = Date.now();
    const interval = 3000; // 3秒轮询一次

    while (Date.now() - startTime < timeoutMs) {
      // 检查状态
      const statusRes = await this.httpClient.post<RunningHubResponse<TaskStatusResponse>>(
        `${this.apiUrl}/status`,
        { taskId: rhTaskId, apiKey }
      );

      if (statusRes.code !== 0) {
        throw new Error(`获取状态失败: ${statusRes.msg}`);
      }

      const status = statusRes.data.status;
      logger.debug(`[RunningHub] 任务状态 rhTaskId=${rhTaskId} status=${status}`);

      if (status === 'SUCCESS') {
        // 成功，获取结果
        const outputRes = await this.httpClient.post<RunningHubResponse<TaskOutputResponse>>(
          `${this.apiUrl}/outputs`,
          { taskId: rhTaskId, apiKey }
        );

        return {
          taskId: rhTaskId,
          status: 'success',
          outputs: outputRes.data?.outputs || []
        };
      }

      if (status === 'FAILED' || status === 'TIMEOUT') {
        throw new Error(`RunningHub 任务失败: ${status}`);
      }

      // 继续等待
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`任务等待超时 (${timeoutMs}ms)`);
  }
}

export default RunninghubWorkflowProvider;
