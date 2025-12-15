/**
 * 页脚链接控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as footerLinksRepo from '../repositories/footerLinks.repo.js';

class FooterLinksController {
  async listFooterLinks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groupKey, includeInactive } = req.query;
      const links = await footerLinksRepo.listFooterLinks({
        groupKey: groupKey as string,
        includeInactive: includeInactive === 'true'
      });
      res.json({ success: true, data: links });
    } catch (error) {
      next(error);
    }
  }

  async createFooterLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await footerLinksRepo.createFooterLink(req.body);
      res.status(201).json({ success: true, data: link });
    } catch (error) {
      next(error);
    }
  }

  async updateFooterLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const link = await footerLinksRepo.updateFooterLink(parseInt(req.params.id), req.body);
      res.json({ success: true, data: link });
    } catch (error) {
      next(error);
    }
  }

  async deleteFooterLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await footerLinksRepo.deleteFooterLink(parseInt(req.params.id));
      if (!deleted) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '链接不存在' } });
        return;
      }
      res.json({ success: true, message: '已删除' });
    } catch (error) {
      next(error);
    }
  }

  async batchUpdateSortOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await footerLinksRepo.batchUpdateSortOrder(req.body.items);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getGroupedFooterLinks(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const grouped = await footerLinksRepo.getGroupedFooterLinks();
      res.json({ success: true, data: grouped });
    } catch (error) {
      next(error);
    }
  }
}

export default new FooterLinksController();
