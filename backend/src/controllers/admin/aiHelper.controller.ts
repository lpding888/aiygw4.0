import type { Request, Response, NextFunction } from 'express';
import aiHelperService from '../../services/aiHelper.service.js';
import logger from '../../utils/logger.js';

class AiHelperController {
  async getConfig(_req: Request, res: Response, next: NextFunction) {
    try {
      const config = await aiHelperService.getConfigSummary();
      res.json({ success: true, data: config });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AiHelper] 获取配置失败: ${err.message}`, err);
      next(err);
    }
  }

  async saveConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        enabled,
        apiUrl,
        apiKey,
        defaultModel,
        allowedModels,
        systemPrompt,
        resetApiKey
      } = req.body as Record<string, unknown>;

      await aiHelperService.saveConfig(
        {
          enabled: typeof enabled === 'boolean' ? enabled : undefined,
          apiUrl: typeof apiUrl === 'string' ? apiUrl : null,
          apiKey: typeof apiKey === 'string' ? apiKey : undefined,
          defaultModel: typeof defaultModel === 'string' ? defaultModel : null,
          allowedModels: Array.isArray(allowedModels) ? (allowedModels as string[]) : undefined,
          systemPrompt: typeof systemPrompt === 'string' ? systemPrompt : null,
          resetApiKey: Boolean(resetApiKey)
        },
        req.user?.id ?? null
      );

      const summary = await aiHelperService.getConfigSummary();

      res.json({
        success: true,
        message: 'AI助手配置已更新',
        data: summary
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AiHelper] 保存配置失败: ${err.message}`, err);
      next(err);
    }
  }

  async testConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const { apiUrl, apiKey } = req.body as { apiUrl?: string; apiKey?: string };
      const result = await aiHelperService.testConnection({
        apiUrl,
        apiKey
      });
      res.json({ success: true, data: result });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AiHelper] 连通性测试失败: ${err.message}`, err);
      res.status(400).json({
        success: false,
        error: {
          code: 'AI_HELPER_TEST_FAILED',
          message: err.message
        }
      });
    }
  }

  async listModels(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await aiHelperService.testConnection();
      res.json({ success: true, data: result });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AiHelper] 获取模型列表失败: ${err.message}`, err);
      res.status(400).json({
        success: false,
        error: {
          code: 'AI_HELPER_MODELS_FAILED',
          message: err.message
        }
      });
    }
  }
}

export default new AiHelperController();
