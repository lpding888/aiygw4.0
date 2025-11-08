import type { Request, Response } from 'express';
import featureService from '../services/feature.service.js';
import logger from '../utils/logger.js';

/**
 * Feature Controller - 功能卡片控制器（TS版）
 * 处理功能卡片相关的HTTP请求
 */
class FeatureController {
  // 这个SB函数处理获取功能列表，未登录返回启用的功能，已登录按权限过滤
  async getFeatures(req: Request, res: Response): Promise<void> {
    try {
      let features;

      // 未登录：返回所有启用的功能（首页展示用）
      if (!(req as any).user) {
        features = await featureService.getAllEnabledFeatures();
      } else {
        // 已登录：根据权限返回可用功能
        const userId = (req as any).user.id as string;
        features = await featureService.getAvailableFeatures(userId);
      }

      res.json({ success: true, data: features });
    } catch (error: any) {
      logger.error(`[FeatureController] 获取功能列表失败: ${error?.message}`, { error });
      res.status(error?.statusCode ?? 500).json({
        success: false,
        errorCode: error?.errorCode ?? 5000,
        message: error?.message ?? '获取功能列表失败'
      });
    }
  }

  // 这个SB函数返回某个功能的表单Schema，需要登录
  async getFormSchema(req: Request, res: Response): Promise<void> {
    try {
      const { featureId } = req.params as { featureId: string };
      const userId = ((req as any).user?.id ?? '') as string;

      const formSchema = await featureService.getFormSchema(featureId, userId);

      res.json({ success: true, ...formSchema });
    } catch (error: any) {
      logger.error(`[FeatureController] 获取表单Schema失败: ${error?.message}`, { error });
      res.status(error?.statusCode ?? 500).json({
        success: false,
        errorCode: error?.errorCode ?? 5000,
        message: error?.message ?? '获取表单Schema失败'
      });
    }
  }
}

export default new FeatureController();
