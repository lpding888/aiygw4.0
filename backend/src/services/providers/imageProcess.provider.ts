import logger from '../../utils/logger.js';

export interface ImageProcessInput {
  imageUrl: string;
  operations: Array<{
    action: 'crop' | 'resize' | 'format' | 'watermark' | 'remove_bg';
    params?: Record<string, string | number>;
  }>;
}

export interface ImageProcessResult {
  resultUrl: string;
}

class ImageProcessProvider {
  constructor(private readonly providerRef: string) {
    logger.info(`[ImageProcessProvider] 初始化 providerRef=${providerRef}`);
  }

  async execute(input: ImageProcessInput, taskId: string): Promise<ImageProcessResult> {
    const { imageUrl, operations = [] } = input;

    if (!imageUrl) {
      throw new Error('缺少必要参数: imageUrl');
    }

    try {
      logger.info(`[ImageProcessProvider] 开始处理图片 taskId=${taskId}`, { operations });

      // 腾讯云 CI 的处理逻辑其实就是拼接 URL 参数
      // 原始 URL: https://bucket.cos.region.myqcloud.com/image.jpg
      // 处理后 URL: https://bucket.cos.region.myqcloud.com/image.jpg?imageMogr2/thumbnail/500x/format/webp

      let processParams = '';
      const ops: string[] = [];

      for (const op of operations) {
        switch (op.action) {
          case 'resize':
            if (op.params?.width) {
              ops.push(`imageMogr2/thumbnail/${op.params.width}x`);
            }
            break;
          case 'format':
            if (op.params?.type) {
              ops.push(`imageMogr2/format/${op.params.type}`);
            }
            break;
          case 'remove_bg':
            // 腾讯云抠图通常是 ci-process=body-segmentation
            // 注意：这是一个高级功能，需要在 COS 控制台开启
            processParams += '&ci-process=body-segmentation';
            break;
          default:
            logger.warn(`[ImageProcessProvider] 未知的操作类型: ${op.action}`);
        }
      }

      if (ops.length > 0) {
        processParams += (processParams ? '|' : '?') + ops.join('|');
      }

      // 简单拼接，实际生产可能需要处理 URL 已有 query 的情况
      const finalUrl = imageUrl.includes('?') 
        ? `${imageUrl}${processParams.replace('?', '&')}`
        : `${imageUrl}${processParams}`;

      logger.info(`[ImageProcessProvider] 处理完成 resultUrl=${finalUrl}`);

      return {
        resultUrl: finalUrl
      };
    } catch (error) {
      const err = error as Error;
      logger.error(`[ImageProcessProvider] 执行失败 taskId=${taskId}`, error);
      throw err;
    }
  }
}

export default ImageProcessProvider;
