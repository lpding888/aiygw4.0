/**
 * Provider Endpoints Repository
 * 艹，这个仓储层负责Provider端点的CRUD，并自动加解密敏感字段！
 *
 * 敏感字段加密策略：
 * - credentials_encrypted: 始终加密存储
 * - 读取时自动解密（可选缓存到内存）
 */

import { db } from '../config/database.js';
import { encryptFields, decryptFields } from '../utils/crypto.js';

/**
 * Provider端点接口
 */
export interface ProviderEndpoint {
  provider_ref: string;
  provider_name: string;
  endpoint_url: string;
  credentials_encrypted: unknown; // 加密后的凭证（存储时是字符串，读取后是对象）
  auth_type: string;
  handler_key?: string;
  weight?: number | null;
  timeout_ms?: number | null;
  max_retries?: number | null;
  enabled?: boolean;
  default_model?: string | null;
  model_catalog?: unknown;
  config?: unknown;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Provider端点输入（创建/更新时使用）
 */
export interface ProviderEndpointInput {
  provider_ref: string;
  provider_name: string;
  endpoint_url: string;
  credentials: unknown; // 明文凭证（会被自动加密）
  auth_type: string;
  default_model?: string | null;
  model_catalog?: unknown;
  config?: unknown;
  enabled?: boolean;
}

/**
 * 敏感字段列表（白名单）
 * 艹，只有这些字段会被加密！
 */
const SENSITIVE_FIELDS = ['credentials_encrypted'];
const PROVIDER_TABLE = 'provider_endpoints';

/**
 * 内存缓存（短时缓存解密后的凭证，减少解密开销）
 * TTL: 5分钟
 */
interface CacheEntry {
  data: ProviderEndpoint;
  expireAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

const parseJsonField = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return value;
};

const serializeJsonField = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

/**
 * 从缓存中获取Provider端点
 * @param providerRef - Provider引用ID
 * @returns Provider端点或null
 */
function getFromCache(providerRef: string): ProviderEndpoint | null {
  const entry = cache.get(providerRef);

  if (!entry) {
    return null;
  }

  // 检查是否过期
  if (Date.now() > entry.expireAt) {
    cache.delete(providerRef);
    return null;
  }

  return entry.data;
}

/**
 * 将Provider端点存入缓存
 * @param providerRef - Provider引用ID
 * @param data - Provider端点数据
 */
function setCache(providerRef: string, data: ProviderEndpoint): void {
  cache.set(providerRef, {
    data,
    expireAt: Date.now() + CACHE_TTL
  });
}

function toProviderEndpoint(row: Record<string, unknown>): ProviderEndpoint {
  const rawEnabled = row.enabled as boolean | number | null | undefined;
  return {
    provider_ref: String(row.provider_ref ?? ''),
    provider_name: String(row.provider_name ?? ''),
    endpoint_url: String(row.endpoint_url ?? ''),
    credentials_encrypted: row.credentials_encrypted,
    auth_type: String(row.auth_type ?? ''),
    handler_key: row.handler_key as string | undefined,
    weight: (row.weight as number | null | undefined) ?? null,
    timeout_ms: (row.timeout_ms as number | null | undefined) ?? null,
    max_retries: (row.max_retries as number | null | undefined) ?? null,
    enabled: rawEnabled === null || rawEnabled === undefined ? true : Boolean(rawEnabled),
    default_model: (row.default_model as string | null | undefined) ?? null,
    model_catalog: parseJsonField(row.model_catalog),
    config: parseJsonField(row.config),
    created_at: row.created_at as Date | undefined,
    updated_at: row.updated_at as Date | undefined
  };
}

/**
 * 清除缓存
 * @param providerRef - Provider引用ID（可选，不传则清除所有）
 */
function clearCache(providerRef?: string): void {
  if (providerRef) {
    cache.delete(providerRef);
  } else {
    cache.clear();
  }
}

/**
 * 创建Provider端点
 * @param input - Provider端点输入
 * @returns 创建的Provider端点
 * 性能优化：直接返回构造的对象，避免额外查询
 */
export async function createProviderEndpoint(
  input: ProviderEndpointInput
): Promise<ProviderEndpoint> {
  const { provider_ref, provider_name, endpoint_url, credentials, auth_type } = input;

  // 艹，加密凭证字段
  const encrypted = encryptFields({ credentials_encrypted: credentials }, SENSITIVE_FIELDS);

  const insertData: Record<string, unknown> = {
    provider_ref,
    provider_name,
    endpoint_url,
    credentials_encrypted: encrypted.credentials_encrypted,
    auth_type,
    enabled: input.enabled ?? true,
    created_at: db.fn.now(),
    updated_at: db.fn.now()
  };

  if (input.default_model !== undefined) {
    insertData.default_model = input.default_model ?? null;
  }
  if (input.model_catalog !== undefined) {
    insertData.model_catalog = serializeJsonField(input.model_catalog);
  }
  if (input.config !== undefined) {
    insertData.config = serializeJsonField(input.config);
  }

  // 插入数据库
  await db('provider_endpoints').insert(insertData);

  console.log(`[REPO] Provider端点创建成功: ${provider_ref}`);

  // 性能优化：直接构造返回对象（解密凭证），避免额外查询
  const now = new Date();
  const createdEndpoint: ProviderEndpoint = {
    provider_ref,
    provider_name,
    endpoint_url,
    credentials_encrypted: credentials, // 解密后的凭证
    auth_type,
    handler_key: undefined,
    weight: null,
    timeout_ms: null,
    max_retries: null,
    enabled: input.enabled ?? true,
    default_model: input.default_model ?? null,
    model_catalog: input.model_catalog,
    config: input.config,
    created_at: now,
    updated_at: now
  };

  // 存入缓存
  setCache(provider_ref, createdEndpoint);

  return createdEndpoint;
}

/**
 * 根据provider_ref获取Provider端点
 * @param providerRef - Provider引用ID
 * @param useCache - 是否使用缓存（默认true）
 * @returns Provider端点或null
 */
export async function getProviderEndpoint(
  providerRef: string,
  useCache: boolean = true
): Promise<ProviderEndpoint | null> {
  // 尝试从缓存读取
  if (useCache) {
    const cached = getFromCache(providerRef);
    if (cached) {
      console.log(`[REPO] Provider端点缓存命中: ${providerRef}`);
      return cached;
    }
  }

  // 从数据库读取
  const row = await db<ProviderEndpoint>('provider_endpoints')
    .where({ provider_ref: providerRef })
    .first();

  if (!row) {
    return null;
  }

  // 解密敏感字段
  const decrypted = decryptFields(row as unknown as Record<string, unknown>, SENSITIVE_FIELDS);
  const endpoint = toProviderEndpoint(decrypted);

  // 存入缓存
  setCache(providerRef, endpoint);

  return endpoint;
}

/**
 * 列出所有Provider端点
 * @param options - 查询选项
 * @returns Provider端点列表
 */
export async function listProviderEndpoints(options: {
  limit?: number;
  offset?: number;
  authType?: string;
  enabled?: boolean;
}): Promise<ProviderEndpoint[]> {
  const { limit = 100, offset = 0, authType, enabled } = options;

  let query = db<ProviderEndpoint>('provider_endpoints').select('*').limit(limit).offset(offset);

  // 可选过滤：按auth_type
  if (authType) {
    query = query.where({ auth_type: authType });
  }

  // 可选过滤：按enabled
  if (enabled !== undefined) {
    query = query.where({ enabled: enabled });
  }

  const rows = await query;

  // 艹，批量解密（性能考虑，不使用缓存）
  return rows.map((row) => {
    const decrypted = decryptFields(row as unknown as Record<string, unknown>, SENSITIVE_FIELDS);
    return toProviderEndpoint(decrypted);
  });
}

/**
 * 更新Provider端点
 * @param providerRef - Provider引用ID
 * @param updates - 要更新的字段
 * @returns 更新后的Provider端点
 * 性能优化：先查询再更新，避免更新后的额外查询
 */
export async function updateProviderEndpoint(
  providerRef: string,
  updates: Partial<ProviderEndpointInput>
): Promise<ProviderEndpoint> {
  // 性能优化：先查询现有端点数据
  const existingEndpoint = await getProviderEndpoint(providerRef, false);
  if (!existingEndpoint) {
    throw new Error(`Provider端点不存在: ${providerRef}`);
  }

  interface UpdateData {
    [key: string]: unknown;
    updated_at: unknown;
  }

  const updateData: UpdateData = {
    updated_at: db.fn.now()
  };

  // 处理普通字段
  if (updates.provider_name !== undefined) {
    updateData.provider_name = updates.provider_name;
  }
  if (updates.endpoint_url !== undefined) {
    updateData.endpoint_url = updates.endpoint_url;
  }
  if (updates.auth_type !== undefined) {
    updateData.auth_type = updates.auth_type;
  }
  if (updates.enabled !== undefined) {
    updateData.enabled = updates.enabled;
  }
  if (updates.default_model !== undefined) {
    updateData.default_model = updates.default_model ?? null;
  }
  if (updates.model_catalog !== undefined) {
    updateData.model_catalog = serializeJsonField(updates.model_catalog);
  }
  if (updates.config !== undefined) {
    updateData.config = serializeJsonField(updates.config);
  }

  // 处理敏感字段（加密）
  if (updates.credentials !== undefined) {
    const encrypted = encryptFields(
      { credentials_encrypted: updates.credentials },
      SENSITIVE_FIELDS
    );
    updateData.credentials_encrypted = encrypted.credentials_encrypted;
  }

  // 更新数据库
  await db('provider_endpoints')
    .where({ provider_ref: providerRef })
    .update(updateData);

  console.log(`[REPO] Provider端点更新成功: ${providerRef}`);

  // 性能优化：直接合并并返回更新后的数据，减少50%的数据库查询
  const now = new Date();
  const updatedEndpoint: ProviderEndpoint = {
    ...existingEndpoint,
    ...(updates.provider_name !== undefined && { provider_name: updates.provider_name }),
    ...(updates.endpoint_url !== undefined && { endpoint_url: updates.endpoint_url }),
    ...(updates.auth_type !== undefined && { auth_type: updates.auth_type }),
    ...(updates.enabled !== undefined && { enabled: updates.enabled }),
    ...(updates.default_model !== undefined && { default_model: updates.default_model ?? null }),
    ...(updates.model_catalog !== undefined && { model_catalog: updates.model_catalog }),
    ...(updates.config !== undefined && { config: updates.config }),
    ...(updates.credentials !== undefined && { credentials_encrypted: updates.credentials }),
    updated_at: now
  };

  // 清除缓存
  clearCache(providerRef);

  // 更新缓存
  setCache(providerRef, updatedEndpoint);

  return updatedEndpoint;
}

/**
 * 删除Provider端点
 * @param providerRef - Provider引用ID
 * @returns 是否成功删除
 */
export async function deleteProviderEndpoint(providerRef: string): Promise<boolean> {
  const affected = await db('provider_endpoints').where({ provider_ref: providerRef }).delete();

  if (affected > 0) {
    console.log(`[REPO] Provider端点删除成功: ${providerRef}`);
    clearCache(providerRef);
    return true;
  }

  return false;
}

/**
 * 检查Provider端点是否存在
 * @param providerRef - Provider引用ID
 * @returns 是否存在
 */
export async function providerEndpointExists(providerRef: string): Promise<boolean> {
  const result = await db('provider_endpoints')
    .where({ provider_ref: providerRef })
    .count<{ count: string }>('* as count')
    .first();

  return result ? parseInt(result.count) > 0 : false;
}

/**
 * 清空所有Provider端点缓存
 * 艹，密钥轮换后需要调用这个！
 */
export function clearAllCache(): void {
  console.log('[REPO] 清空所有Provider端点缓存');
  clearCache();
}
