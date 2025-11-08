import type { Request, Response, NextFunction } from 'express';
import taskService from '../services/task.service.js';
import imageProcessService from '../services/imageProcess.service.js';
import aiModelService from '../services/aiModel.service.js';
import paginationService from '../services/pagination.service.js';
import logger from '../utils/logger.js';

class TaskController {
  async createByFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { featureId, inputData } = (req.body ?? {}) as { featureId?: string; inputData?: any };
      const userId = (req as any).user?.id as string;
      if (!featureId) {
        res
          .status(400)
          .json({ success: false, error: { code: 4001, message: '缺少必要参数:featureId' } });
        return;
      }
      if (!inputData || typeof inputData !== 'object') {
        res
          .status(400)
          .json({ success: false, error: { code: 4001, message: 'inputData必须是一个对象' } });
        return;
      }
      const task = await taskService.createByFeature(userId, featureId, inputData);
      logger.info(
        `[TaskController] Feature任务创建成功 taskId=${(task as any).taskId} userId=${userId} featureId=${featureId}`
      );
      res.json({ success: true, data: task });
    } catch (error) {
      logger.error(
        `[TaskController] 创建Feature任务失败: ${(error as any)?.message}`,
        error as any
      );
      const e: any = error;
      if (e?.errorCode === 4029) {
        res.status(429).json({
          success: false,
          error: { code: e.errorCode, message: e.message, rateLimitInfo: e.rateLimitInfo }
        });
        return;
      }
      if (e?.errorCode) {
        res.status(400).json({ success: false, error: { code: e.errorCode, message: e.message } });
        return;
      }
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, inputImageUrl, params } = (req.body ?? {}) as {
        type?: string;
        inputImageUrl?: string;
        params?: any;
      };
      const userId = (req as any).user?.id as string;
      if (!type || !inputImageUrl) {
        res.status(400).json({
          success: false,
          error: { code: 4001, message: '缺少必要参数:type和inputImageUrl' }
        });
        return;
      }
      const task = await taskService.create(userId, type, inputImageUrl, params);
      logger.info(`[TaskController] 任务创建成功 taskId=${(task as any).taskId} userId=${userId}`);
      if (type === 'basic_clean') {
        imageProcessService
          .processBasicClean((task as any).taskId, inputImageUrl, params)
          .catch((err: any) => {
            logger.error(`[TaskController] 异步处理失败: ${err.message}`, {
              taskId: (task as any).taskId
            });
          });
      }
      if (type === 'model_pose12') {
        aiModelService
          .createModelTask((task as any).taskId, inputImageUrl, params)
          .catch((err: any) => {
            logger.error(`[TaskController] AI模特任务创建失败: ${err.message}`, {
              taskId: (task as any).taskId
            });
          });
      }
      res.json({ success: true, data: task });
    } catch (error) {
      logger.error(`[TaskController] 创建任务失败: ${(error as any)?.message}`, error as any);
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { taskId } = req.params as { taskId: string };
      const task = await taskService.get(taskId);
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id as string;
      const result = await taskService.list(userId, req.query as any);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { taskId } = req.params as { taskId: string };
      const { status, resultUrls, errorMessage } = (req.body ?? {}) as {
        status?: string;
        resultUrls?: string[];
        errorMessage?: string;
      };
      if (!status) {
        res
          .status(400)
          .json({ success: false, error: { code: 4001, message: '缺少必要参数:status' } });
        return;
      }
      await taskService.updateStatus(taskId, status, { resultUrls, errorMessage });
      res.json({ success: true, message: '任务状态更新成功' });
    } catch (error) {
      logger.error(`[TaskController] 更新任务状态失败: ${(error as any)?.message}`, error as any);
      next(error);
    }
  }

  async adminList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if ((req as any).user?.role !== 'admin') {
        res.status(403).json({ success: false, error: { code: 4003, message: '需要管理员权限' } });
        return;
      }
      const {
        page = '1',
        limit = '20',
        status,
        type,
        userId,
        startDate,
        endDate
      } = req.query as any;
      const filters: any = {};
      if (status) filters.status = status;
      if (type) filters.type = type;
      if (userId) filters.userId = userId;
      if (startDate || endDate) {
        filters.created_at = function (this: any) {
          if (startDate && endDate) this.whereBetween('created_at', [startDate, endDate]);
          else if (startDate) this.where('created_at', '>=', startDate);
          else if (endDate) this.where('created_at', '<=', endDate);
        };
      }
      const result = await paginationService.getTaskList(filters, {
        page: Number(page),
        limit: Math.min(Number(limit), 100)
      });
      res.json({ success: true, data: result.data, pagination: result.pageInfo });
    } catch (error) {
      logger.error(
        `[TaskController] 管理员获取任务列表失败: ${(error as any)?.message}`,
        error as any
      );
      next(error);
    }
  }

  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if ((req as any).user?.role !== 'admin') {
        res.status(403).json({ success: false, error: { code: 4003, message: '需要管理员权限' } });
        return;
      }
      const { q: searchTerm, page = '1', limit = '20', status, type } = req.query as any;
      if (!searchTerm || String(searchTerm).trim().length === 0) {
        res
          .status(400)
          .json({ success: false, error: { code: 4001, message: '搜索关键词不能为空' } });
        return;
      }
      const filters: any = {};
      if (status) filters.status = status;
      if (type) filters.type = type;
      const result = await paginationService.searchTasks(String(searchTerm).trim(), {
        page: Number(page),
        limit: Math.min(Number(limit), 100),
        where: filters
      });
      res.json({
        success: true,
        data: result.data,
        pagination: result.pageInfo,
        searchTerm: String(searchTerm).trim()
      });
    } catch (error) {
      logger.error(`[TaskController] 任务搜索失败: ${(error as any)?.message}`, error as any);
      next(error);
    }
  }

  async getDbPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if ((req as any).user?.role !== 'admin') {
        res.status(403).json({ success: false, error: { code: 4003, message: '需要管理员权限' } });
        return;
      }
      const { table, status } = req.query as any;
      if (!table) {
        res.status(400).json({ success: false, error: { code: 4001, message: '缺少表名参数' } });
        return;
      }
      const where: any = {};
      if (status) where.status = status;
      const analysis = await paginationService.analyzeQuery(table, where, [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ]);
      res.json({
        success: true,
        data: { table, query: analysis.sql, bindings: analysis.bindings, explain: analysis.explain }
      });
    } catch (error) {
      logger.error(
        `[TaskController] 获取数据库性能分析失败: ${(error as any)?.message}`,
        error as any
      );
      next(error);
    }
  }
}

export default new TaskController();
