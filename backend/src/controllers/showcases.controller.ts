/**
 * 案例展示控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as showcasesRepo from '../repositories/showcases.repo.js';
import aiContentService from '../services/ai-content.service.js';

class ShowcasesController {
  // ============ 管理端API ============

  async listShowcases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, category, style, isFeatured, limit = 50, offset = 0 } = req.query;
      const showcases = await showcasesRepo.listShowcases({
        status: status as string,
        category: category as string,
        style: style as string,
        isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      res.json({ success: true, data: { items: showcases, limit, offset } });
    } catch (error) {
      next(error);
    }
  }

  async getShowcase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const showcase = await showcasesRepo.getShowcaseById(id);
      if (!showcase) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '案例不存在' } });
        return;
      }
      res.json({ success: true, data: showcase });
    } catch (error) {
      next(error);
    }
  }

  async createShowcase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const showcase = await showcasesRepo.createShowcase({ ...req.body, created_by: userId });
      res.status(201).json({ success: true, data: showcase });
    } catch (error) {
      next(error);
    }
  }

  async updateShowcase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const showcase = await showcasesRepo.updateShowcase(id, req.body);
      res.json({ success: true, data: showcase });
    } catch (error) {
      next(error);
    }
  }

  async deleteShowcase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await showcasesRepo.deleteShowcase(id);
      if (!deleted) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '案例不存在' } });
        return;
      }
      res.json({ success: true, message: '案例已删除' });
    } catch (error) {
      next(error);
    }
  }

  // ============ 前台API ============

  async getPublishedShowcases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, limit = 20 } = req.query;
      const showcases = await showcasesRepo.getPublishedShowcases({
        category: category as string,
        limit: parseInt(limit as string)
      });
      res.json({ success: true, data: showcases });
    } catch (error) {
      next(error);
    }
  }

  async getFeaturedShowcases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 6 } = req.query;
      const showcases = await showcasesRepo.getFeaturedShowcases(parseInt(limit as string));
      res.json({ success: true, data: showcases });
    } catch (error) {
      next(error);
    }
  }

  async getShowcaseBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const showcase = await showcasesRepo.getShowcaseBySlug(slug);
      if (!showcase || showcase.status !== 'published') {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '案例不存在' } });
        return;
      }
      await showcasesRepo.incrementViewCount(showcase.id);
      res.json({ success: true, data: showcase });
    } catch (error) {
      next(error);
    }
  }

  async likeShowcase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await showcasesRepo.incrementLikeCount(id);
      res.json({ success: true, message: '点赞成功' });
    } catch (error) {
      next(error);
    }
  }

  // ============ AI功能 ============

  async aiGenerateDescription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, category, style } = req.body;
      const polished = await aiContentService.polishText(
        `这是一个${category || '服装'}类别的${style || ''}风格案例，标题是"${title}"。`,
        'marketing'
      );
      res.json({ success: true, data: { description: polished } });
    } catch (error) {
      next(error);
    }
  }

  async aiExtractHighlights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { description } = req.body;
      const result = await aiContentService.generateText(
        'highlights',
        `从以下案例描述中提取3-5个亮点，以JSON数组格式返回：["亮点1","亮点2","亮点3"]
描述：${description}`,
        ['zh-CN'],
        'formal',
        500
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new ShowcasesController();
