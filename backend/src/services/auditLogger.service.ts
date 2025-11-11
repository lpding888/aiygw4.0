/**
 * Audit Logger Service
 * 艹，审计日志服务！便捷记录方法
 */

import * as auditRepo from '../repositories/auditLogs.repo.js';
import { Request } from 'express';

/**
 * Request用户信息接口
 */
interface RequestUser {
  id: string;
  name?: string;
  email?: string;
}

/**
 * 从Request提取用户信息和IP
 */
function extractRequestInfo(req?: Request) {
  const user = (req as Request & { user?: RequestUser })?.user;
  const parsedUserId = user?.id !== undefined ? Number(user.id) : undefined;

  return {
    user_id: Number.isFinite(parsedUserId) ? (parsedUserId as number) : undefined,
    user_name: user?.name || user?.email,
    ip_address: req?.ip || (req?.connection as unknown as { remoteAddress?: string })?.remoteAddress,
    user_agent: req?.get('user-agent')
  };
}

/**
 * 审计日志参数接口
 */
interface AuditLogParams {
  entity_type: string;
  entity_id: number;
  req?: Request;
  changes?: Record<string, unknown>;
  reason?: string;
}

/**
 * 记录创建操作
 */
export async function logCreate(params: AuditLogParams): Promise<void> {
  const { entity_type, entity_id, req, changes, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'create',
    changes,
    reason,
    ...extractRequestInfo(req)
  });
}

/**
 * 记录更新操作
 */
export async function logUpdate(params: AuditLogParams): Promise<void> {
  const { entity_type, entity_id, req, changes, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'update',
    changes,
    reason,
    ...extractRequestInfo(req)
  });
}

/**
 * 记录删除操作
 */
export async function logDelete(params: AuditLogParams): Promise<void> {
  const { entity_type, entity_id, req, changes, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'delete',
    changes,
    reason,
    ...extractRequestInfo(req)
  });
}

/**
 * 发布/下线/审核操作参数接口
 */
interface AuditActionParams {
  entity_type: string;
  entity_id: number;
  req?: Request;
  reason?: string;
}

/**
 * 记录发布操作
 */
export async function logPublish(params: AuditActionParams): Promise<void> {
  const { entity_type, entity_id, req, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'publish',
    reason,
    ...extractRequestInfo(req)
  });
}

/**
 * 记录下线操作
 */
export async function logUnpublish(params: AuditActionParams): Promise<void> {
  const { entity_type, entity_id, req, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'unpublish',
    reason,
    ...extractRequestInfo(req)
  });
}

/**
 * 记录审核通过操作
 */
export async function logApprove(params: AuditActionParams): Promise<void> {
  const { entity_type, entity_id, req, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'approve',
    reason,
    ...extractRequestInfo(req)
  });
}

/**
 * 记录审核拒绝操作
 */
export async function logReject(params: AuditActionParams): Promise<void> {
  const { entity_type, entity_id, req, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'reject',
    reason,
    ...extractRequestInfo(req)
  });
}
