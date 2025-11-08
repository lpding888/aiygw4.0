import logger from '../../utils/logger.js';

type ProviderRef = 'scf_watermark' | 'scf_compress' | 'scf_custom';

export interface ScfPostProcessInput {
  resultUrls: string[];
  params?: Record<string, unknown>;
}

export interface ScfPostProcessResult {
  resultUrls: string[];
  processed: boolean;
  providerRef: ProviderRef;
}

class ScfPostProcessProvider {
  constructor(private readonly providerRef: ProviderRef) {
    logger.info(`[ScfPostProcessProvider] 初始化 providerRef=${providerRef}`);
  }

  async execute(input: ScfPostProcessInput, taskId: string): Promise<ScfPostProcessResult> {
    const { resultUrls } = input;

    if (!Array.isArray(resultUrls) || resultUrls.length === 0) {
      throw new Error('缺少必要参数: resultUrls');
    }

    try {
      logger.info(
        `[ScfPostProcessProvider] 开始执行 taskId=${taskId} providerRef=${this.providerRef}`
      );

      let processedUrls: string[];

      switch (this.providerRef) {
        case 'scf_watermark':
          logger.warn('[ScfPostProcessProvider] 水印功能尚未实现,直接返回原图');
          processedUrls = resultUrls;
          break;
        case 'scf_compress':
          logger.warn('[ScfPostProcessProvider] 压缩功能尚未实现,直接返回原图');
          processedUrls = resultUrls;
          break;
        case 'scf_custom':
          throw new Error('自定义云函数尚未实现');
        default:
          throw new Error(`未知的providerRef: ${this.providerRef}`);
      }

      logger.info(`[ScfPostProcessProvider] 执行成功 taskId=${taskId}`);

      return {
        resultUrls: processedUrls,
        processed: true,
        providerRef: this.providerRef
      };
    } catch (error) {
      const err = error as Error;
      logger.error(
        `[ScfPostProcessProvider] 执行失败 taskId=${taskId} error=${err.message ?? err}`,
        { taskId, error: err }
      );
      throw err;
    }
  }
}

export default ScfPostProcessProvider;
