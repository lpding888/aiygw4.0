import type { Request, Response, NextFunction } from 'express';
import cmsFeatureService = require('../services/cmsFeature.service.js');
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';

class CmsFeatureController {
  async getFeatures(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        category,
        status,
        enabled,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query as Record<string, string>;
      const result = await (cmsFeatureService as any).getFeatures({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        category,
        status,
        enabled: enabled !== undefined ? enabled === 'true' : undefined,
        search,
        sortBy,
        sortOrder
      });
      res.json({ success: true, data: result, requestId: (req as any).id });
    } catch (error) {
      logger.error('[CmsFeatureController] Get features failed:', error as any);
      next(error);
    }
  }

  async getFeatureById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const feature = await (cmsFeatureService as any).getFeatureById(id);
      res.json({ success: true, data: feature, requestId: (req as any).id });
    } catch (error) {
      logger.error('[CmsFeatureController] Get feature by ID failed:', error as any);
      next(error);
    }
  }

  async createFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id as string;
      const featureData = { ...(req.body as Record<string, unknown>), created_by: userId };
      const feature = await (cmsFeatureService as any).createFeature(featureData, userId);
      res.status(201).json({
        success: true,
        data: feature,
        message: '功能创建成功',
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Create feature failed:', error as any);
      next(error);
    }
  }

  async updateFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = (req as any).user?.id as string;
      const updateData = { ...(req.body as Record<string, unknown>), updated_by: userId };
      const feature = await (cmsFeatureService as any).updateFeature(id, updateData, userId);
      res.json({
        success: true,
        data: feature,
        message: '功能更新成功',
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Update feature failed:', error as any);
      next(error);
    }
  }

  async deleteFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = (req as any).user?.id as string;
      await (cmsFeatureService as any).deleteFeature(id, userId);
      res.json({ success: true, message: '功能删除成功', requestId: (req as any).id });
    } catch (error) {
      logger.error('[CmsFeatureController] Delete feature failed:', error as any);
      next(error);
    }
  }

  async publishFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = (req as any).user?.id as string;
      const feature = await (cmsFeatureService as any).publishFeature(id, userId);
      res.json({
        success: true,
        data: feature,
        message: '功能发布成功',
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Publish feature failed:', error as any);
      next(error);
    }
  }

  async rollbackFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { version } = req.body as { version?: string };
      const userId = (req as any).user?.id as string;
      if (!version) throw AppError.custom(ERROR_CODES.MISSING_PARAMETERS, '版本号不能为空');
      const feature = await (cmsFeatureService as any).rollbackFeature(id, version, userId);
      res.json({
        success: true,
        data: feature,
        message: `功能已回滚到版本 ${version}`,
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Rollback feature failed:', error as any);
      next(error);
    }
  }

  async getFeatureHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { page = '1', limit = '20' } = req.query as Record<string, string>;
      const result = await (cmsFeatureService as any).getFeatureHistory(id, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });
      res.json({ success: true, data: result, requestId: (req as any).id });
    } catch (error) {
      logger.error('[CmsFeatureController] Get feature history failed:', error as any);
      next(error);
    }
  }

  async batchUpdateFeatures(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ids, updates } = req.body as { ids?: string[]; updates?: Record<string, unknown> };
      const userId = (req as any).user?.id as string;
      if (!Array.isArray(ids) || ids.length === 0)
        throw AppError.custom(ERROR_CODES.MISSING_PARAMETERS, '功能ID列表不能为空');
      const result = await (cmsFeatureService as any).batchUpdateFeatures(ids, updates, userId);
      res.json({
        success: true,
        data: result,
        message: `批量更新完成: ${result.success.length} 成功, ${result.failed.length} 失败`,
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Batch update features failed:', error as any);
      next(error);
    }
  }

  async toggleFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { enabled } = req.body as { enabled?: boolean };
      const userId = (req as any).user?.id as string;
      const feature = await (cmsFeatureService as any).updateFeature(id, { enabled }, userId);
      res.json({
        success: true,
        data: feature,
        message: `功能已${enabled ? '启用' : '禁用'}`,
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Toggle feature failed:', error as any);
      next(error);
    }
  }

  async getFeatureCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { db } = await import('../config/database.js');
      const categories = await (db as any)('cms_features')
        .distinct('category')
        .select('category')
        .whereNotNull('category')
        .orderBy('category');
      res.json({
        success: true,
        data: categories.map((c: any) => c.category),
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Get feature categories failed:', error as any);
      next(error);
    }
  }
}

export default new CmsFeatureController();
