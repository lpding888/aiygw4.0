import { db } from '../config/database.js';
import logger from '../utils/logger.js';

type ConfigPrimitive = string | number | boolean | Record<string, unknown> | null;
type ConfigType = 'string' | 'number' | 'boolean' | 'json';

type SystemConfigRow = {
  config_key: string;
  config_value: string | null;
  config_type: ConfigType;
  description?: string | null;
  is_secret?: boolean;
  is_active?: boolean;
  category?: string | null;
  sort_order?: number | null;
  created_at?: Date;
  updated_at?: Date;
  created_by?: string | null;
  updated_by?: string | null;
};

type CountRow = {
  count?: string | number | bigint | null;
};

type ListOptions = {
  category?: string | null;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
};

const toNumber = (value?: string | number | bigint | null): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

class SystemConfigService {
  private readonly cache = new Map<string, ConfigPrimitive>();

  private readonly cacheExpiry = new Map<string, number>();

  private readonly CACHE_TTL = 5 * 60 * 1000;

  async get<T = ConfigPrimitive>(
    key: string,
    defaultValue: T | null = null
  ): Promise<T | ConfigPrimitive | null> {
    try {
      if (this.isCacheValid(key)) {
        return this.cache.get(key) ?? defaultValue;
      }

      const config = (await db<SystemConfigRow>('system_configs')
        .where('config_key', key)
        .where('is_active', true)
        .first()) as SystemConfigRow | undefined;

      if (!config) {
        logger.warn(`[SystemConfigService] 配置不存在: ${key}`);
        return defaultValue;
      }

      const value = this.parseValue(config.config_value, config.config_type);
      this.setCache(key, value);
      return (value as T) ?? defaultValue;
    } catch (error) {
      logger.error(`[SystemConfigService] 获取配置失败: ${key}`, error);
      return defaultValue;
    }
  }

  async getMultiple(keys: string[]): Promise<Record<string, ConfigPrimitive | null>> {
    const result: Record<string, ConfigPrimitive | null> = {};
    for (const key of keys) {
      result[key] = (await this.get(key)) ?? null;
    }
    return result;
  }

  async getByCategory(
    category: string,
    includeSecrets = false
  ): Promise<Record<string, ConfigPrimitive | string>> {
    try {
      let query = db<SystemConfigRow>('system_configs')
        .where('category', category)
        .where('is_active', true)
        .orderBy('sort_order', 'asc');

      if (!includeSecrets) {
        query = query.where('is_secret', false);
      }

      const configs = await query;
      const result: Record<string, ConfigPrimitive | string> = {};

      configs.forEach((config) => {
        const value = this.parseValue(config.config_value, config.config_type);
        if (config.is_secret && !includeSecrets) {
          result[config.config_key] = value ? '***已配置***' : '';
        } else {
          result[config.config_key] = value;
        }
      });

      return result;
    } catch (error) {
      logger.error(`[SystemConfigService] 获取分类配置失败: ${category}`, error);
      throw error;
    }
  }

  async set(
    key: string,
    value: ConfigPrimitive,
    type: ConfigType = 'string',
    description = '',
    userId: string | null = null
  ): Promise<boolean> {
    try {
      const now = new Date();
      const configValue = this.serializeValue(value, type);

      const exists = await db<SystemConfigRow>('system_configs').where('config_key', key).first();

      if (exists) {
        await db('system_configs')
          .where('config_key', key)
          .update({
            config_value: configValue,
            config_type: type,
            description,
            updated_at: now,
            updated_by: userId ?? exists.updated_by ?? null
          });
      } else {
        await db('system_configs').insert({
          config_key: key,
          config_value: configValue,
          config_type: type,
          description,
          is_active: true,
          created_at: now,
          updated_at: now,
          created_by: userId,
          updated_by: userId
        });
      }

      this.clearCache(key);
      logger.info(`[SystemConfigService] 配置已更新: ${key}`);
      return true;
    } catch (error) {
      logger.error(`[SystemConfigService] 设置配置失败: ${key}`, error);
      throw error;
    }
  }

  async setMultiple(
    configs: Array<{
      key: string;
      value: ConfigPrimitive;
      type?: ConfigType;
      description?: string;
    }>,
    userId: string | null = null
  ): Promise<boolean> {
    try {
      const results = await Promise.all(
        configs.map((config) =>
          this.set(
            config.key,
            config.value,
            config.type ?? 'string',
            config.description ?? '',
            userId
          )
        )
      );
      return results.every(Boolean);
    } catch (error) {
      logger.error('[SystemConfigService] 批量设置配置失败', error);
      throw error;
    }
  }

  async updateCategory(
    category: string,
    configs: Array<{ key: string; value: ConfigPrimitive; type: ConfigType }>,
    userId: string | null = null
  ): Promise<boolean> {
    try {
      await db.transaction(async (trx) => {
        for (const config of configs) {
          await trx('system_configs')
            .where('config_key', config.key)
            .update({
              config_value: this.serializeValue(config.value, config.type),
              updated_at: new Date(),
              updated_by: userId,
              category
            });

          this.clearCache(config.key);
        }
      });

      logger.info(`[SystemConfigService] 分类配置已更新: ${category}`);
      return true;
    } catch (error) {
      logger.error(`[SystemConfigService] 更新分类配置失败: ${category}`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await db('system_configs').where('config_key', key).update({
        is_active: false,
        deleted_at: new Date()
      });

      this.clearCache(key);
      logger.info(`[SystemConfigService] 配置已禁用: ${key}`);
      return true;
    } catch (error) {
      logger.error(`[SystemConfigService] 删除配置失败: ${key}`, error);
      throw error;
    }
  }

  async listCategories(): Promise<string[]> {
    try {
      const categories = await db('system_configs').distinct('category').whereNotNull('category');
      return categories.map((c) => c.category as string);
    } catch (error) {
      logger.error('[SystemConfigService] 获取配置分类失败', error);
      throw error;
    }
  }

  async list(options: ListOptions = {}): Promise<{
    configs: Array<SystemConfigRow & { parsed_value: ConfigPrimitive }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const { category = null, page = 1, limit = 50, includeInactive = false } = options;

      let query = db<SystemConfigRow>('system_configs')
        .select('*')
        .orderBy('category', 'asc')
        .orderBy('sort_order', 'asc')
        .orderBy('config_key', 'asc');

      if (category) {
        query = query.where('category', category);
      }

      if (!includeInactive) {
        query = query.where('is_active', true);
      }

      const offset = (page - 1) * limit;
      const configs = await query.limit(limit).offset(offset);

      const totalRow = (await db('system_configs').count('* as count').first()) as
        | CountRow
        | undefined;
      const total = toNumber(totalRow?.count);

      const formattedConfigs = configs.map((config) => ({
        ...config,
        config_value: config.is_secret ? '***敏感配置***' : config.config_value,
        parsed_value: this.parseValue(config.config_value, config.config_type)
      }));

      return {
        configs: formattedConfigs,
        total,
        page,
        limit,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0
      };
    } catch (error) {
      logger.error('[SystemConfigService] 获取配置列表失败', error);
      throw error;
    }
  }

  async reloadCache(): Promise<void> {
    this.cache.clear();
    this.cacheExpiry.clear();
    logger.info('[SystemConfigService] 配置缓存已清空');
  }

  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return typeof expiry === 'number' && Date.now() < expiry;
  }

  private setCache(key: string, value: ConfigPrimitive): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  private clearCache(key: string): void {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
  }

  private parseValue(value: string | null, type: ConfigType): ConfigPrimitive {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    try {
      switch (type) {
        case 'number':
          return Number(value);
        case 'boolean': {
          if (typeof value === 'boolean') return value;
          if (typeof value === 'number') return value !== 0;
          const normalized = value.toString().trim().toLowerCase();
          return normalized === 'true' || normalized === '1';
        }
        case 'json':
          return typeof value === 'string' ? JSON.parse(value) : value;
        default:
          return value;
      }
    } catch (error) {
      logger.error(`[SystemConfigService] 解析配置值失败: ${value} (${type})`, error);
      return value;
    }
  }

  private serializeValue(value: ConfigPrimitive, type: ConfigType): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (type === 'json') {
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }

    return String(value);
  }
}

const systemConfigService = new SystemConfigService();
export default systemConfigService;
