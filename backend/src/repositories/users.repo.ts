/**
 * Users Repository
 * 艹，这个tm负责所有用户数据库操作！
 */

import { db } from '../config/database.js';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * 用户接口
 */
export interface User {
  id: string;
  phone: string | null;
  email: string | null;
  password: string | null;
  role: string;
  isMember: boolean;
  quota_remaining: number;
  quota_expireAt: Date | null;
  referrer_id: string | null;
  email_verified: boolean;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * 安全的用户接口（不含密码）
 */
export interface SafeUser {
  id: string;
  phone: string | null;
  email: string | null;
  role: string;
  isMember: boolean;
  quota_remaining: number;
  quota_expireAt: Date | null;
  referrer_id: string | null;
  email_verified: boolean;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * 创建用户输入
 */
export interface CreateUserInput {
  id: string; // nanoid生成
  phone?: string | null;
  email?: string | null;
  password?: string | null; // bcrypt hash
  role?: string;
  isMember?: boolean;
  quota_remaining?: number;
  referrer_id?: string | null;
  email_verified?: boolean;
  email_verified_at?: Date | null;
}

/**
 * 根据手机号查找用户
 * 艹，登录时用！
 */
export async function findUserByPhone(phone: string): Promise<User | null> {
  const user = await db('users').where({ phone }).first();
  return user || null;
}

/**
 * 根据邮箱查找用户
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const normalized = normalizeEmail(email);
  const user = await db('users').whereRaw('LOWER(email) = ?', [normalized]).first();
  return user || null;
}

/**
 * 根据ID查找用户
 */
export async function findUserById(id: string): Promise<User | null> {
  const user = await db('users').where({ id }).first();
  return user || null;
}

/**
 * 创建用户
 * 艹，注册时用！
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const now = new Date();

  const userData = {
    id: input.id,
    phone: input.phone ?? null,
    email: input.email ? normalizeEmail(input.email) : null,
    password: input.password ?? null,
    role: input.role || 'user',
    isMember: input.isMember || false,
    quota_remaining: input.quota_remaining || 0,
    quota_expireAt: null,
    referrer_id: input.referrer_id || null,
    email_verified: input.email_verified ?? false,
    email_verified_at: input.email_verified_at ?? null,
    created_at: now,
    updated_at: now
  };

  await db('users').insert(userData);

  const created = await findUserById(input.id);
  if (!created) {
    throw new Error('创建用户失败');
  }

  return created;
}

/**
 * 更新用户
 */
export async function updateUser(
  id: string,
  updates: Partial<Omit<User, 'id' | 'created_at'>>
): Promise<User> {
  const affected = await db('users')
    .where({ id })
    .update({
      ...updates,
      updated_at: new Date()
    });

  if (affected === 0) {
    throw new Error(`用户不存在: ${id}`);
  }

  const updated = await findUserById(id);
  if (!updated) {
    throw new Error('更新用户失败');
  }

  return updated;
}

/**
 * 删除用户（软删除或硬删除）
 */
export async function deleteUser(id: string): Promise<boolean> {
  const affected = await db('users').where({ id }).delete();
  return affected > 0;
}

/**
 * 检查手机号是否已存在
 */
export async function phoneExists(phone: string): Promise<boolean> {
  const result = await db('users').where({ phone }).count('* as count').first();
  const count = result?.count ? Number(result.count) : 0;
  return count > 0;
}

/**
 * 检查邮箱是否已存在
 */
export async function emailExists(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const result = await db('users')
    .whereRaw('LOWER(email) = ?', [normalized])
    .count('* as count')
    .first();
  const count = result?.count ? Number(result.count) : 0;
  return count > 0;
}

/**
 * 获取安全的用户信息（排除password）
 */
export function toSafeUser(user: User): SafeUser {
  const { password, ...safeUser } = user;
  return safeUser as SafeUser;
}
