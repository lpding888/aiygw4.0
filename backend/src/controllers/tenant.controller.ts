/**
 * 租户控制器
 * 艹！多租户API接口！
 */

import { Request, Response } from 'express';
import tenantService from '../services/tenant.service.js';
import type { CreateTenantInput, UpdateTenantInput, MemberRole } from '../repositories/tenants.repo.js';
import logger from '../utils/logger.js';

// 使用全局声明的Request类型

class TenantController {
    /**
     * GET /api/tenants - 获取当前用户可访问的租户列表
     */
    async list(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: { message: '未登录' } });
                return;
            }

            const tenants = await tenantService.getUserTenants(userId);

            res.json({
                success: true,
                tenants: tenants.map((t) => ({
                    id: t.id,
                    name: t.name,
                    type: t.type,
                    role: t.role,
                    avatar: t.avatar,
                    member_count: t.member_count,
                    created_at: t.created_at,
                })),
            });
        } catch (error) {
            const err = error as Error;
            logger.error(`[TenantController] 获取租户列表失败: ${err.message}`);
            res.status(500).json({ success: false, error: { message: '获取租户列表失败' } });
        }
    }

    /**
     * GET /api/tenants/:id - 获取租户详情
     */
    async get(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const tenantId = req.params.id;

            if (!userId) {
                res.status(401).json({ success: false, error: { message: '未登录' } });
                return;
            }

            const tenant = await tenantService.getTenantById(tenantId, userId);

            if (!tenant) {
                res.status(404).json({ success: false, error: { message: '租户不存在或无权访问' } });
                return;
            }

            res.json({ success: true, tenant });
        } catch (error) {
            const err = error as Error;
            logger.error(`[TenantController] 获取租户详情失败: ${err.message}`);
            res.status(500).json({ success: false, error: { message: '获取租户详情失败' } });
        }
    }

    /**
     * POST /api/tenants - 创建租户（管理员）
     */
    async create(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const userRole = req.user?.role;

            if (!userId) {
                res.status(401).json({ success: false, error: { message: '未登录' } });
                return;
            }

            // 只有管理员可以创建非个人租户
            const { name, type, owner_id, ...rest } = req.body as CreateTenantInput;

            if (type !== 'personal' && userRole !== 'admin') {
                res.status(403).json({ success: false, error: { message: '只有管理员可以创建团队或企业租户' } });
                return;
            }

            const tenant = await tenantService.createTenant({
                name,
                type: type || 'personal',
                owner_id: owner_id || userId,
                ...rest,
            });

            res.status(201).json({ success: true, tenant });
        } catch (error) {
            const err = error as Error;
            logger.error(`[TenantController] 创建租户失败: ${err.message}`);
            res.status(500).json({ success: false, error: { message: '创建租户失败' } });
        }
    }

    /**
     * PUT /api/tenants/:id - 更新租户
     */
    async update(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const tenantId = req.params.id;
            const input = req.body as UpdateTenantInput;

            if (!userId) {
                res.status(401).json({ success: false, error: { message: '未登录' } });
                return;
            }

            const tenant = await tenantService.updateTenant(tenantId, userId, input);

            if (!tenant) {
                res.status(404).json({ success: false, error: { message: '租户不存在' } });
                return;
            }

            res.json({ success: true, tenant });
        } catch (error: any) {
            if (error.statusCode) {
                res.status(error.statusCode).json({ success: false, error: { message: error.message } });
                return;
            }
            logger.error(`[TenantController] 更新租户失败: ${error.message}`);
            res.status(500).json({ success: false, error: { message: '更新租户失败' } });
        }
    }

    /**
     * DELETE /api/tenants/:id - 删除租户
     */
    async delete(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const tenantId = req.params.id;

            if (!userId) {
                res.status(401).json({ success: false, error: { message: '未登录' } });
                return;
            }

            const success = await tenantService.deleteTenant(tenantId, userId);

            if (!success) {
                res.status(404).json({ success: false, error: { message: '租户不存在' } });
                return;
            }

            res.json({ success: true, message: '租户已删除' });
        } catch (error: any) {
            if (error.statusCode) {
                res.status(error.statusCode).json({ success: false, error: { message: error.message } });
                return;
            }
            logger.error(`[TenantController] 删除租户失败: ${error.message}`);
            res.status(500).json({ success: false, error: { message: '删除租户失败' } });
        }
    }

    /**
     * GET /api/tenants/:id/members - 获取租户成员列表
     */
    async listMembers(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const tenantId = req.params.id;

            if (!userId) {
                res.status(401).json({ success: false, error: { message: '未登录' } });
                return;
            }

            const members = await tenantService.getMembers(tenantId, userId);

            res.json({ success: true, members });
        } catch (error: any) {
            if (error.statusCode) {
                res.status(error.statusCode).json({ success: false, error: { message: error.message } });
                return;
            }
            logger.error(`[TenantController] 获取成员列表失败: ${error.message}`);
            res.status(500).json({ success: false, error: { message: '获取成员列表失败' } });
        }
    }

    /**
     * POST /api/tenants/:id/members - 添加租户成员
     */
    async addMember(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const tenantId = req.params.id;
            const { user_id: targetUserId, role } = req.body as { user_id: string; role?: MemberRole };

            if (!userId) {
                res.status(401).json({ success: false, error: { message: '未登录' } });
                return;
            }

            if (!targetUserId) {
                res.status(400).json({ success: false, error: { message: '请提供用户ID' } });
                return;
            }

            const member = await tenantService.addMember(tenantId, userId, targetUserId, role);

            res.status(201).json({ success: true, member });
        } catch (error: any) {
            if (error.statusCode) {
                res.status(error.statusCode).json({ success: false, error: { message: error.message } });
                return;
            }
            logger.error(`[TenantController] 添加成员失败: ${error.message}`);
            res.status(500).json({ success: false, error: { message: '添加成员失败' } });
        }
    }

    /**
     * PUT /api/tenants/:id/members/:memberId - 更新成员角色
     */
    async updateMember(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const tenantId = req.params.id;
            const targetUserId = req.params.memberId;
            const { role } = req.body as { role: MemberRole };

            if (!userId) {
                res.status(401).json({ success: false, error: { message: '未登录' } });
                return;
            }

            await tenantService.updateMemberRole(tenantId, userId, targetUserId, role);

            res.json({ success: true, message: '成员角色已更新' });
        } catch (error: any) {
            if (error.statusCode) {
                res.status(error.statusCode).json({ success: false, error: { message: error.message } });
                return;
            }
            logger.error(`[TenantController] 更新成员角色失败: ${error.message}`);
            res.status(500).json({ success: false, error: { message: '更新成员角色失败' } });
        }
    }

    /**
     * DELETE /api/tenants/:id/members/:memberId - 移除租户成员
     */
    async removeMember(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const tenantId = req.params.id;
            const targetUserId = req.params.memberId;

            if (!userId) {
                res.status(401).json({ success: false, error: { message: '未登录' } });
                return;
            }

            await tenantService.removeMember(tenantId, userId, targetUserId);

            res.json({ success: true, message: '成员已移除' });
        } catch (error: any) {
            if (error.statusCode) {
                res.status(error.statusCode).json({ success: false, error: { message: error.message } });
                return;
            }
            logger.error(`[TenantController] 移除成员失败: ${error.message}`);
            res.status(500).json({ success: false, error: { message: '移除成员失败' } });
        }
    }

    /**
     * POST /api/tenants/:id/leave - 离开租户
     */
    async leave(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const tenantId = req.params.id;

            if (!userId) {
                res.status(401).json({ success: false, error: { message: '未登录' } });
                return;
            }

            await tenantService.leaveTenant(tenantId, userId);

            res.json({ success: true, message: '已离开租户' });
        } catch (error: any) {
            if (error.statusCode) {
                res.status(error.statusCode).json({ success: false, error: { message: error.message } });
                return;
            }
            logger.error(`[TenantController] 离开租户失败: ${error.message}`);
            res.status(500).json({ success: false, error: { message: '离开租户失败' } });
        }
    }
}

export const tenantController = new TenantController();
export default tenantController;
