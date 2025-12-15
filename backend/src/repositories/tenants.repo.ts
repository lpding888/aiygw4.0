/**
 * 租户数据仓库
 * 艹！多租户数据访问层（增删改查）！
 */

import { db } from '../config/database.js';
import { nanoid } from 'nanoid';
import logger from '../utils/logger.js';

// ===================== 类型定义 =====================

export type TenantType = 'personal' | 'distributor' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'deleted';
export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type MemberStatus = 'active' | 'invited' | 'removed';

export interface Tenant {
    id: string;
    name: string;
    type: TenantType;
    owner_id: string;
    avatar?: string | null;
    description?: string | null;
    storage_quota: number;
    used_storage: number;
    allowed_features?: string[] | null;
    settings?: Record<string, unknown> | null;
    branding?: Record<string, unknown> | null;
    distributor_id?: string | null;
    status: TenantStatus;
    created_at: Date;
    updated_at: Date;
    deleted_at?: Date | null;
}

export interface TenantMember {
    id: string;
    tenant_id: string;
    user_id: string;
    role: MemberRole;
    status: MemberStatus;
    invited_by?: string | null;
    joined_at?: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateTenantInput {
    name: string;
    type: TenantType;
    owner_id: string;
    avatar?: string;
    description?: string;
    storage_quota?: number;
    allowed_features?: string[];
    settings?: Record<string, unknown>;
    branding?: Record<string, unknown>;
    distributor_id?: string;
}

export interface UpdateTenantInput {
    name?: string;
    avatar?: string;
    description?: string;
    storage_quota?: number;
    allowed_features?: string[];
    settings?: Record<string, unknown>;
    branding?: Record<string, unknown>;
    status?: TenantStatus;
}

// ===================== 租户操作 =====================

/**
 * 创建租户
 */
export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
    const id = nanoid(32);
    const tenant = {
        id,
        name: input.name,
        type: input.type,
        owner_id: input.owner_id,
        avatar: input.avatar,
        description: input.description,
        storage_quota: input.storage_quota ?? 10 * 1024 * 1024 * 1024, // 默认10GB
        used_storage: 0,
        allowed_features: input.allowed_features ? JSON.stringify(input.allowed_features) : null,
        settings: input.settings ? JSON.stringify(input.settings) : null,
        branding: input.branding ? JSON.stringify(input.branding) : null,
        distributor_id: input.distributor_id,
        status: 'active' as const,
    };

    await db('tenants').insert(tenant);

    // 同时创建所有者成员记录
    await db('tenant_members').insert({
        id: nanoid(32),
        tenant_id: id,
        user_id: input.owner_id,
        role: 'owner',
        status: 'active',
        joined_at: new Date(),
    });

    logger.info(`[Tenant] 创建租户: id=${id}, name=${input.name}, type=${input.type}`);

    return findTenantById(id) as Promise<Tenant>;
}

/**
 * 根据ID查找租户
 */
export async function findTenantById(id: string): Promise<Tenant | null> {
    const tenant = await db<Tenant>('tenants')
        .where({ id, status: 'active' })
        .whereNull('deleted_at')
        .first();

    if (!tenant) return null;

    return normalizeTenant(tenant);
}

/**
 * 获取用户可访问的租户列表
 */
export async function findTenantsByUserId(userId: string): Promise<Tenant[]> {
    const tenants = await db<Tenant>('tenants')
        .join('tenant_members', 'tenants.id', 'tenant_members.tenant_id')
        .where('tenant_members.user_id', userId)
        .where('tenant_members.status', 'active')
        .where('tenants.status', 'active')
        .whereNull('tenants.deleted_at')
        .select('tenants.*', 'tenant_members.role as member_role');

    return tenants.map(normalizeTenant);
}

/**
 * 更新租户
 */
export async function updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant | null> {
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.avatar !== undefined) updateData.avatar = input.avatar;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.storage_quota !== undefined) updateData.storage_quota = input.storage_quota;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.allowed_features !== undefined) {
        updateData.allowed_features = JSON.stringify(input.allowed_features);
    }
    if (input.settings !== undefined) {
        updateData.settings = JSON.stringify(input.settings);
    }
    if (input.branding !== undefined) {
        updateData.branding = JSON.stringify(input.branding);
    }

    if (Object.keys(updateData).length === 0) {
        return findTenantById(id);
    }

    await db('tenants').where({ id }).update(updateData);
    logger.info(`[Tenant] 更新租户: id=${id}`);

    return findTenantById(id);
}

/**
 * 软删除租户
 */
export async function deleteTenant(id: string): Promise<boolean> {
    const affected = await db('tenants')
        .where({ id })
        .update({ status: 'deleted', deleted_at: new Date() });

    if (affected > 0) {
        logger.info(`[Tenant] 删除租户: id=${id}`);
        return true;
    }
    return false;
}

// ===================== 成员操作 =====================

/**
 * 添加租户成员
 */
export async function addTenantMember(
    tenantId: string,
    userId: string,
    role: MemberRole = 'member',
    invitedBy?: string
): Promise<TenantMember> {
    const id = nanoid(32);
    const member: TenantMember = {
        id,
        tenant_id: tenantId,
        user_id: userId,
        role,
        status: 'active',
        invited_by: invitedBy ?? null,
        joined_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
    };

    await db('tenant_members').insert(member);
    logger.info(`[Tenant] 添加成员: tenantId=${tenantId}, userId=${userId}, role=${role}`);

    return member;
}

/**
 * 获取租户成员列表
 */
export async function findTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return db<TenantMember>('tenant_members')
        .where({ tenant_id: tenantId, status: 'active' })
        .select('*');
}

/**
 * 获取用户在租户中的成员信息
 */
export async function findMembership(
    tenantId: string,
    userId: string
): Promise<TenantMember | null> {
    const member = await db<TenantMember>('tenant_members')
        .where({ tenant_id: tenantId, user_id: userId, status: 'active' })
        .first();
    return member ?? null;
}

/**
 * 更新成员角色
 */
export async function updateMemberRole(
    tenantId: string,
    userId: string,
    role: MemberRole
): Promise<boolean> {
    const affected = await db('tenant_members')
        .where({ tenant_id: tenantId, user_id: userId })
        .update({ role });

    return affected > 0;
}

/**
 * 移除租户成员
 */
export async function removeTenantMember(tenantId: string, userId: string): Promise<boolean> {
    const affected = await db('tenant_members')
        .where({ tenant_id: tenantId, user_id: userId })
        .update({ status: 'removed' });

    if (affected > 0) {
        logger.info(`[Tenant] 移除成员: tenantId=${tenantId}, userId=${userId}`);
        return true;
    }
    return false;
}

/**
 * 获取租户成员数量
 */
export async function countTenantMembers(tenantId: string): Promise<number> {
    const result = await db('tenant_members')
        .where({ tenant_id: tenantId, status: 'active' })
        .count('* as count')
        .first();

    return Number(result?.count ?? 0);
}

// ===================== 辅助函数 =====================

/**
 * 规范化租户对象（解析JSON字段）
 */
function normalizeTenant(tenant: Tenant & { member_role?: MemberRole }): Tenant {
    return {
        ...tenant,
        allowed_features: parseJson(tenant.allowed_features),
        settings: parseJson(tenant.settings),
        branding: parseJson(tenant.branding),
    };
}

function parseJson<T>(value: unknown): T | null {
    if (!value) return null;
    if (typeof value === 'object') return value as T;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * 为用户创建默认个人租户
 */
export async function ensurePersonalTenant(userId: string, userName?: string): Promise<Tenant> {
    // 检查是否已有个人租户
    const existing = await db<Tenant>('tenants')
        .where({ owner_id: userId, type: 'personal', status: 'active' })
        .whereNull('deleted_at')
        .first();

    if (existing) {
        return normalizeTenant(existing);
    }

    // 创建新的个人租户
    return createTenant({
        name: userName ? `${userName}的空间` : '个人空间',
        type: 'personal',
        owner_id: userId,
    });
}
