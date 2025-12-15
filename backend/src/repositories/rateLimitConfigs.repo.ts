/**
 * API限流配置仓库层
 */
import { db } from '../config/database.js';

export interface RateLimitConfig {
  id: number;
  name: string;
  path_pattern: string;
  method: string;
  window_seconds: number;
  max_requests: number;
  scope: string;
  is_active: boolean;
  whitelist_ips?: string;
  whitelist_users?: string;
  error_message?: string;
  priority: number;
  created_at: Date;
  updated_at: Date;
}

export async function listConfigs(includeInactive = false): Promise<RateLimitConfig[]> {
  let query = db<RateLimitConfig>('rate_limit_configs').orderBy('priority', 'desc');
  if (!includeInactive) query = query.where('is_active', true);
  return query;
}

export async function getConfigById(id: number): Promise<RateLimitConfig | undefined> {
  return db<RateLimitConfig>('rate_limit_configs').where('id', id).first();
}

export async function createConfig(data: Partial<RateLimitConfig>): Promise<RateLimitConfig> {
  const [id] = await db('rate_limit_configs').insert(data);
  return getConfigById(id) as Promise<RateLimitConfig>;
}

export async function updateConfig(
  id: number,
  data: Partial<RateLimitConfig>
): Promise<RateLimitConfig> {
  await db('rate_limit_configs')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getConfigById(id) as Promise<RateLimitConfig>;
}

export async function deleteConfig(id: number): Promise<boolean> {
  return (await db('rate_limit_configs').where('id', id).delete()) > 0;
}

export async function getMatchingConfig(
  path: string,
  method: string
): Promise<RateLimitConfig | undefined> {
  const configs = await listConfigs();
  return configs.find((c) => {
    const methodMatch = c.method === '*' || c.method.toUpperCase() === method.toUpperCase();
    const pathMatch = new RegExp('^' + c.path_pattern.replace(/\*/g, '.*') + '$').test(path);
    return methodMatch && pathMatch;
  });
}
