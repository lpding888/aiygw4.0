/**
 * CMS Provider 类型定义
 * 艹！这个SB文件定义CMS供应商管理的所有类型，消除any！
 *
 * @author 老王
 */

import type { Request } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware.js';

/**
 * 供应商状态
 */
export type ProviderStatus = 'active' | 'inactive' | 'error' | 'testing';

/**
 * 供应商类型
 */
export type ProviderType = string;

/**
 * 供应商数据库模型
 */
export interface Provider {
  id: string | number;
  name: string;
  description?: string | null;
  type: string;
  base_url: string;
  weight?: number;
  timeout?: number;
  retry?: number;
  enabled: boolean;
  status: ProviderStatus;
  last_tested_at?: Date | string | null;
  last_test_result?: string | TestResult | null;
  created_by?: string | number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * 供应商详情(包含secret)
 */
export interface ProviderWithSecret extends Provider {
  secret?: string | null;
}

/**
 * 查询选项
 */
export interface ProviderQueryOptions {
  page?: number;
  limit?: number;
  type?: string;
  status?: ProviderStatus;
  enabled?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 供应商列表响应
 */
export interface ProviderListResponse {
  providers: Provider[];
  pagination: {
    current: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 创建供应商数据
 */
export interface CreateProviderData {
  name: string;
  description?: string;
  type: string;
  base_url: string;
  weight?: number;
  timeout?: number;
  retry?: number;
  enabled?: boolean;
  secret?: string;
}

/**
 * 更新供应商数据
 */
export interface UpdateProviderData {
  name?: string;
  description?: string;
  type?: string;
  base_url?: string;
  weight?: number;
  timeout?: number;
  retry?: number;
  enabled?: boolean;
  status?: ProviderStatus;
  secret?: string;
}

/**
 * 供应商Secret记录
 */
export interface ProviderSecret {
  provider_id: string;
  encrypted_secret: string;
  iv: string;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * 加密结果
 */
export interface EncryptedData {
  encrypted: string;
  iv: string;
}

/**
 * 测试结果
 */
export interface TestResult {
  success: boolean;
  responseTime: number;
  message: string;
  timestamp: string;
  details?: {
    headers?: Record<string, string>;
    [key: string]: unknown;
  };
}

/**
 * 供应商统计
 */
export interface ProviderStats {
  total: number;
  enabled: number;
  active: number;
  error: number;
}

/**
 * 批量测试结果
 */
export interface BatchTestResult {
  total: number;
  success: number;
  failed: number;
  details: Array<{
    id: string | number;
    name: string;
    success: boolean;
    responseTime?: number;
    error?: string | null;
  }>;
}

/**
 * 认证请求类型
 */
export type AuthenticatedRequest = AuthRequest;

/**
 * CmsCache服务接口(用于类型安全)
 */
export interface CmsCacheService {
  invalidateScope(scope: string): Promise<void>;
}
