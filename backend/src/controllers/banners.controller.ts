/**
 * Banners Controller
 * 艹，轮播图控制器！支持拖拽排序！
 */

import { Request, Response, NextFunction } from 'express';
import * as bannerRepo from '../repositories/banners.repo.js';
import type { CreateBannerInput, Banner } from '../repositories/banners.repo.js';
import * as cosService from '../services/cos.service.js';

type TargetAudience = Banner['target_audience'] | undefined;

const parseTargetAudience = (value: unknown): TargetAudience => {
  if (value === 'all' || value === 'member' || value === 'vip') {
    return value;
  }
  return undefined;
};

export class BannersController {
  /**
   * 列出轮播图（管理端）
   */
  async listBanners(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      const banners = await bannerRepo.listBanners({
        status: status as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        success: true,
        data: {
          items: banners,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[BannersController] 列出轮播图失败:', err.message);
      next(err);
    }
  }

  /**
   * 获取当前有效轮播图（前台）
   */
  async getActiveBanners(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { target_audience } = req.query;

      const banners = await bannerRepo.getActiveBanners({
        target_audience: parseTargetAudience(target_audience) ?? 'all'
      });

      res.json({
        success: true,
        data: banners
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[BannersController] 获取有效轮播图失败:', err.message);
      next(err);
    }
  }

  /**
   * 获取单个轮播图
   */
  async getBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const banner = await bannerRepo.getBannerById(id);

      if (!banner) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '轮播图不存在' }
        });
        return;
      }

      res.json({ success: true, data: banner });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[BannersController] 获取轮播图失败:', err.message);
      next(err);
    }
  }

  /**
   * 创建轮播图
   */
  async createBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
        return;
      }

      const payload = req.body as CreateBannerInput;
      const input: CreateBannerInput = {
        ...payload,
        created_by: userId
      };

      // 艹，基础校验
      if (!input.title?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '标题不能为空' }
        });
        return;
      }

      if (!input.image_url?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '图片URL不能为空' }
        });
        return;
      }

      const banner = await bannerRepo.createBanner(input);

      res.status(201).json({ success: true, data: banner });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[BannersController] 创建轮播图失败:', err.message);
      next(err);
    }
  }

  /**
   * 更新轮播图
   */
  async updateBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const banner = await bannerRepo.updateBanner(id, updates);

      res.json({ success: true, data: banner });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message.includes('不存在')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: err.message }
        });
        return;
      }
      console.error('[BannersController] 更新轮播图失败:', err.message);
      next(err);
    }
  }

  /**
   * 批量更新排序
   * 艹，拖拽排序用这个！
   */
  async updateSortOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sortOrders: { id: number; sort_order: number }[] = req.body.sortOrders;

      if (!Array.isArray(sortOrders) || sortOrders.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'sortOrders必须是非空数组' }
        });
        return;
      }

      // 艹，验证每个元素
      for (const item of sortOrders) {
        if (typeof item.id !== 'number' || typeof item.sort_order !== 'number') {
          res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'sortOrders格式错误' }
          });
          return;
        }
      }

      await bannerRepo.updateBannersSortOrder(sortOrders);

      res.json({ success: true, message: '排序更新成功' });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[BannersController] 更新排序失败:', err.message);
      next(err);
    }
  }

  /**
   * 删除轮播图
   */
  async deleteBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await bannerRepo.deleteBanner(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '轮播图不存在' }
        });
        return;
      }

      res.json({ success: true, message: '轮播图已删除' });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[BannersController] 删除轮播图失败:', err.message);
      next(err);
    }
  }

  /**
   * 获取COS上传凭证（推荐方式）
   * 艹，前端拿到凭证后直接上传到COS！
   */
  async getUploadCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 检查COS是否配置
      if (!cosService.isCOSConfigured()) {
        res.status(503).json({
          success: false,
          error: { code: 'COS_NOT_CONFIGURED', message: 'COS未配置' }
        });
        return;
      }

      const { filename } = req.body;

      if (!filename?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '文件名不能为空' }
        });
        return;
      }

      // 生成安全的文件Key
      const key = cosService.generateBannerKey(filename);

      // 生成上传凭证
      const credentials = await cosService.getUploadCredentials({
        key,
        expiresInSeconds: 1800 // 30分钟
      });

      res.json({
        success: true,
        data: credentials
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[BannersController] 获取上传凭证失败:', err.message);
      next(err);
    }
  }

  /**
   * 后端直接上传图片到COS（备选方案）
   * 艹，小文件可以用这个！
   */
  async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 检查COS是否配置
      if (!cosService.isCOSConfigured()) {
        res.status(503).json({
          success: false,
          error: { code: 'COS_NOT_CONFIGURED', message: 'COS未配置' }
        });
        return;
      }

      // 这里需要使用multer等中间件处理文件上传
      // 暂时假设文件已经通过body传过来（需要配置multer）
      const file = (
        req as Request & {
          file?: { originalname: string; buffer: Buffer; mimetype: string };
        }
      ).file;

      if (!file) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '未找到上传文件' }
        });
        return;
      }

      // 生成安全的文件Key
      const key = cosService.generateBannerKey(file.originalname);

      // 上传到COS
      const url = await cosService.uploadFile({
        key,
        body: file.buffer,
        contentType: file.mimetype
      });

      res.json({
        success: true,
        data: { url, key }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[BannersController] 上传图片失败:', err.message);
      next(err);
    }
  }
}

export default new BannersController();
