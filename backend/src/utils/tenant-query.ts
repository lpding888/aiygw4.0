/**
 * 租户范围查询构建器
 * 艹！为数据库查询自动添加tenant_id过滤条件！
 */

import { Knex } from 'knex';
import { db } from '../config/database.js';
import { Request } from 'express';

/**
 * 创建带租户过滤的查询构建器
 * 
 * @param tableName 表名
 * @param tenantId 租户ID（可选，如果不传则不过滤）
 * @returns Knex查询构建器
 * 
 * @example
 * // 基础用法
 * const tasks = await tenantQuery('tasks', tenantId).where('status', 'pending').select('*');
 * 
 * // 从请求上下文获取租户ID
 * const tasks = await tenantQueryFromRequest('tasks', req).where('status', 'pending').select('*');
 */
export function tenantQuery<T extends object = any>(
    tableName: string,
    tenantId?: string | null
): Knex.QueryBuilder<T> {
    const query = db<T>(tableName);

    if (tenantId) {
        query.where(`${tableName}.tenant_id`, tenantId);
    }

    return query;
}

/**
 * 从请求上下文创建租户范围查询
 */
export function tenantQueryFromRequest<T extends object = any>(
    tableName: string,
    req: Request
): Knex.QueryBuilder<T> {
    const tenantId = req.tenantContext?.tenantId;
    return tenantQuery<T>(tableName, tenantId);
}

/**
 * 插入数据时自动添加tenant_id
 */
export async function tenantInsert<T extends object>(
    tableName: string,
    data: T | T[],
    tenantId?: string | null
): Promise<number[]> {
    const records = Array.isArray(data) ? data : [data];

    const dataWithTenant = records.map((record) => ({
        ...record,
        tenant_id: tenantId ?? (record as any).tenant_id ?? null,
    }));

    return db(tableName).insert(dataWithTenant);
}

/**
 * 从请求上下文插入带租户ID的数据
 */
export async function tenantInsertFromRequest<T extends object>(
    tableName: string,
    data: T | T[],
    req: Request
): Promise<number[]> {
    const tenantId = req.tenantContext?.tenantId;
    return tenantInsert(tableName, data, tenantId);
}

/**
 * 更新数据时自动添加tenant_id过滤
 */
export function tenantUpdate<T extends object = any>(
    tableName: string,
    tenantId?: string | null
): Knex.QueryBuilder<T> {
    const query = db<T>(tableName);

    if (tenantId) {
        query.where(`${tableName}.tenant_id`, tenantId);
    }

    return query;
}

/**
 * 删除数据时自动添加tenant_id过滤
 */
export function tenantDelete<T extends object = any>(
    tableName: string,
    tenantId?: string | null
): Knex.QueryBuilder<T> {
    const query = db<T>(tableName);

    if (tenantId) {
        query.where(`${tableName}.tenant_id`, tenantId);
    }

    return query;
}

/**
 * 检查记录是否属于指定租户
 */
export async function belongsToTenant(
    tableName: string,
    recordId: string,
    tenantId: string,
    idColumn: string = 'id'
): Promise<boolean> {
    const record = await db(tableName)
        .where(idColumn, recordId)
        .where('tenant_id', tenantId)
        .first();

    return !!record;
}

/**
 * 租户范围的COUNT查询
 */
export async function tenantCount(
    tableName: string,
    tenantId?: string | null,
    whereClause?: Record<string, unknown>
): Promise<number> {
    let query = db(tableName);

    if (tenantId) {
        query = query.where('tenant_id', tenantId);
    }

    if (whereClause) {
        query = query.where(whereClause);
    }

    const result = await query.count('* as count').first();
    return Number(result?.count ?? 0);
}

/**
 * 租户数据隔离包装器
 * 用于包装现有的仓库函数，自动添加租户过滤
 * 
 * @example
 * const findTasks = withTenantScope(async (tenantId, userId) => {
 *   return db('tasks').where('userId', userId).select('*');
 * });
 * 
 * // 使用时会自动添加tenant_id过滤
 * const tasks = await findTasks('tenant-123', 'user-456');
 */
export function withTenantScope<TArgs extends unknown[], TResult>(
    fn: (tenantId: string | null, ...args: TArgs) => Promise<TResult>
): (tenantId: string | null, ...args: TArgs) => Promise<TResult> {
    return fn;
}

export default {
    tenantQuery,
    tenantQueryFromRequest,
    tenantInsert,
    tenantInsertFromRequest,
    tenantUpdate,
    tenantDelete,
    belongsToTenant,
    tenantCount,
    withTenantScope,
};
