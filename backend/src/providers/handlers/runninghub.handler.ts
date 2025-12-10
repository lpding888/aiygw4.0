/**
 * RunningHub Provider
 * 艹，用于调用 RunningHub 工作流平台的 Provider！
 * 当前为占位实现，等待后续完善
 */

import { BaseProvider } from '../base/base-provider.js';
import { ExecContext, ExecResult, ProviderErrorCode, ProviderError } from '../types.js';

/**
 * RunningHub 输入参数接口
 */
export interface RunningHubInput {
  /** 工作流ID */
  workflowId: string;

  /** API密钥 */
  apiKey: string;

  /** 工作流参数 */
  params: Record<string, unknown>;

  /** 轮询间隔（毫秒，默认5000，最小1000） */
  pollInterval?: number;

  /** 最大轮询超时（毫秒，默认300000 - 5分钟，最小10000） */
  maxPollTime?: number;

  /** 自定义 API 基础URL（可选） */
  baseUrl?: string;
}

/**
 * RunningHub 结果数据接口
 */
export interface RunningHubResultPayload {
  message: string;
  workflowId: string;
  params: Record<string, unknown>;
  pollInterval: number;
  maxPollTime: number;
}

/**
 * RunningHub Provider 实现
 */
export class RunningHubProvider extends BaseProvider {
  public readonly key: string = 'runninghub';
  public readonly name: string = 'RunningHub工作流';

  constructor(retryPolicy?: any, logger?: any) {
    super(retryPolicy, logger);
  }

  /**
   * 参数校验
   */
  validate(input: unknown): string | null {
    // 检查输入是否为对象
    if (!input || typeof input !== 'object') {
      return '输入参数必须是对象';
    }

    const data = input as any;

    // 检查必填字段：workflowId
    if (!data.workflowId || typeof data.workflowId !== 'string') {
      return '缺少或无效的workflowId字段';
    }

    // 检查必填字段：apiKey
    if (!data.apiKey || typeof data.apiKey !== 'string') {
      return '缺少或无效的apiKey字段';
    }

    // 检查必填字段：params
    if (!data.params || typeof data.params !== 'object' || Array.isArray(data.params)) {
      return '缺少或无效的params字段';
    }

    // 检查可选字段：pollInterval
    if (data.pollInterval !== undefined) {
      if (typeof data.pollInterval !== 'number' || data.pollInterval < 1000) {
        return 'pollInterval必须是数字且不小于1000ms';
      }
    }

    // 检查可选字段：maxPollTime
    if (data.maxPollTime !== undefined) {
      if (typeof data.maxPollTime !== 'number' || data.maxPollTime < 10000) {
        return 'maxPollTime必须是数字且不小于10000ms';
      }
    }

    return null;
  }

  /**
   * 执行工作流（占位实现）
   */
  protected async doExecute(context: ExecContext): Promise<ExecResult<RunningHubResultPayload>> {
    const { taskId, input } = context;
    const data = input as RunningHubInput;
    const { workflowId, params, pollInterval = 5000, maxPollTime = 300000 } = data;

    try {
      this.logger.info('[RunningHub] RunningHub工作流执行（占位）', {
        taskId,
        workflowId
      });

      // 警告：当前为占位实现
      this.logger.warn('[RunningHub] RunningHubProvider尚未实现，返回占位数据', {
        taskId,
        workflowId
      });

      // 返回占位结果
      const resultPayload: RunningHubResultPayload = {
        message: 'RunningHubProvider尚未实现，这是占位返回数据',
        workflowId,
        params,
        pollInterval,
        maxPollTime
      };

      return {
        success: true,
        data: resultPayload
      };
    } catch (error: any) {
      this.logger.error('[RunningHub] 执行失败', {
        taskId,
        workflowId,
        error: error.message
      });

      return {
        success: false,
        error: {
          code: ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED,
          message: `RunningHub执行失败: ${error.message}`
        }
      };
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    // 占位实现：始终返回健康
    return true;
  }
}
