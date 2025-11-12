import type { Request, Response, NextFunction } from 'express';
import cmsFeatureService from '../services/cmsFeature.service.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import type { Knex } from 'knex';
import type {
  FeatureStatus,
  CreateFeatureData,
  UpdateFeatureData
} from '../types/cms-feature.types.js';

const parseFeatureStatus = (value: unknown): FeatureStatus | undefined => {
  if (value === 'draft' || value === 'published' || value === 'archived') {
    return value;
  }
  return undefined;
};

const parseSortOrder = (value: unknown): 'asc' | 'desc' | undefined => {
  if (value === 'asc' || value === 'desc') {
    return value;
  }
  return undefined;
};

const parseBooleanFlag = (value: unknown): boolean | undefined => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (typeof value === 'boolean') return value;
  return undefined;
};

const requireUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权操作');
  }
  return userId;
};

class CmsFeatureController {
  async getFeatures(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as Record<string, string | undefined>;
      const page = Number.parseInt(query.page ?? '1', 10) || 1;
      const limit = Number.parseInt(query.limit ?? '20', 10) || 20;
      const sortBy = query.sortBy ?? 'created_at';
      const sortOrder = parseSortOrder(query.sortOrder) ?? 'desc';
      const result = await cmsFeatureService.getFeatures({
        page,
        limit,
        category: query.category,
        status: parseFeatureStatus(query.status),
        enabled: parseBooleanFlag(query.enabled),
        search: query.search,
        sortBy,
        sortOrder
      });
      res.json({ success: true, data: result, requestId: req.id });
    } catch (error) {
      logger.error('[CmsFeatureController] Get features failed:', error);
      next(error);
    }
  }

  async getFeatureById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const feature = await cmsFeatureService.getFeatureById(id);
      res.json({ success: true, data: feature, requestId: req.id });
    } catch (error) {
      logger.error('[CmsFeatureController] Get feature by ID failed:', error);
      next(error);
    }
  }

  async createFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const payload = req.body as Partial<CreateFeatureData>;
      if (!payload.key || typeof payload.key !== 'string' || !payload.key.trim()) {
        res
          .status(400)
          .json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'key不能为空' } });
        return;
      }
      if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
        res
          .status(400)
          .json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name不能为空' } });
        return;
      }
      const featureData: CreateFeatureData = {
        key: payload.key,
        name: payload.name,
        description: payload.description,
        category: payload.category,
        config: payload.config,
        menu: payload.menu,
        metadata: payload.metadata,
        enabled: payload.enabled
      };
      const feature = await cmsFeatureService.createFeature(featureData, userId);
      res.status(201).json({
        success: true,
        data: feature,
        message: '功能创建成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Create feature failed:', error);
      next(error);
    }
  }

  async updateFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = requireUserId(req);
      const updateData = req.body as UpdateFeatureData;
      const feature = await cmsFeatureService.updateFeature(id, updateData, userId);
      res.json({
        success: true,
        data: feature,
        message: '功能更新成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Update feature failed:', error);
      next(error);
    }
  }

  async deleteFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = requireUserId(req);
      await cmsFeatureService.deleteFeature(id, userId);
      res.json({ success: true, message: '功能删除成功', requestId: req.id });
    } catch (error) {
      logger.error('[CmsFeatureController] Delete feature failed:', error);
      next(error);
    }
  }

  async publishFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = requireUserId(req);
      const feature = await cmsFeatureService.publishFeature(id, userId);
      res.json({
        success: true,
        data: feature,
        message: '功能发布成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Publish feature failed:', error);
      next(error);
    }
  }

  async rollbackFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { version } = req.body as { version?: string };
      const userId = requireUserId(req);
      if (!version) throw AppError.custom(ERROR_CODES.MISSING_PARAMETERS, '版本号不能为空');
      const feature = await cmsFeatureService.rollbackFeature(id, version, userId);
      res.json({
        success: true,
        data: feature,
        message: `功能已回滚到版本 ${version}`,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Rollback feature failed:', error);
      next(error);
    }
  }

  async getFeatureHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { page = '1', limit = '20' } = req.query as Record<string, string>;
      const result = await cmsFeatureService.getFeatureHistory(id, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });
      res.json({ success: true, data: result, requestId: req.id });
    } catch (error) {
      logger.error('[CmsFeatureController] Get feature history failed:', error);
      next(error);
    }
  }

  async batchUpdateFeatures(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ids, updates } = req.body as { ids?: string[]; updates?: UpdateFeatureData };
      const userId = requireUserId(req);
      if (!Array.isArray(ids) || ids.length === 0)
        throw AppError.custom(ERROR_CODES.MISSING_PARAMETERS, '功能ID列表不能为空');
      const result = await cmsFeatureService.batchUpdateFeatures(ids, updates ?? {}, userId);
      res.json({
        success: true,
        data: result,
        message: `批量更新完成: ${result.success.length} 成功, ${result.failed.length} 失败`,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Batch update features failed:', error);
      next(error);
    }
  }

  async toggleFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { enabled } = req.body as { enabled?: boolean };
      const userId = requireUserId(req);
      const feature = await cmsFeatureService.updateFeature(id, { enabled }, userId);
      res.json({
        success: true,
        data: feature,
        message: `功能已${enabled ? '启用' : '禁用'}`,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Toggle feature failed:', error);
      next(error);
    }
  }

  async getFeatureCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { db } = await import('../config/database.js');
      const categories = (await (db as Knex)('cms_features')
        .distinct('category')
        .select('category')
        .whereNotNull('category')
        .orderBy('category')) as Array<{ category: string }>;
      res.json({
        success: true,
        data: categories.map((c) => c.category),
        requestId: req.id
      });
    } catch (error) {
      logger.error('[CmsFeatureController] Get feature categories failed:', error);
      next(error);
    }
  }
}

export default new CmsFeatureController();
