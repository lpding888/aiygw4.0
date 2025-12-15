/**
 * 管理员租户路由
 * 艹！后台管理用的租户API！
 */

import { Router } from 'express';
import { Request, Response } from 'express';
import { db } from '../../config/database.js';
import * as tenantRepo from '../../repositories/tenants.repo.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import logger from '../../utils/logger.js';

const router = Router();

// 所有路由需要认证且是管理员
router.use(authenticate);

// 检查管理员权限
const requireAdmin = (req: Request, res: Response, next: () => void): void => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        res.status(403).json({ success: false, error: { message: '需要管理员权限' } });
        return;
    }
    next();
};

router.use(requireAdmin);

/**
 * GET /api/admin/tenants - 获取租户列表（管理员）
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { limit = '20', offset = '0', type, status, keyword } = req.query;

        let query = db('tenants')
            .whereNull('deleted_at');

        if (type) {
            query = query.where('type', type);
        }

        if (status) {
            query = query.where('status', status);
        }

        if (keyword) {
            query = query.where('name', 'like', `%${keyword}%`);
        }

        // 获取总数
        const countResult = await query.clone().count('* as count').first();
        const total = Number(countResult?.count ?? 0);

        // 获取分页数据
        const tenants = await query
            .orderBy('created_at', 'desc')
            .limit(Number(limit))
            .offset(Number(offset))
            .select('*');

        // 附加成员数量
        const tenantsWithCount = await Promise.all(
            tenants.map(async (tenant) => {
                const memberCount = await tenantRepo.countTenantMembers(tenant.id);
                return {
                    ...tenant,
                    member_count: memberCount,
                };
            })
        );

        res.json({
            success: true,
            tenants: tenantsWithCount,
            total,
        });
    } catch (error) {
        const err = error as Error;
        logger.error(`[AdminTenants] 获取租户列表失败: ${err.message}`);
        res.status(500).json({ success: false, error: { message: '获取租户列表失败' } });
    }
});

/**
 * GET /api/admin/tenants/:id - 获取租户详情（管理员）
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const tenant = await tenantRepo.findTenantById(id);
        if (!tenant) {
            res.status(404).json({ success: false, error: { message: '租户不存在' } });
            return;
        }

        const memberCount = await tenantRepo.countTenantMembers(id);

        res.json({
            success: true,
            tenant: {
                ...tenant,
                member_count: memberCount,
            },
        });
    } catch (error) {
        const err = error as Error;
        logger.error(`[AdminTenants] 获取租户详情失败: ${err.message}`);
        res.status(500).json({ success: false, error: { message: '获取租户详情失败' } });
    }
});

/**
 * POST /api/admin/tenants - 创建租户（管理员）
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { name, type, owner_id, description, storage_quota, allowed_features } = req.body;

        if (!name || !type || !owner_id) {
            res.status(400).json({ success: false, error: { message: '缺少必填字段' } });
            return;
        }

        const tenant = await tenantRepo.createTenant({
            name,
            type,
            owner_id,
            description,
            storage_quota,
            allowed_features,
        });

        res.status(201).json({ success: true, tenant });
    } catch (error) {
        const err = error as Error;
        logger.error(`[AdminTenants] 创建租户失败: ${err.message}`);
        res.status(500).json({ success: false, error: { message: '创建租户失败' } });
    }
});

/**
 * PUT /api/admin/tenants/:id - 更新租户（管理员）
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const tenant = await tenantRepo.updateTenant(id, updateData);
        if (!tenant) {
            res.status(404).json({ success: false, error: { message: '租户不存在' } });
            return;
        }

        res.json({ success: true, tenant });
    } catch (error) {
        const err = error as Error;
        logger.error(`[AdminTenants] 更新租户失败: ${err.message}`);
        res.status(500).json({ success: false, error: { message: '更新租户失败' } });
    }
});

/**
 * PUT /api/admin/tenants/:id/status - 更新租户状态（管理员）
 */
router.put('/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'suspended'].includes(status)) {
            res.status(400).json({ success: false, error: { message: '无效的状态值' } });
            return;
        }

        const tenant = await tenantRepo.updateTenant(id, { status });
        if (!tenant) {
            res.status(404).json({ success: false, error: { message: '租户不存在' } });
            return;
        }

        logger.info(`[AdminTenants] 管理员 ${req.user?.id} 更新租户 ${id} 状态为 ${status}`);
        res.json({ success: true, message: `租户已${status === 'active' ? '启用' : '停用'}` });
    } catch (error) {
        const err = error as Error;
        logger.error(`[AdminTenants] 更新租户状态失败: ${err.message}`);
        res.status(500).json({ success: false, error: { message: '更新租户状态失败' } });
    }
});

/**
 * DELETE /api/admin/tenants/:id - 删除租户（管理员）
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const success = await tenantRepo.deleteTenant(id);
        if (!success) {
            res.status(404).json({ success: false, error: { message: '租户不存在' } });
            return;
        }

        logger.info(`[AdminTenants] 管理员 ${req.user?.id} 删除租户 ${id}`);
        res.json({ success: true, message: '租户已删除' });
    } catch (error) {
        const err = error as Error;
        logger.error(`[AdminTenants] 删除租户失败: ${err.message}`);
        res.status(500).json({ success: false, error: { message: '删除租户失败' } });
    }
});

/**
 * GET /api/admin/tenants/:id/members - 获取租户成员（管理员）
 */
router.get('/:id/members', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const members = await tenantRepo.findTenantMembers(id);

        // 获取用户详情
        const userIds = members.map((m) => m.user_id);
        const users = await db('users').whereIn('user_id', userIds).select('user_id', 'username', 'nickname', 'avatar', 'email');
        const userMap = new Map(users.map((u) => [u.user_id, u]));

        const membersWithUser = members.map((m) => ({
            ...m,
            user: userMap.get(m.user_id) || null,
        }));

        res.json({ success: true, members: membersWithUser });
    } catch (error) {
        const err = error as Error;
        logger.error(`[AdminTenants] 获取成员列表失败: ${err.message}`);
        res.status(500).json({ success: false, error: { message: '获取成员列表失败' } });
    }
});

/**
 * POST /api/admin/tenants/:id/members - 添加租户成员（管理员）
 */
router.post('/:id/members', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { user_id, role = 'member' } = req.body;

        if (!user_id) {
            res.status(400).json({ success: false, error: { message: '请提供用户ID' } });
            return;
        }

        // 检查用户是否存在
        const user = await db('users').where('user_id', user_id).first();
        if (!user) {
            res.status(404).json({ success: false, error: { message: '用户不存在' } });
            return;
        }

        // 检查是否已是成员
        const existing = await tenantRepo.findMembership(id, user_id);
        if (existing) {
            res.status(400).json({ success: false, error: { message: '用户已是租户成员' } });
            return;
        }

        const member = await tenantRepo.addTenantMember(id, user_id, role, req.user?.id);
        res.status(201).json({ success: true, member });
    } catch (error) {
        const err = error as Error;
        logger.error(`[AdminTenants] 添加成员失败: ${err.message}`);
        res.status(500).json({ success: false, error: { message: '添加成员失败' } });
    }
});

/**
 * DELETE /api/admin/tenants/:id/members/:userId - 移除租户成员（管理员）
 */
router.delete('/:id/members/:userId', async (req: Request, res: Response) => {
    try {
        const { id, userId } = req.params;

        const success = await tenantRepo.removeTenantMember(id, userId);
        if (!success) {
            res.status(404).json({ success: false, error: { message: '成员不存在' } });
            return;
        }

        res.json({ success: true, message: '成员已移除' });
    } catch (error) {
        const err = error as Error;
        logger.error(`[AdminTenants] 移除成员失败: ${err.message}`);
        res.status(500).json({ success: false, error: { message: '移除成员失败' } });
    }
});

export default router;
