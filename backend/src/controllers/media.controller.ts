import type { Request, Response, NextFunction } from 'express';
import mediaService from '../services/media.service.js';
import logger from '../utils/logger.js';

interface QueryWithTaskId {
  taskId?: string;
}

interface STSData {
  taskId?: string;
  [key: string]: unknown;
}

class MediaController {
  async getSTS(req: Request, res: Response, next: NextFunction) {
    try {
      const taskId = (req.query as QueryWithTaskId).taskId as string | undefined;
      const userId = req.user?.id as string;
      const stsData = await mediaService.getSTS(userId, taskId);
      logger.info(
        `[MediaController] STS密钥发放成功 userId=${userId} taskId=${(stsData as STSData).taskId}`
      );
      res.json({ success: true, data: stsData });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[MediaController] 获取STS失败: ${err?.message}`, err);
      next(err);
    }
  }

  async validateUpload(req: Request, res: Response, _next: NextFunction) {
    try {
      const { fileName, fileSize } = req.body as { fileName: string; fileSize: number };
      mediaService.validateFileSize(fileSize, 10 * 1024 * 1024);
      mediaService.validateFileType(fileName, ['jpg', 'jpeg', 'png']);
      res.json({ success: true, message: '文件验证通过' });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(400).json({ success: false, error: { code: 4001, message: err.message } });
    }
  }
}

export default new MediaController();
