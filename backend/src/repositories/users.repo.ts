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
  hasPassword: boolean;
}

// ... (skipping CreateUserInput)

/**
 * 获取安全的用户信息（排除password）
 */
export function toSafeUser(user: User): SafeUser {
  const { password, ...safeUser } = user;
  return {
    ...safeUser,
    hasPassword: !!password
  } as SafeUser;
}
