import type { Request, Response, NextFunction } from 'express';
import assetService from '../services/asset.service.js';
import logger from '../utils/logger.js';

class AssetController {
  async getAssets(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id as string;
      const { type, featureId, startDate, endDate, page, limit } = req.query as Record<string, any>;
      const result = await (assetService as any).getAssets({
        userId,
        type,
        featureId,
        startDate,
        endDate,
        page,
        limit
      });
      res.json({ success: true, ...result });
    } catch (error: any) {
      logger.error(`[AssetController] 获取素材列表失败: ${error?.message}`, error);
      next(error);
    }
  }

  async deleteAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id as string;
      const { assetId } = req.params as { assetId?: string };
      if (!assetId) {
        res.status(400).json({ success: false, error: { code: 4001, message: '缺少素材ID' } });
        return;
      }
      await (assetService as any).deleteAsset(assetId, userId);
      res.json({ success: true, message: '素材已删除' });
    } catch (error: any) {
      if ((error as any).errorCode === 4004) {
        res.status(404).json({ success: false, error: { code: 4004, message: error.message } });
        return;
      }
      logger.error(`[AssetController] 删除素材失败: ${error?.message}`, error);
      next(error);
    }
  }

  async getAllAssets(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, type, featureId, startDate, endDate, page, limit } = req.query as Record<
        string,
        any
      >;
      const result = await (assetService as any).getAllAssets({
        userId,
        type,
        featureId,
        startDate,
        endDate,
        page,
        limit
      });
      res.json({ success: true, ...result });
    } catch (error: any) {
      logger.error(`[AssetController] 管理员获取素材列表失败: ${error?.message}`, error);
      next(error);
    }
  }
}

export default new AssetController();
