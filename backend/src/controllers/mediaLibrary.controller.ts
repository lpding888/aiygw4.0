/**
 * 媒体库管理控制器（CMS管理端）
 */
import { Request, Response, NextFunction } from 'express';
import * as mediaRepo from '../repositories/media.repo.js';

class MediaLibraryController {
  // 文件夹
  async listFolders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parentId } = req.query;
      const folders = await mediaRepo.listFolders(
        parentId === 'null' ? null : parentId ? parseInt(parentId as string) : undefined
      );
      res.json({ success: true, data: folders });
    } catch (error) {
      next(error);
    }
  }

  async createFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folder = await mediaRepo.createFolder({ ...req.body, created_by: req.user?.id });
      res.status(201).json({ success: true, data: folder });
    } catch (error) {
      next(error);
    }
  }

  async updateFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folder = await mediaRepo.updateFolder(parseInt(req.params.id), req.body);
      res.json({ success: true, data: folder });
    } catch (error) {
      next(error);
    }
  }

  async deleteFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await mediaRepo.deleteFolder(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // 文件
  async listFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { folderId, type, search, limit = 50, offset = 0 } = req.query;
      const files = await mediaRepo.listFiles({
        folderId: folderId === 'null' ? null : folderId ? parseInt(folderId as string) : undefined,
        type: type as string,
        search: search as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      res.json({ success: true, data: { items: files } });
    } catch (error) {
      next(error);
    }
  }

  async getFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = await mediaRepo.getFileById(parseInt(req.params.id));
      if (!file) {
        res.status(404).json({ success: false, error: { message: '文件不存在' } });
        return;
      }
      res.json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  }

  async createFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = await mediaRepo.createFile({ ...req.body, created_by: req.user?.id });
      res.status(201).json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  }

  async updateFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = await mediaRepo.updateFile(parseInt(req.params.id), req.body);
      res.json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  }

  async deleteFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await mediaRepo.deleteFile(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await mediaRepo.getStorageStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

export default new MediaLibraryController();
