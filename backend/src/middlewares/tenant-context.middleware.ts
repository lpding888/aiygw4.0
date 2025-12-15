/**
 * 租户上下文中间件
 * 艹！从Header读取租户ID，验证权限，注入请求上下文！
 */

import { Request, Response, NextFunction } from 'express';
import * as tenantRepo from '../repositories/tenants.repo.js';
import logger from '../utils/logger.js';

// 扩展Request类型添加租户上下文
declare global {
    namespace Express {
        interface Request {
            tenantContext?: {
                tenantId: string;
                tenantName: string;
                tenantType: tenantRepo.TenantType;
                userRole: tenantRepo.MemberRole;
            };
        }
    }
}

/**
 * 提取租户上下文中间件
 * 从 x-tenant-id header 读取租户ID，验证用户权限，注入到请求上下文
 */
export async function extractTenantContext(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.user?.id;
        const tenantId = req.headers['x-tenant-id'] as string | undefined;

        // 未登录或没有指定租户，跳过
        if (!userId || !tenantId) {
            next();
            return;
        }

        // 验证用户对该租户的访问权限
        const membership = await tenantRepo.findMembership(tenantId, userId);
        if (!membership) {
            logger.warn(`[TenantContext] 用户 ${userId} 无权访问租户 ${tenantId}`);
            res.status(403).json({
                success: false,
                error: { code: 4003, message: '无权访问该租户' },
            });
            return;
        }

        // 获取租户信息
        const tenant = await tenantRepo.findTenantById(tenantId);
        if (!tenant) {
            logger.warn(`[TenantContext] 租户 ${tenantId} 不存在`);
            res.status(404).json({
                success: false,
                error: { code: 4004, message: '租户不存在' },
            });
            return;
        }

        // 注入租户上下文
        req.tenantContext = {
            tenantId: tenant.id,
            tenantName: tenant.name,
            tenantType: tenant.type,
            userRole: membership.role,
        };

        logger.debug(
            `[TenantContext] 用户 ${userId} 访问租户 ${tenant.name} (${tenantId}), 角色: ${membership.role}`
        );

        next();
    } catch (error) {
        const err = error as Error;
        logger.error(`[TenantContext] 租户上下文提取失败: ${err.message}`);
        next(error);
    }
}

/**
 * 要求租户上下文中间件
 * 必须有有效的租户上下文才能继续
 */
export function requireTenantContext(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    if (!req.tenantContext) {
        res.status(400).json({
            success: false,
            error: { code: 4000, message: '请在Header中提供 x-tenant-id' },
        });
        return;
    }
    next();
}

/**
 * 要求租户管理员权限中间件
 * 需要用户在当前租户中是 owner 或 admin
 */
export function requireTenantAdmin(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    if (!req.tenantContext) {
        res.status(400).json({
            success: false,
            error: { code: 4000, message: '请在Header中提供 x-tenant-id' },
        });
        return;
    }

    const { userRole } = req.tenantContext;
    if (!['owner', 'admin'].includes(userRole)) {
        res.status(403).json({
            success: false,
            error: { code: 4003, message: '需要租户管理员权限' },
        });
        return;
    }

    next();
}

/**
 * 要求租户所有者权限中间件
 */
export function requireTenantOwner(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    if (!req.tenantContext) {
        res.status(400).json({
            success: false,
            error: { code: 4000, message: '请在Header中提供 x-tenant-id' },
        });
        return;
    }

    if (req.tenantContext.userRole !== 'owner') {
        res.status(403).json({
            success: false,
            error: { code: 4003, message: '需要租户所有者权限' },
        });
        return;
    }

    next();
}

/**
 * 获取当前租户ID的辅助函数
 */
export function getCurrentTenantId(req: Request): string | undefined {
    return req.tenantContext?.tenantId;
}

/**
 * 获取当前用户在租户中的角色
 */
export function getCurrentTenantRole(req: Request): tenantRepo.MemberRole | undefined {
    return req.tenantContext?.userRole;
}

export default {
    extractTenantContext,
    requireTenantContext,
    requireTenantAdmin,
    requireTenantOwner,
    getCurrentTenantId,
    getCurrentTenantRole,
};
