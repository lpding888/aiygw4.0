/**
 * 标签系统控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as tagsRepo from '../repositories/tags.repo.js';

class TagsController {
  async listTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, includeInactive, limit } = req.query;
      const tags = await tagsRepo.listTags({
        category: category as string,
        includeInactive: includeInactive === 'true',
        limit: limit ? parseInt(limit as string) : undefined
      });
      res.json({ success: true, data: tags });
    } catch (error) {
      next(error);
    }
  }

  async getPopularTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 20 } = req.query;
      const tags = await tagsRepo.getPopularTags(parseInt(limit as string));
      res.json({ success: true, data: tags });
    } catch (error) {
      next(error);
    }
  }

  async createTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tag = await tagsRepo.createTag(req.body);
      res.status(201).json({ success: true, data: tag });
    } catch (error) {
      next(error);
    }
  }

  async updateTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tag = await tagsRepo.updateTag(parseInt(req.params.id), req.body);
      res.json({ success: true, data: tag });
    } catch (error) {
      next(error);
    }
  }

  async deleteTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await tagsRepo.deleteTag(parseInt(req.params.id));
      if (!deleted) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '标签不存在' } });
        return;
      }
      res.json({ success: true, message: '已删除' });
    } catch (error) {
      next(error);
    }
  }

  async attachTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { taggableType, taggableId, tagIds } = req.body;
      await tagsRepo.attachTags(taggableType, taggableId, tagIds);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getEntityTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, id } = req.params;
      const tags = await tagsRepo.getTagsForEntity(type, parseInt(id));
      res.json({ success: true, data: tags });
    } catch (error) {
      next(error);
    }
  }

  async getEntitiesByTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, slug } = req.params;
      const ids = await tagsRepo.getEntitiesByTag(type, slug);
      res.json({ success: true, data: ids });
    } catch (error) {
      next(error);
    }
  }
}

export default new TagsController();
