import logger from '../../utils/logger.js';
import imageProcessService from '../imageProcess.service.js';

type ProviderRef = 'tencent_ci_basic_clean' | 'tencent_ci_advanced';

export interface SyncImageProcessInput {
  imageUrl: string;
  params?: Record<string, unknown>;
}

export interface SyncImageProcessResult {
  resultUrls: string[];
  metadata: Record<string, unknown>;
}

/**
 * 同步图片处理 Provider（目前主要复用 imageProcessService 内的 Tencent CI 能力）
 */
class SyncImageProcessProvider {
  constructor(private readonly providerRef: ProviderRef) {
    logger.info(`[SyncImageProcessProvider] 初始化 providerRef=${providerRef}`);
  }

  async execute(input: SyncImageProcessInput, taskId: string): Promise<SyncImageProcessResult> {
    const { imageUrl, params = {} } = input;

    if (!imageUrl) {
      throw new Error('缺少必要参数: imageUrl');
    }

    try {
      logger.info(
        `[SyncImageProcessProvider] 开始执行 taskId=${taskId} providerRef=${this.providerRef}`
      );

      let result:
        | {
            resultUrls?: string[];
            metadata?: Record<string, unknown>;
          }
        | undefined;

      switch (this.providerRef) {
        case 'tencent_ci_basic_clean':
          result = (await imageProcessService.processBasicClean(taskId, imageUrl, params)) as {
            resultUrls?: string[];
            metadata?: Record<string, unknown>;
          };
          break;

        case 'tencent_ci_advanced':
          throw new Error('高级图片处理尚未实现');

        default:
          throw new Error(`未知的providerRef: ${this.providerRef}`);
      }

      logger.info(`[SyncImageProcessProvider] 执行成功 taskId=${taskId}`);

      return {
        resultUrls: result?.resultUrls ?? [],
        metadata: result?.metadata ?? {}
      };
    } catch (error) {
      const err = error as Error;
      logger.error(
        `[SyncImageProcessProvider] 执行失败 taskId=${taskId} error=${err.message ?? err}`,
        { taskId, error: err }
      );
      throw err;
    }
  }
}

export default SyncImageProcessProvider;
