/**
 * 更新日志控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as changelogsRepo from '../repositories/changelogs.repo.js';
import aiContentService from '../services/ai-content.service.js';

class ChangelogsController {
  // ============ 管理端API ============

  async listChangelogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, type, limit = 50, offset = 0 } = req.query;
      const changelogs = await changelogsRepo.listChangelogs({
        status: status as string,
        type: type as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      res.json({ success: true, data: { items: changelogs, limit, offset } });
    } catch (error) {
      next(error);
    }
  }

  async getChangelog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const changelog = await changelogsRepo.getChangelogById(id);
      if (!changelog) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '更新日志不存在' } });
        return;
      }
      res.json({ success: true, data: changelog });
    } catch (error) {
      next(error);
    }
  }

  async createChangelog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const changelog = await changelogsRepo.createChangelog({ ...req.body, created_by: userId });
      res.status(201).json({ success: true, data: changelog });
    } catch (error) {
      next(error);
    }
  }

  async updateChangelog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const changelog = await changelogsRepo.updateChangelog(id, req.body);
      res.json({ success: true, data: changelog });
    } catch (error) {
      next(error);
    }
  }

  async deleteChangelog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await changelogsRepo.deleteChangelog(id);
      if (!deleted) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '更新日志不存在' } });
        return;
      }
      res.json({ success: true, message: '更新日志已删除' });
    } catch (error) {
      next(error);
    }
  }

  async publishChangelog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const changelog = await changelogsRepo.publishChangelog(id);
      res.json({ success: true, data: changelog });
    } catch (error) {
      next(error);
    }
  }

  // ============ 前台API ============

  async getPublishedChangelogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 20 } = req.query;
      const changelogs = await changelogsRepo.getPublishedChangelogs(parseInt(limit as string));
      res.json({ success: true, data: changelogs });
    } catch (error) {
      next(error);
    }
  }

  async getLatestChangelog(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const changelog = await changelogsRepo.getLatestChangelog();
      if (!changelog) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '暂无更新日志' } });
        return;
      }
      res.json({ success: true, data: changelog });
    } catch (error) {
      next(error);
    }
  }

  async getChangelogByVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { version } = req.params;
      const changelog = await changelogsRepo.getChangelogByVersion(version);
      if (!changelog || changelog.status !== 'published') {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '版本不存在' } });
        return;
      }
      res.json({ success: true, data: changelog });
    } catch (error) {
      next(error);
    }
  }

  // ============ AI功能 ============

  async aiGenerateSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { features, improvements, fixes } = req.body;
      const allChanges = [
        ...(features || []).map((f: string) => `新功能：${f}`),
        ...(improvements || []).map((i: string) => `改进：${i}`),
        ...(fixes || []).map((f: string) => `修复：${f}`)
      ].join('\n');

      const summary = await aiContentService.generateSummary(allChanges, 100);
      res.json({ success: true, data: { summary } });
    } catch (error) {
      next(error);
    }
  }
}

export default new ChangelogsController();
