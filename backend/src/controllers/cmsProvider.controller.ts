import type { Request, Response, NextFunction } from 'express';
import cmsProviderService = require('../services/cmsProvider.service.js');
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';

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
      const result = await (cmsProviderService as any).getProviders({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        type,
        status,
        enabled: enabled !== undefined ? enabled === 'true' : undefined,
        search,
        sortBy,
        sortOrder
      });
      res.json({ success: true, data: result, requestId: (req as any).id });
    } catch (error) {
      logger.error('[CmsProviderController] Get providers failed:', error as any);
      next(error);
    }
  }

  async getProviderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const provider = await (cmsProviderService as any).getProviderById(id);
      res.json({ success: true, data: provider, requestId: (req as any).id });
    } catch (error) {
      logger.error('[CmsProviderController] Get provider by ID failed:', error as any);
      next(error);
    }
  }

  async createProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id as string;
      const providerData = { ...(req.body as Record<string, unknown>), created_by: userId };
      const provider = await (cmsProviderService as any).createProvider(providerData, userId);
      res.status(201).json({
        success: true,
        data: provider,
        message: '供应商创建成功',
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[CmsProviderController] Create provider failed:', error as any);
      next(error);
    }
  }

  async updateProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = (req as any).user?.id as string;
      const updateData = { ...(req.body as Record<string, unknown>), updated_by: userId };
      const provider = await (cmsProviderService as any).updateProvider(id, updateData, userId);
      res.json({
        success: true,
        data: provider,
        message: '供应商更新成功',
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[CmsProviderController] Update provider failed:', error as any);
      next(error);
    }
  }

  async deleteProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = (req as any).user?.id as string;
      await (cmsProviderService as any).deleteProvider(id, userId);
      res.json({ success: true, message: '供应商删除成功', requestId: (req as any).id });
    } catch (error) {
      logger.error('[CmsProviderController] Delete provider failed:', error as any);
      next(error);
    }
  }

  async testProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = (req as any).user?.id as string;
      const testResult = await (cmsProviderService as any).testProvider(id, userId);
      res.json({
        success: true,
        data: testResult,
        message: testResult.success ? '连接测试成功' : '连接测试失败',
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[CmsProviderController] Test provider failed:', error as any);
      next(error);
    }
  }

  async getProviderStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await (cmsProviderService as any).getProviderStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('[CmsProviderController] Get provider stats failed:', error as any);
      next(error);
    }
  }

  async testAllProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id as string;
      const results = await (cmsProviderService as any).testAllProviders(userId);
      res.json({
        success: true,
        data: results,
        message: `批量测试完成: ${results.success} 成功, ${results.failed} 失败`,
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[CmsProviderController] Batch test providers failed:', error as any);
      next(error);
    }
  }

  async getProviderTypes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { db } = await import('../config/database.js');
      const types = await (db as any)('provider_endpoints')
        .distinct('type')
        .select('type')
        .whereNotNull('type')
        .orderBy('type');
      res.json({ success: true, data: types.map((t: any) => t.type) });
    } catch (error) {
      logger.error('[CmsProviderController] Get provider types failed:', error as any);
      next(error);
    }
  }

  async toggleProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { enabled } = req.body as { enabled?: boolean };
      const userId = (req as any).user?.id as string;
      const provider = await (cmsProviderService as any).updateProvider(id, { enabled }, userId);
      res.json({ success: true, data: provider, message: `供应商已${enabled ? '启用' : '禁用'}` });
    } catch (error) {
      logger.error('[CmsProviderController] Toggle provider failed:', error as any);
      next(error);
    }
  }
}

export default new CmsProviderController();
