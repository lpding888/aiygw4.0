import type { NextFunction, Response } from 'express';
import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import type { UserRole } from '../utils/rbac.js';

interface AdminInfo {
  id: string;
  phone?: string;
  role: UserRole | string;
}

export async function requireAdmin(
  req: import('express').Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: { code: 4001, message: '未登录' } });
      return;
    }

    const user = (await db('users').where('id', userId).first('id', 'phone', 'role')) as
      | { id: string; phone?: string; role: string }
      | undefined;

    if (!user) {
      res.status(404).json({ success: false, error: { code: 4004, message: '用户不存在' } });
      return;
    }

    if (user.role !== 'admin') {
      logger.warn(`[AdminAuth] 非管理员尝试访问管理接口 userId=${userId} role=${user.role}`);
      res
        .status(403)
        .json({ success: false, error: { code: 4003, message: '无权访问,仅限管理员' } });
      return;
    }

    // 附加到 req.admin（已在 global.d.ts 声明）
    (req as any).admin = { id: user.id, phone: user.phone, role: user.role } as AdminInfo;
    next();
  } catch (error: any) {
    logger.error(`[AdminAuth] 权限验证失败: ${error.message}`, { userId: req.user?.id, error });
    res.status(500).json({ success: false, error: { code: 9999, message: '服务器内部错误' } });
  }
}

export default { requireAdmin };
