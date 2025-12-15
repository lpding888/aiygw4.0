/**
 * 定价配置仓库层
 */

import { db } from '../config/database.js';

export interface PricingConfig {
  id: number;
  name: string;
  code: string;
  description?: string;
  type: 'discount' | 'coupon' | 'bundle' | 'tier' | 'special';
  discount_percent?: number;
  discount_amount?: number;
  min_order_amount?: number;
  max_uses?: number;
  used_count: number;
  max_uses_per_user?: number;
  applicable_plans?: string;
  excluded_plans?: string;
  conditions?: string;
  stackable: boolean;
  status: 'draft' | 'active' | 'paused' | 'expired';
  start_time?: Date;
  end_time?: Date;
  priority: number;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePricingConfigInput {
  name: string;
  code: string;
  description?: string;
  type?: string;
  discount_percent?: number;
  discount_amount?: number;
  min_order_amount?: number;
  max_uses?: number;
  stackable?: boolean;
  status?: string;
  start_time?: Date | string;
  end_time?: Date | string;
  priority?: number;
  created_by?: number;
}

export async function listPricingConfigs(
  options: {
    status?: string;
    type?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<PricingConfig[]> {
  let query = db<PricingConfig>('pricing_configs').orderBy('priority', 'desc');
  if (options.status) query = query.where('status', options.status);
  if (options.type) query = query.where('type', options.type);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.offset(options.offset);
  return query;
}

export async function getActivePricingConfigs(): Promise<PricingConfig[]> {
  const now = new Date();
  return db<PricingConfig>('pricing_configs')
    .where('status', 'active')
    .where((builder) => {
      builder.whereNull('start_time').orWhere('start_time', '<=', now);
    })
    .where((builder) => {
      builder.whereNull('end_time').orWhere('end_time', '>=', now);
    })
    .where((builder) => {
      builder.whereNull('max_uses').orWhereRaw('used_count < max_uses');
    })
    .orderBy('priority', 'desc');
}

export async function getPricingConfigById(id: number): Promise<PricingConfig | undefined> {
  return db<PricingConfig>('pricing_configs').where('id', id).first();
}

export async function getPricingConfigByCode(code: string): Promise<PricingConfig | undefined> {
  return db<PricingConfig>('pricing_configs').where('code', code).first();
}

export async function createPricingConfig(data: CreatePricingConfigInput): Promise<PricingConfig> {
  const [id] = await db('pricing_configs').insert(data);
  return getPricingConfigById(id) as Promise<PricingConfig>;
}

export async function updatePricingConfig(
  id: number,
  data: Partial<CreatePricingConfigInput>
): Promise<PricingConfig> {
  await db('pricing_configs')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getPricingConfigById(id) as Promise<PricingConfig>;
}

export async function deletePricingConfig(id: number): Promise<boolean> {
  const deleted = await db('pricing_configs').where('id', id).delete();
  return deleted > 0;
}

export async function incrementUsedCount(id: number): Promise<void> {
  await db('pricing_configs').where('id', id).increment('used_count', 1);
}

export async function validatePricingConfig(
  code: string,
  orderAmount?: number
): Promise<{ valid: boolean; config?: PricingConfig; error?: string }> {
  const config = await getPricingConfigByCode(code);
  if (!config) return { valid: false, error: '优惠码不存在' };
  if (config.status !== 'active') return { valid: false, error: '优惠码已失效' };

  const now = new Date();
  if (config.start_time && new Date(config.start_time) > now)
    return { valid: false, error: '优惠码尚未生效' };
  if (config.end_time && new Date(config.end_time) < now)
    return { valid: false, error: '优惠码已过期' };
  if (config.max_uses && config.used_count >= config.max_uses)
    return { valid: false, error: '优惠码已达使用上限' };
  if (config.min_order_amount && orderAmount && orderAmount < config.min_order_amount) {
    return { valid: false, error: `订单金额需满${config.min_order_amount}元` };
  }

  return { valid: true, config };
}
