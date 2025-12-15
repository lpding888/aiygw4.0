/**
 * 租户服务层
 * 艹！多租户业务逻辑处理！
 */

import * as tenantRepo from '../repositories/tenants.repo.js';
import type {
    Tenant,
    TenantMember,
    CreateTenantInput,
    UpdateTenantInput,
    MemberRole,
} from '../repositories/tenants.repo.js';
import logger from '../utils/logger.js';

export interface TenantWithMemberInfo extends Tenant {
    role: MemberRole;
    member_count: number;
}

class TenantService {
    /**
     * 获取用户可访问的租户列表
     */
    async getUserTenants(userId: string): Promise<TenantWithMemberInfo[]> {
        // 确保用户有个人租户
        await tenantRepo.ensurePersonalTenant(userId);

        const tenants = await tenantRepo.findTenantsByUserId(userId);

        // 附加成员数量和用户角色
        const results: TenantWithMemberInfo[] = [];
        for (const tenant of tenants) {
            const memberCount = await tenantRepo.countTenantMembers(tenant.id);
            const membership = await tenantRepo.findMembership(tenant.id, userId);

            results.push({
                ...tenant,
                role: membership?.role ?? 'member',
                member_count: memberCount,
            });
        }

        return results;
    }

    /**
     * 获取租户详情
     */
    async getTenantById(tenantId: string, userId: string): Promise<TenantWithMemberInfo | null> {
        // 验证用户有权限访问该租户
        const membership = await tenantRepo.findMembership(tenantId, userId);
        if (!membership) {
            logger.warn(`[TenantService] 用户 ${userId} 尝试访问无权限的租户 ${tenantId}`);
            return null;
        }

        const tenant = await tenantRepo.findTenantById(tenantId);
        if (!tenant) return null;

        const memberCount = await tenantRepo.countTenantMembers(tenantId);

        return {
            ...tenant,
            role: membership.role,
            member_count: memberCount,
        };
    }

    /**
     * 创建租户
     */
    async createTenant(input: CreateTenantInput): Promise<Tenant> {
        return tenantRepo.createTenant(input);
    }

    /**
     * 更新租户
     */
    async updateTenant(
        tenantId: string,
        userId: string,
        input: UpdateTenantInput
    ): Promise<Tenant | null> {
        // 验证用户权限（只有owner和admin可以更新）
        const membership = await tenantRepo.findMembership(tenantId, userId);
        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            logger.warn(`[TenantService] 用户 ${userId} 无权更新租户 ${tenantId}`);
            throw { statusCode: 403, message: '无权限更新租户' };
        }

        return tenantRepo.updateTenant(tenantId, input);
    }

    /**
     * 删除租户
     */
    async deleteTenant(tenantId: string, userId: string): Promise<boolean> {
        // 验证用户权限（只有owner可以删除）
        const membership = await tenantRepo.findMembership(tenantId, userId);
        if (!membership || membership.role !== 'owner') {
            logger.warn(`[TenantService] 用户 ${userId} 无权删除租户 ${tenantId}`);
            throw { statusCode: 403, message: '无权限删除租户' };
        }

        // 个人租户不能删除
        const tenant = await tenantRepo.findTenantById(tenantId);
        if (tenant?.type === 'personal') {
            throw { statusCode: 400, message: '个人租户不能删除' };
        }

        return tenantRepo.deleteTenant(tenantId);
    }

    /**
     * 添加租户成员
     */
    async addMember(
        tenantId: string,
        operatorId: string,
        targetUserId: string,
        role: MemberRole = 'member'
    ): Promise<TenantMember> {
        // 验证操作者权限
        const operatorMembership = await tenantRepo.findMembership(tenantId, operatorId);
        if (!operatorMembership || !['owner', 'admin'].includes(operatorMembership.role)) {
            throw { statusCode: 403, message: '无权限添加成员' };
        }

        // 检查目标用户是否已是成员
        const existingMembership = await tenantRepo.findMembership(tenantId, targetUserId);
        if (existingMembership) {
            throw { statusCode: 400, message: '用户已是租户成员' };
        }

        // admin不能添加owner
        if (role === 'owner' && operatorMembership.role !== 'owner') {
            throw { statusCode: 403, message: '只有所有者可以转让所有权' };
        }

        return tenantRepo.addTenantMember(tenantId, targetUserId, role, operatorId);
    }

    /**
     * 获取租户成员列表
     */
    async getMembers(tenantId: string, userId: string): Promise<TenantMember[]> {
        // 验证用户有权限查看成员
        const membership = await tenantRepo.findMembership(tenantId, userId);
        if (!membership) {
            throw { statusCode: 403, message: '无权限查看成员' };
        }

        return tenantRepo.findTenantMembers(tenantId);
    }

    /**
     * 更新成员角色
     */
    async updateMemberRole(
        tenantId: string,
        operatorId: string,
        targetUserId: string,
        newRole: MemberRole
    ): Promise<boolean> {
        const operatorMembership = await tenantRepo.findMembership(tenantId, operatorId);
        if (!operatorMembership || operatorMembership.role !== 'owner') {
            throw { statusCode: 403, message: '只有所有者可以修改成员角色' };
        }

        // 不能修改自己的角色
        if (operatorId === targetUserId) {
            throw { statusCode: 400, message: '不能修改自己的角色' };
        }

        return tenantRepo.updateMemberRole(tenantId, targetUserId, newRole);
    }

    /**
     * 移除租户成员
     */
    async removeMember(tenantId: string, operatorId: string, targetUserId: string): Promise<boolean> {
        const operatorMembership = await tenantRepo.findMembership(tenantId, operatorId);
        if (!operatorMembership || !['owner', 'admin'].includes(operatorMembership.role)) {
            throw { statusCode: 403, message: '无权限移除成员' };
        }

        // 不能移除owner
        const targetMembership = await tenantRepo.findMembership(tenantId, targetUserId);
        if (targetMembership?.role === 'owner') {
            throw { statusCode: 400, message: '不能移除所有者' };
        }

        // admin不能移除其他admin
        if (operatorMembership.role === 'admin' && targetMembership?.role === 'admin') {
            throw { statusCode: 403, message: '管理员不能移除其他管理员' };
        }

        return tenantRepo.removeTenantMember(tenantId, targetUserId);
    }

    /**
     * 离开租户
     */
    async leaveTenant(tenantId: string, userId: string): Promise<boolean> {
        const membership = await tenantRepo.findMembership(tenantId, userId);
        if (!membership) {
            throw { statusCode: 404, message: '不是该租户成员' };
        }

        // owner不能离开
        if (membership.role === 'owner') {
            throw { statusCode: 400, message: '所有者不能离开租户，请先转让所有权' };
        }

        return tenantRepo.removeTenantMember(tenantId, userId);
    }
}

export const tenantService = new TenantService();
export default tenantService;
