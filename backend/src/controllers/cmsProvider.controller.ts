import type { Request, Response, NextFunction } from 'express';
import cmsProviderService from '../services/cmsProvider.service.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import type { AuthenticatedRequest } from '../types/cms-provider.types.js';
import type { Knex } from 'knex';

class CmsProviderController {
  async getProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        type,
        status,
        enabled,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query as Record<string, string>;
      const result = await cmsProviderService.getProviders({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        type,
        status,
        enabled: enabled !== undefined ? enabled === 'true' : undefined,
        search,
        sortBy,
        sortOrder
      });
      res.json({ success: true, data: result, requestId: (req as AuthenticatedRequest).id });
    } catch (error) {
      logger.error('[CmsProviderController] Get providers failed:', error);
      next(error);
    }
  }

  async getProviderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const provider = await cmsProviderService.getProviderById(id);
      res.json({ success: true, data: provider, requestId: (req as AuthenticatedRequest).id });
    } catch (error) {
      logger.error('[CmsProviderController] Get provider by ID failed:', error);
      next(error);
    }
  }

  async createProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权操作');
      }
      const providerData = { ...(req.body as Record<string, unknown>), created_by: userId };
      const provider = await cmsProviderService.createProvider(providerData, userId);
      res.status(201).json({
        success: true,
        data: provider,
        message: '供应商创建成功',
        requestId: (req as AuthenticatedRequest).id
      });
    } catch (error) {
      logger.error('[CmsProviderController] Create provider failed:', error);
      next(error);
    }
  }

  async updateProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权操作');
      }
      const updateData = { ...(req.body as Record<string, unknown>), updated_by: userId };
      const provider = await cmsProviderService.updateProvider(id, updateData, userId);
      res.json({
        success: true,
        data: provider,
        message: '供应商更新成功',
        requestId: (req as AuthenticatedRequest).id
      });
    } catch (error) {
      logger.error('[CmsProviderController] Update provider failed:', error);
      next(error);
    }
  }

  async deleteProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权操作');
      }
      await cmsProviderService.deleteProvider(id);
      res.json({ success: true, message: '供应商删除成功', requestId: (req as AuthenticatedRequest).id });
    } catch (error) {
      logger.error('[CmsProviderController] Delete provider failed:', error);
      next(error);
    }
  }

  async testProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权操作');
      }
      const testResult = await cmsProviderService.testProvider(id, userId);
      res.json({
        success: true,
        data: testResult,
        message: testResult.success ? '连接测试成功' : '连接测试失败',
        requestId: (req as AuthenticatedRequest).id
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
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权操作');
      }
      const results = await cmsProviderService.testAllProviders(userId);
      res.json({
        success: true,
        data: results,
        message: `批量测试完成: ${results.success} 成功, ${results.failed} 失败`,
        requestId: (req as AuthenticatedRequest).id
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
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权操作');
      }
      const provider = await cmsProviderService.updateProvider(id, { enabled }, userId);
      res.json({ success: true, data: provider, message: `供应商已${enabled ? '启用' : '禁用'}` });
    } catch (error) {
      logger.error('[CmsProviderController] Toggle provider failed:', error);
      next(error);
    }
  }
}

export default new CmsProviderController();
