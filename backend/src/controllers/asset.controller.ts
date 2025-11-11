import type { Request, Response, NextFunction } from 'express';
import assetService from '../services/asset.service.js';
import logger from '../utils/logger.js';

/**
 * 资产查询参数类型
 */
interface AssetQueryParams {
  type?: string;
  featureId?: string;
  startDate?: string;
  endDate?: string;
  page?: string | number;
  limit?: string | number;
  userId?: string;
}

/**
 * 资产错误对象类型
 */
interface AssetError extends Error {
  errorCode?: number;
}

class AssetController {
  async getAssets(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
        return;
      }
      const { type, featureId, startDate, endDate, page, limit } = req.query as AssetQueryParams;
      const result = await assetService.getAssets({
        userId,
        type,
        featureId,
        startDate,
        endDate,
        page,
        limit
      });
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AssetController] 获取素材列表失败: ${err?.message}`, err);
      next(err);
    }
  }

  async deleteAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
        return;
      }
      const { assetId } = req.params as { assetId?: string };
      if (!assetId) {
        res.status(400).json({ success: false, error: { code: 4001, message: '缺少素材ID' } });
        return;
      }
      await assetService.deleteAsset(assetId, userId);
      res.json({ success: true, message: '素材已删除' });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      if ((err as AssetError).errorCode === 4004) {
        res.status(404).json({ success: false, error: { code: 4004, message: err.message } });
        return;
      }
      logger.error(`[AssetController] 删除素材失败: ${err?.message}`, err);
      next(err);
    }
  }

  async getAllAssets(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, type, featureId, startDate, endDate, page, limit } = req.query as AssetQueryParams;
      const result = await assetService.getAllAssets({
        ...(userId ? { userId } : {}),
        type,
        featureId,
        startDate,
        endDate,
        page,
        limit
      });
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AssetController] 管理员获取素材列表失败: ${err?.message}`, err);
      next(err);
    }
  }
}

export default new AssetController();
