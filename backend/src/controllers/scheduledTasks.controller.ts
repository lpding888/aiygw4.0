/**
 * 定时发布控制器
 */
import { Request, Response, NextFunction } from 'express';
import * as scheduledTasksRepo from '../repositories/scheduledTasks.repo.js';

class ScheduledTasksController {
  async listTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, entityType, limit = 50, offset = 0 } = req.query;
      const tasks = await scheduledTasksRepo.listScheduledTasks({
        status: status as string,
        entityType: entityType as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      res.json({ success: true, data: { items: tasks } });
    } catch (error) {
      next(error);
    }
  }

  async getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await scheduledTasksRepo.getTaskById(parseInt(req.params.id));
      if (!task) {
        res.status(404).json({ success: false, error: { message: '任务不存在' } });
        return;
      }
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await scheduledTasksRepo.createTask({ ...req.body, created_by: req.user?.id });
      res.status(201).json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await scheduledTasksRepo.updateTask(parseInt(req.params.id), req.body);
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async deleteTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await scheduledTasksRepo.deleteTask(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async cancelTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await scheduledTasksRepo.cancelTask(parseInt(req.params.id));
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async getPendingTasks(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tasks = await scheduledTasksRepo.getPendingTasks();
      res.json({ success: true, data: tasks });
    } catch (error) {
      next(error);
    }
  }
}

export default new ScheduledTasksController();
