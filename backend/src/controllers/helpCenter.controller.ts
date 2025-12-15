/**
 * 帮助中心控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as helpCenterRepo from '../repositories/helpCenter.repo.js';
import aiContentService from '../services/ai-content.service.js';

class HelpCenterController {
  // ============ 分类管理 ============

  async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { includeInactive, parentId } = req.query;
      const categories = await helpCenterRepo.listCategories({
        includeInactive: includeInactive === 'true',
        parentId: parentId ? (parentId === 'null' ? null : parseInt(parentId as string)) : undefined
      });
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await helpCenterRepo.createCategory(req.body);
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const category = await helpCenterRepo.updateCategory(id, req.body);
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await helpCenterRepo.deleteCategory(id);
      if (!deleted) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '分类不存在' } });
        return;
      }
      res.json({ success: true, message: '分类已删除' });
    } catch (error) {
      next(error);
    }
  }

  // ============ 文章管理 ============

  async listArticles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { categoryId, status, search, limit = 50, offset = 0 } = req.query;
      const articles = await helpCenterRepo.listArticles({
        categoryId: categoryId ? parseInt(categoryId as string) : undefined,
        status: status as string,
        search: search as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      res.json({ success: true, data: { items: articles, limit, offset } });
    } catch (error) {
      next(error);
    }
  }

  async getArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const article = await helpCenterRepo.getArticleById(id);
      if (!article) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '文章不存在' } });
        return;
      }
      res.json({ success: true, data: article });
    } catch (error) {
      next(error);
    }
  }

  async createArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const article = await helpCenterRepo.createArticle({ ...req.body, created_by: userId });
      res.status(201).json({ success: true, data: article });
    } catch (error) {
      next(error);
    }
  }

  async updateArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user?.id;
      const article = await helpCenterRepo.updateArticle(id, { ...req.body, updated_by: userId });
      res.json({ success: true, data: article });
    } catch (error) {
      next(error);
    }
  }

  async deleteArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await helpCenterRepo.deleteArticle(id);
      if (!deleted) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '文章不存在' } });
        return;
      }
      res.json({ success: true, message: '文章已删除' });
    } catch (error) {
      next(error);
    }
  }

  // ============ 前台API ============

  async getPublishedCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await helpCenterRepo.listCategories({ includeInactive: false });
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  async getPublishedArticles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category } = req.query;
      const articles = await helpCenterRepo.getPublishedArticles(category as string);
      res.json({ success: true, data: articles });
    } catch (error) {
      next(error);
    }
  }

  async getArticleBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const article = await helpCenterRepo.getArticleBySlug(slug);
      if (!article || article.status !== 'published') {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '文章不存在' } });
        return;
      }
      // 增加浏览次数
      await helpCenterRepo.incrementViewCount(article.id);
      res.json({ success: true, data: article });
    } catch (error) {
      next(error);
    }
  }

  async searchArticles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, limit = 10 } = req.query;
      if (!q) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '请输入搜索关键词' }
        });
        return;
      }
      const articles = await helpCenterRepo.searchArticles(q as string, parseInt(limit as string));
      res.json({ success: true, data: articles });
    } catch (error) {
      next(error);
    }
  }

  async markArticleHelpful(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { helpful } = req.body;
      await helpCenterRepo.markHelpful(id, helpful !== false);
      res.json({ success: true, message: '感谢您的反馈' });
    } catch (error) {
      next(error);
    }
  }

  // ============ AI功能 ============

  async aiGenerateFaq(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { topic, count = 5 } = req.body;
      const result = await aiContentService.generateText(
        'faq',
        `为"${topic}"主题生成${count}个常见问题和答案，格式为JSON数组：[{"question":"问题","answer":"答案"}]`,
        ['zh-CN'],
        'formal',
        2000
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new HelpCenterController();
