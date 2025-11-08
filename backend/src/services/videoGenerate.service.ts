import hunyuanService from './hunyuan.service.js';
import kuaiService from './kuai.service.js';
import logger from '../utils/logger.js';

type VideoTaskParams = {
  model?: string;
  [key: string]: unknown;
};

type KuaiTaskResult = {
  vendorTaskId: string;
  status: string;
  enhancedPrompt?: string;
};

type VideoTaskResult = KuaiTaskResult & {
  shootingScript: string;
};

class VideoGenerateService {
  async processVideoTask(
    taskId: string,
    imageUrl: string,
    params: VideoTaskParams = {}
  ): Promise<VideoTaskResult> {
    try {
      logger.info('[VideoGenerateService] 开始处理视频任务', {
        taskId,
        imageUrl,
        params
      });

      const shootingScript = await this.generateShootingScript(imageUrl, params);
      const kuaiResult = await this.createKuaiVideoTask(shootingScript, imageUrl, params);

      logger.info('[VideoGenerateService] 视频任务处理完成', {
        taskId,
        vendorTaskId: kuaiResult.vendorTaskId,
        status: kuaiResult.status
      });

      return {
        vendorTaskId: kuaiResult.vendorTaskId,
        status: kuaiResult.status,
        shootingScript,
        enhancedPrompt: kuaiResult.enhancedPrompt
      };
    } catch (error) {
      const err = error as Error;
      logger.error('[VideoGenerateService] 视频任务处理失败', {
        taskId,
        imageUrl,
        error: err.message
      });
      throw err;
    }
  }

  async generateShootingScript(imageUrl: string, params: VideoTaskParams): Promise<string> {
    try {
      logger.info('[VideoGenerateService] 生成拍摄脚本', { imageUrl });

      const script = await hunyuanService.generateShootingScript(imageUrl, params);

      if (!hunyuanService.validateScript(script)) {
        throw new Error('生成的拍摄脚本质量不符合要求');
      }

      logger.info('[VideoGenerateService] 拍摄脚本生成成功', {
        imageUrl,
        scriptLength: script.length
      });

      return script;
    } catch (error) {
      const err = error as Error;
      logger.error('[VideoGenerateService] 拍摄脚本生成失败', {
        imageUrl,
        error: err.message
      });
      throw new Error(`拍摄脚本生成失败: ${err.message}`);
    }
  }

  async createKuaiVideoTask(
    script: string,
    imageUrl: string,
    params: VideoTaskParams
  ): Promise<KuaiTaskResult> {
    try {
      logger.info('[VideoGenerateService] 创建KUAI视频任务', {
        imageUrl,
        scriptLength: script.length,
        model: params.model
      });

      const result = await kuaiService.createVideoTask(script, imageUrl, params);

      logger.info('[VideoGenerateService] KUAI视频任务创建成功', {
        vendorTaskId: result.vendorTaskId,
        status: result.status
      });

      return result;
    } catch (error) {
      const err = error as Error;
      logger.error('[VideoGenerateService] KUAI视频任务创建失败', {
        imageUrl,
        error: err.message
      });
      throw new Error(`视频任务创建失败: ${err.message}`);
    }
  }

  async pollVideoStatus(vendorTaskId: string) {
    try {
      return await kuaiService.queryVideoStatus(vendorTaskId);
    } catch (error) {
      const err = error as Error;
      logger.error('[VideoGenerateService] 轮询视频状态失败', {
        vendorTaskId,
        error: err.message
      });
      throw err;
    }
  }

  isTimeout(createdAt: Date, timeoutHours = 2): boolean {
    return kuaiService.isTimeout(createdAt, timeoutHours);
  }

  getErrorMessage(errorType: string): string {
    return kuaiService.getErrorMessage(errorType);
  }
}

const videoGenerateService = new VideoGenerateService();
export default videoGenerateService;
