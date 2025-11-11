import type { Request, Response, NextFunction } from 'express';
import cmsProviderService from '../services/cmsProvider.service.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import type {
  ProviderStatus,
  CreateProviderData,
  UpdateProviderData
} from '../types/cms-provider.types.js';
import type { Knex } from 'knex';

const parseProviderStatus = (value: unknown): ProviderStatus | undefined => {
  if (value === 'active' || value === 'inactive' || value === 'error' || value === 'testing') {
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

class CmsProviderController {
  async getProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as Record<string, string | undefined>;
      const page = Number.parseInt(query.page ?? '1', 10) || 1;
      const limit = Number.parseInt(query.limit ?? '20', 10) || 20;
      const sortBy = query.sortBy ?? 'created_at';
      const sortOrder = parseSortOrder(query.sortOrder) ?? 'desc';
      const result = await cmsProviderService.getProviders({
        page,
        limit,
        type: query.type,
        status: parseProviderStatus(query.status),
        enabled: parseBooleanFlag(query.enabled),
        search: query.search,
        sortBy,
        sortOrder
      });
      res.json({ success: true, data: result, requestId: req.id });
    } catch (error) {
      logger.error('[CmsProviderController] Get providers failed:', error);
      next(error);
    }
  }

  async getProviderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const provider = await cmsProviderService.getProviderById(id);
      res.json({ success: true, data: provider, requestId: req.id });
    } catch (error) {
      logger.error('[CmsProviderController] Get provider by ID failed:', error);
      next(error);
    }
  }

  async createProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const payload = req.body as CreateProviderData;
      const providerData: CreateProviderData & { created_by: string } = {
        ...payload,
        created_by: userId
      };
      const provider = await cmsProviderService.createProvider(providerData, userId);
      res.status(201).json({
        success: true,
        data: provider,
        message: '供应商创建成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[CmsProviderController] Create provider failed:', error);
      next(error);
    }
  }

  async updateProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = requireUserId(req);
      const updateData: UpdateProviderData & { updated_by: string } = {
        ...(req.body as UpdateProviderData),
        updated_by: userId
      };
      const provider = await cmsProviderService.updateProvider(id, updateData, userId);
      res.json({
        success: true,
        data: provider,
        message: '供应商更新成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[CmsProviderController] Update provider failed:', error);
      next(error);
    }
  }

  async deleteProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      requireUserId(req);
      await cmsProviderService.deleteProvider(id);
      res.json({ success: true, message: '供应商删除成功', requestId: req.id });
    } catch (error) {
      logger.error('[CmsProviderController] Delete provider failed:', error);
      next(error);
    }
  }

  async testProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = requireUserId(req);
      const testResult = await cmsProviderService.testProvider(id, userId);
      res.json({
        success: true,
        data: testResult,
        message: testResult.success ? '连接测试成功' : '连接测试失败',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[CmsProviderController] Test provider failed:', error);
      next(error);
    }
  }

  async getProviderStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await cmsProviderService.getProviderStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('[CmsProviderController] Get provider stats failed:', error);
      next(error);
    }
  }

  async testAllProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const results = await cmsProviderService.testAllProviders(userId);
      res.json({
        success: true,
        data: results,
        message: `批量测试完成: ${results.success} 成功, ${results.failed} 失败`,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[CmsProviderController] Batch test providers failed:', error);
      next(error);
    }
  }

  async getProviderTypes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { db } = await import('../config/database.js');
      const types = (await (db as Knex)('provider_endpoints')
        .distinct('type')
        .select('type')
        .whereNotNull('type')
        .orderBy('type')) as Array<{ type: string }>;
      res.json({ success: true, data: types.map((t) => t.type) });
    } catch (error) {
      logger.error('[CmsProviderController] Get provider types failed:', error);
      next(error);
    }
  }

  async toggleProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { enabled } = req.body as { enabled?: boolean };
      const userId = requireUserId(req);
      const provider = await cmsProviderService.updateProvider(id, { enabled }, userId);
      res.json({ success: true, data: provider, message: `供应商已${enabled ? '启用' : '禁用'}` });
    } catch (error) {
      logger.error('[CmsProviderController] Toggle provider failed:', error);
      next(error);
    }
  }
}

export default new CmsProviderController();
