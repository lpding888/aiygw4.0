import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger.js';
import toolGeneratorService, {
  ToolGeneratorError
} from '../../services/toolGenerator.service.js';

class ToolGeneratorController {
  /**
   * AI 自动从文档生成工具
   * POST /admin/tools/generate
   */
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { docText, category } = req.body;

      if (!docText || typeof docText !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请提供 docText (API文档内容)'
          }
        });
        return;
      }

      // 调用服务进行生成
      const feature = await toolGeneratorService.generateFromDoc(docText, category);

      res.json({
        success: true,
        data: feature,
        message: 'AI 工具积木生成成功！'
      });
    } catch (error) {
      const err = error as Error;
      logger.error(`[ToolGenerator] 生成失败: ${err.message}`, error);

      if (error instanceof ToolGeneratorError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: 'GENERATION_VALIDATION_FAILED',
            message: err.message
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: `生成失败: ${err.message}`
        }
      });
    }
  }
}

export default new ToolGeneratorController();
