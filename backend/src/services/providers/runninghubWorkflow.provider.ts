import logger from '../../utils/logger.js';
import aiModelService from '../aiModel.service.js';

type RunningHubProviderRef = 'runninghub_model_pose12' | 'runninghub_custom_workflow';

export interface RunningHubWorkflowInput {
  imageUrl: string;
  params?: Record<string, unknown>;
}

export interface RunningHubWorkflowResult {
  vendorTaskId: string;
  status: 'submitted';
  message: string;
}

class RunninghubWorkflowProvider {
  constructor(private readonly providerRef: RunningHubProviderRef) {
    logger.info(`[RunninghubWorkflowProvider] 初始化 providerRef=${providerRef}`);
  }

  async execute(input: RunningHubWorkflowInput, taskId: string): Promise<RunningHubWorkflowResult> {
    const { imageUrl, params = {} } = input;

    if (!imageUrl) {
      throw new Error('缺少必要参数: imageUrl');
    }

    try {
      logger.info(
        `[RunninghubWorkflowProvider] 开始执行 taskId=${taskId} providerRef=${this.providerRef}`
      );

      let result: { vendorTaskId?: string } | undefined;

      switch (this.providerRef) {
        case 'runninghub_model_pose12':
          result = (await aiModelService.createModelTask(taskId, imageUrl, params)) as {
            vendorTaskId?: string;
          };
          break;

        case 'runninghub_custom_workflow':
          throw new Error('自定义工作流尚未实现');

        default:
          throw new Error(`未知的providerRef: ${this.providerRef}`);
      }

      const vendorTaskId = result?.vendorTaskId;
      if (!vendorTaskId) {
        throw new Error('未获取到 vendorTaskId');
      }

      logger.info(
        `[RunninghubWorkflowProvider] 提交成功 taskId=${taskId} vendorTaskId=${vendorTaskId}`
      );

      return {
        vendorTaskId,
        status: 'submitted',
        message: '任务已提交,等待轮询服务获取结果'
      };
    } catch (error) {
      const err = error as Error;
      logger.error(
        `[RunninghubWorkflowProvider] 执行失败 taskId=${taskId} error=${err.message ?? err}`,
        { taskId, error: err }
      );
      throw err;
    }
  }
}

export default RunninghubWorkflowProvider;
