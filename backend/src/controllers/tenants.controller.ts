import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import { db } from '../config/database.js';

/**
 * 租户控制器
 * 适配层：将单租户架构(Single Tenant)适配为前端的多租户(Multi-Tenant)接口规范。
 * 目前每个用户默认拥有一个"个人工作区"。
 */
class TenantsController {
  /**
   * 获取租户列表
   * 基于当前登录用户，生成其专属的"个人工作区"
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: 4010, message: '未授权访问' } });
        return;
      }

      // 从数据库获取用户真实信息，用于生成工作区名称
      const user = await db('users').where('id', userId).select('phone', 'nickname', 'created_at').first();
      
      if (!user) {
        res.status(404).json({ success: false, error: { code: 4040, message: '用户不存在' } });
        return;
      }

      // 生成个性化工作区名称
      const displayName = user.nickname || (user.phone ? `用户${user.phone.slice(-4)}` : '我的');
      const workspaceName = `${displayName}的工作区`;

      // 构造符合前端 Tenant 接口规范的对象
      // 策略：使用 `tenant_${userId}` 作为虚拟租户ID，确保唯一且与用户绑定
      const personalTenant = {
        id: `tenant_${userId}`,
        name: workspaceName,
        type: 'personal', // 目前仅支持个人类型
        role: 'owner',    // 用户对自己工作区拥有最高权限
        avatar: user.avatar || '', 
        member_count: 1,
        created_at: user.created_at || new Date().toISOString()
      };

      res.json({
        success: true,
        tenants: [personalTenant]
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[TenantsController] 获取租户列表失败: ${err.message}`, error);
      next(error);
    }
  }

  /**
   * 获取单个租户详情
   */
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.params;
      const userId = req.user?.id;

      // 验证权限：目前只允许访问自己的个人工作区
      const expectedTenantId = `tenant_${userId}`;
      if (tenantId !== expectedTenantId) {
        res.status(403).json({ success: false, error: { code: 4030, message: '无权访问此工作区' } });
        return;
      }

      const user = await db('users').where('id', userId).select('phone', 'nickname', 'created_at', 'avatar').first();
      
      if (!user) {
        res.status(404).json({ success: false, error: { code: 4040, message: '用户不存在' } });
        return;
      }

      const displayName = user.nickname || (user.phone ? `用户${user.phone.slice(-4)}` : '我的');

      const tenantDetail = {
        id: expectedTenantId,
        name: `${displayName}的工作区`,
        type: 'personal',
        role: 'owner',
        avatar: user.avatar,
        created_at: user.created_at,
        member_count: 1
      };

      res.json({
        success: true,
        data: tenantDetail
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[TenantsController] 获取租户详情失败: ${err.message}`, error);
      next(error);
    }
  }
}

export default new TenantsController();
