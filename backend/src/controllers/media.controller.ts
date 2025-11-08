import type { Request, Response, NextFunction } from 'express';
import mediaService from '../services/media.service.js';
import logger from '../utils/logger.js';

class MediaController {
  async getSTS(req: Request, res: Response, next: NextFunction) {
    try {
      const taskId = (req.query as any).taskId as string | undefined;
      const userId = req.user?.id as string;
      const stsData = await (mediaService as any).getSTS(userId, taskId);
      logger.info(
        `[MediaController] STS密钥发放成功 userId=${userId} taskId=${(stsData as any).taskId}`
      );
      res.json({ success: true, data: stsData });
    } catch (error: any) {
      logger.error(`[MediaController] 获取STS失败: ${error?.message}`, error);
      next(error);
    }
  }

  async validateUpload(req: Request, res: Response, _next: NextFunction) {
    try {
      const { fileName, fileSize } = req.body as { fileName: string; fileSize: number };
      (mediaService as any).validateFileSize(fileSize, 10 * 1024 * 1024);
      (mediaService as any).validateFileType(fileName, ['jpg', 'jpeg', 'png']);
      res.json({ success: true, message: '文件验证通过' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { code: 4001, message: error.message } });
    }
  }
}

export default new MediaController();
