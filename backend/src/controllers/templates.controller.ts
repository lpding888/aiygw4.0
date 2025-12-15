/**
 * 模板库控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as templatesRepo from '../repositories/templates.repo.js';

class TemplatesController {
  async listTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, type, category, isFeatured, limit = 50, offset = 0 } = req.query;
      const templates = await templatesRepo.listTemplates({
        status: status as string,
        type: type as string,
        category: category as string,
        isFeatured: isFeatured === 'true' ? true : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      res.json({ success: true, data: { items: templates, limit, offset } });
    } catch (error) {
      next(error);
    }
  }

  async getTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await templatesRepo.getTemplateById(parseInt(req.params.id));
      if (!template) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '模板不存在' } });
        return;
      }
      res.json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  }

  async createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await templatesRepo.createTemplate({
        ...req.body,
        created_by: req.user?.id
      });
      res.status(201).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  }

  async updateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await templatesRepo.updateTemplate(parseInt(req.params.id), req.body);
      res.json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  }

  async deleteTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await templatesRepo.deleteTemplate(parseInt(req.params.id));
      if (!deleted) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '模板不存在' } });
        return;
      }
      res.json({ success: true, message: '已删除' });
    } catch (error) {
      next(error);
    }
  }

  async getPublishedTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, type, limit = 50 } = req.query;
      const templates = await templatesRepo.getPublishedTemplates({
        category: category as string,
        type: type as string,
        limit: parseInt(limit as string)
      });
      res.json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  }

  async getTemplateBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await templatesRepo.getTemplateBySlug(req.params.slug);
      if (!template || template.status !== 'published') {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '模板不存在' } });
        return;
      }
      res.json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  }

  async useTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await templatesRepo.incrementUseCount(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new TemplatesController();
