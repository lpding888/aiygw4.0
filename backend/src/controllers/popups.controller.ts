/**
 * 弹窗管理控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as popupsRepo from '../repositories/popups.repo.js';

class PopupsController {
  async listPopups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, type, limit = 50, offset = 0 } = req.query;
      const popups = await popupsRepo.listPopups({
        status: status as string,
        type: type as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      res.json({ success: true, data: { items: popups, limit, offset } });
    } catch (error) {
      next(error);
    }
  }

  async getPopup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const popup = await popupsRepo.getPopupById(parseInt(req.params.id));
      if (!popup) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '弹窗不存在' } });
        return;
      }
      res.json({ success: true, data: popup });
    } catch (error) {
      next(error);
    }
  }

  async createPopup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const popup = await popupsRepo.createPopup({ ...req.body, created_by: req.user?.id });
      res.status(201).json({ success: true, data: popup });
    } catch (error) {
      next(error);
    }
  }

  async updatePopup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const popup = await popupsRepo.updatePopup(parseInt(req.params.id), req.body);
      res.json({ success: true, data: popup });
    } catch (error) {
      next(error);
    }
  }

  async deletePopup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await popupsRepo.deletePopup(parseInt(req.params.id));
      if (!deleted) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '弹窗不存在' } });
        return;
      }
      res.json({ success: true, message: '弹窗已删除' });
    } catch (error) {
      next(error);
    }
  }

  async getActivePopups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page } = req.query;
      const popups = await popupsRepo.getActivePopups(page as string);
      res.json({ success: true, data: popups });
    } catch (error) {
      next(error);
    }
  }

  async recordImpression(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await popupsRepo.recordImpression(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async recordClick(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await popupsRepo.recordClick(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async recordClose(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await popupsRepo.recordClose(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new PopupsController();
