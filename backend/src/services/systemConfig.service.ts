import type { Knex } from 'knex';
import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import cacheService from './cache.service.js'; // P1-010: 使用Redis缓存
import secretManager from '../utils/secret-manager.js';

export type ConfigPrimitive = string | number | boolean | Record<string, unknown> | null;
export type ConfigType = 'string' | 'number' | 'boolean' | 'json' | 'secret';

type SystemConfigRow = {
  id?: number;
  config_key: string;
  config_value: string | null;
  encrypted_value?: string | null;
  encryption_version?: string | null;
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
  created_by_user?: string | null;
  updated_by_user?: string | null;
  metadata?: Record<string, unknown> | null;
  version?: number | null;
  last_rotated_at?: Date | null;
  last_accessed_at?: Date | null;
};

type CountRow = {
  count?: string | number | bigint | null;
};

type ListOptions = {
  category?: string | null;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
  includeSecrets?: boolean;
  search?: string | null;
};

type HistoryRow = {
  id: number;
  config_id?: number | null;
  config_key: string;
  action: 'create' | 'update' | 'delete' | 'rollback' | 'import';
  old_snapshot?: Record<string, unknown> | null;
  new_snapshot?: Record<string, unknown> | null;
  is_secret: boolean;
  version: number;
  changed_by?: string | null;
  changed_by_name?: string | null;
  source?: string | null;
  created_at: Date;
};

type ConfigSnapshotRow = {
  id: number;
  snapshot_name: string;
  description?: string | null;
  config_data: string | SnapshotPayload;
  created_at: Date;
};

export interface ConfigHistoryEntry {
  id: number;
  key: string;
  action: HistoryRow['action'];
  version: number;
  createdAt: Date;
  operator?: string | null;
  operatorName?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

type SnapshotConfigEntry = {
  key: string;
  config_type: ConfigType;
  category?: string | null;
  description?: string | null;
  is_secret?: boolean;
  is_active?: boolean;
  sort_order?: number | null;
  metadata?: Record<string, unknown> | null;
  version?: number | null;
  config_value?: string | null;
  encrypted_value?: string | null;
  encryption_version?: string | null;
};

type SnapshotPayload = {
  configs: SnapshotConfigEntry[];
  config_count: number;
  created_by_user?: string | null;
  created_at: string;
};

export interface ConfigSnapshotRecord {
  id: number;
  name: string;
  description?: string | null;
  createdAt: Date;
  configCount: number;
  data: SnapshotPayload;
}

export interface ConfigStats {
  total: number;
  active: number;
  inactive: number;
  sensitive: number;
  categories: Record<string, number>;
  lastUpdatedAt?: Date | null;
}

export type ConfigUpdateOptions = {
  category?: string | null;
  sensitive?: boolean;
  metadata?: Record<string, unknown> | null;
  sortOrder?: number | null;
  isActive?: boolean;
  source?: string;
  skipHistory?: boolean;
  description?: string;
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

/**
 * 系统配置服务 (P1-010优化)
 * 提供动态配置管理功能，支持运行时修改API密钥、提示词等配置
 * 艹！老王我用Redis缓存替换了Map缓存，多进程共享杠杠的
 */
class SystemConfigService {
  private readonly CACHE_TTL = 5 * 60; // P1-010: 5分钟缓存(秒)，Redis用秒

  /**
   * 获取配置值 (P1-010: 使用Redis缓存)
   */
  async get<T = ConfigPrimitive>(
    key: string,
    defaultValue: T | null = null
  ): Promise<T | ConfigPrimitive | null> {
    try {
      // P1-010: 使用Redis缓存的Cache-Aside模式
      const cacheKey = `system_config:${key}`;
      const cached = await cacheService.get<ConfigPrimitive>(cacheKey);

      if (cached !== null) {
        logger.debug(`[SystemConfigService] 缓存命中: ${key}`);
        return (cached as T) ?? defaultValue;
      }

      // 缓存miss，查询数据库
      logger.debug(`[SystemConfigService] 缓存未命中，查询数据源: ${key}`);
      const config = (await db<SystemConfigRow>('system_configs')
        .where('config_key', key)
        .where('is_active', true)
        .first()) as SystemConfigRow | undefined;

      if (!config) {
        logger.warn(`[SystemConfigService] 配置不存在: ${key}`);
        return defaultValue;
      }

      const value = this.parseRowValue(config, { includeSecret: true });

      // 写入Redis缓存
      if (value !== null && value !== undefined) {
        await cacheService.set(cacheKey, value, { ttl: this.CACHE_TTL });
        logger.debug(`[SystemConfigService] 数据已缓存: ${key}, TTL=${this.CACHE_TTL}s`);
      }

      if (config.id) {
        db('system_configs')
          .where('id', config.id)
          .update({ last_accessed_at: new Date() })
          .catch((error) =>
            logger.debug(`[SystemConfigService] 更新last_accessed_at失败: ${String(error)}`)
          );
      }

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
        const parsed = this.parseRowValue(config, { includeSecret: includeSecrets });
        if (config.is_secret && !includeSecrets) {
          result[config.config_key] = this.maskSecretValue(config) ?? '***已配置***';
        } else {
          result[config.config_key] = parsed ?? null;
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
    userId: string | null = null,
    options: ConfigUpdateOptions = {}
  ): Promise<boolean> {
    try {
      return await db.transaction(async (trx) => {
        const now = new Date();
        const existing = await trx<SystemConfigRow>('system_configs')
          .where('config_key', key)
          .first();

        const normalizedType = this.normalizeType(type, options);
        const computedSecret =
          options.sensitive ?? (normalizedType === 'secret' || Boolean(existing?.is_secret));
        const isSecret = Boolean(computedSecret);
        const storage = this.prepareStorage(value, normalizedType, isSecret);
        const descriptionText = options.description ?? description;

        if (existing) {
          const updatedPayload = {
            config_value: storage.config_value,
            encrypted_value: storage.encrypted_value,
            encryption_version: storage.encryption_version,
            config_type: normalizedType,
            description: descriptionText,
            updated_at: now,
            updated_by_user: userId ?? existing.updated_by_user ?? null,
            is_secret: isSecret,
            category: options.category ?? existing.category ?? 'general',
            sort_order:
              options.sortOrder ?? (existing.sort_order === null ? 0 : existing.sort_order),
            is_active: options.isActive ?? existing.is_active ?? true,
            metadata: this.mergeMetadata(existing.metadata, options.metadata, userId),
            version: (existing.version ?? 1) + 1,
            last_rotated_at: isSecret ? now : (existing.last_rotated_at ?? null)
          };

          await trx('system_configs').where('config_key', key).update(updatedPayload);

          const updated = await trx<SystemConfigRow>('system_configs')
            .where('config_key', key)
            .first();

          if (!options.skipHistory) {
            await this.recordHistory(trx, 'update', existing, updated ?? undefined, {
              userId,
              source: options.source
            });
          }
        } else {
          await trx('system_configs').insert({
            config_key: key,
            config_value: storage.config_value,
            encrypted_value: storage.encrypted_value,
            encryption_version: storage.encryption_version,
            config_type: normalizedType,
            description: descriptionText,
            is_active: options.isActive ?? true,
            category: options.category ?? 'general',
            is_secret: isSecret,
            sort_order: options.sortOrder ?? 0,
            created_at: now,
            updated_at: now,
            created_by_user: userId,
            updated_by_user: userId,
            metadata: this.mergeMetadata(null, options.metadata, userId),
            version: 1,
            last_rotated_at: isSecret ? now : null
          });

          const created = await trx<SystemConfigRow>('system_configs')
            .where('config_key', key)
            .first();

          if (!options.skipHistory) {
            await this.recordHistory(trx, 'create', undefined, created ?? undefined, {
              userId,
              source: options.source
            });
          }
        }

        await cacheService.delete(`system_config:${key}`);
        logger.info(`[SystemConfigService] 配置已更新: ${key}`);
        return true;
      });
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
      category?: string | null;
      sensitive?: boolean;
      metadata?: Record<string, unknown> | null;
      sortOrder?: number | null;
      isActive?: boolean;
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
            userId,
            {
              category: config.category,
              sensitive: config.sensitive,
              metadata: config.metadata,
              sortOrder: config.sortOrder ?? undefined,
              isActive: config.isActive
            }
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
      for (const config of configs) {
        await this.set(config.key, config.value, config.type, '', userId, { category });
      }

      logger.info(`[SystemConfigService] 分类配置已更新: ${category}`);
      return true;
    } catch (error) {
      logger.error(`[SystemConfigService] 更新分类配置失败: ${category}`, error);
      throw error;
    }
  }

  async delete(key: string, userId: string | null = null, source?: string): Promise<boolean> {
    try {
      return await db.transaction(async (trx) => {
        const existing = await trx<SystemConfigRow>('system_configs')
          .where('config_key', key)
          .first();

        if (!existing) {
          return false;
        }

        await trx('system_configs')
          .where('config_key', key)
          .update({
            is_active: false,
            updated_at: new Date(),
            updated_by_user: userId ?? existing.updated_by_user ?? null,
            metadata: this.mergeMetadata(
              existing.metadata,
              { deletedAt: new Date().toISOString() },
              userId
            )
          });

        await this.recordHistory(trx, 'delete', existing, undefined, { userId, source });

        await cacheService.delete(`system_config:${key}`);
        logger.info(`[SystemConfigService] 配置已禁用: ${key}`);
        return true;
      });
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

  async exportAll(): Promise<SystemConfigRow[]> {
    try {
      return await db<SystemConfigRow>('system_configs').select('*');
    } catch (error) {
      logger.error('[SystemConfigService] 导出配置失败', error);
      throw error;
    }
  }

  async list(options: ListOptions = {}): Promise<{
    configs: Array<
      SystemConfigRow & {
        parsed_value: ConfigPrimitive | string | null;
        masked_value?: string | null;
      }
    >;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        category = null,
        page = 1,
        limit = 50,
        includeInactive = false,
        includeSecrets = false,
        search = null
      } = options;

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

      if (search) {
        query = query.andWhere((qb) => {
          qb.where('config_key', 'like', `%${search}%`).orWhere(
            'description',
            'like',
            `%${search}%`
          );
        });
      }

      const offset = (page - 1) * limit;
      const configs = await query.limit(limit).offset(offset);

      const totalRow = (await db('system_configs').count('* as count').first()) as
        | CountRow
        | undefined;
      const total = toNumber(totalRow?.count);

      const formattedConfigs = configs.map((config) => {
        const parsed = this.parseRowValue(config, { includeSecret: includeSecrets });
        const masked = config.is_secret ? this.maskSecretValue(config) : null;
        return {
          ...config,
          config_value:
            config.is_secret && !includeSecrets
              ? (masked ?? '***敏感配置***')
              : config.config_value,
          parsed_value: parsed,
          masked_value: masked
        };
      });

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

  /**
   * 重新加载配置缓存 (P1-010: 清空Redis缓存)
   */
  async reloadCache(): Promise<void> {
    // P1-010: 清空所有系统配置的Redis缓存
    const deletedCount = await cacheService.deletePattern('system_config:*');
    logger.info(`[SystemConfigService] 配置缓存已清空，删除 ${deletedCount} 条缓存`);
  }

  async getStats(): Promise<ConfigStats> {
    const rows = await db<SystemConfigRow>('system_configs').select(
      'is_active',
      'is_secret',
      'category',
      'updated_at'
    );

    const stats: ConfigStats = {
      total: rows.length,
      active: rows.filter((r) => r.is_active !== false).length,
      inactive: rows.filter((r) => r.is_active === false).length,
      sensitive: rows.filter((r) => r.is_secret).length,
      categories: {},
      lastUpdatedAt: null
    };

    rows.forEach((row) => {
      const cat = row.category ?? 'general';
      stats.categories[cat] = (stats.categories[cat] ?? 0) + 1;
      if (!stats.lastUpdatedAt || (row.updated_at && row.updated_at > stats.lastUpdatedAt)) {
        stats.lastUpdatedAt = row.updated_at ?? null;
      }
    });

    return stats;
  }

  async getHistory(key: string, limit = 20): Promise<ConfigHistoryEntry[]> {
    const rows = (await db<HistoryRow>('system_config_history')
      .where('config_key', key)
      .orderBy('created_at', 'desc')
      .limit(limit)) as HistoryRow[];

    return rows.map((row) => ({
      id: row.id,
      key: row.config_key,
      action: row.action,
      version: row.version,
      createdAt: row.created_at,
      operator: row.changed_by,
      operatorName: row.changed_by_name,
      before: row.old_snapshot ?? null,
      after: row.new_snapshot ?? null
    }));
  }

  async createSnapshot(
    description = '',
    userId: string | null = null
  ): Promise<ConfigSnapshotRecord> {
    const configs = await db<SystemConfigRow>('system_configs').select('*');
    const data: SnapshotPayload = {
      configs: configs.map((row) => ({
        key: row.config_key,
        config_type: row.config_type,
        category: row.category,
        description: row.description,
        is_secret: row.is_secret,
        is_active: row.is_active,
        sort_order: row.sort_order,
        metadata: row.metadata ?? null,
        version: row.version ?? 1,
        config_value: row.config_value,
        encrypted_value: row.encrypted_value ?? null,
        encryption_version: row.encryption_version ?? null
      })),
      config_count: configs.length,
      created_by_user: userId ?? null,
      created_at: new Date().toISOString()
    };

    const insertResult = (await db('config_snapshots').insert({
      snapshot_name: description || `system-config-${new Date().toISOString()}`,
      description,
      config_type: 'system_config',
      config_ref: 'global',
      config_data: JSON.stringify(data),
      created_by: null,
      created_at: new Date()
    })) as Array<number | { id: number }>;

    const rawSnapshotId = insertResult[0];
    const snapshotId =
      typeof rawSnapshotId === 'object' && rawSnapshotId !== null
        ? rawSnapshotId.id
        : rawSnapshotId;

    return {
      id: snapshotId ?? 0,
      name: description || 'system-config',
      description,
      createdAt: new Date(data.created_at),
      configCount: data.config_count,
      data
    };
  }

  async listSnapshots(limit = 20): Promise<ConfigSnapshotRecord[]> {
    const rows = await db<ConfigSnapshotRow>('config_snapshots')
      .where('config_type', 'system_config')
      .orderBy('created_at', 'desc')
      .limit(limit);

    return rows.map((row) => {
      const payload =
        typeof row.config_data === 'string' ? JSON.parse(row.config_data) : row.config_data;
      return {
        id: row.id,
        name: row.snapshot_name,
        description: row.description,
        createdAt: row.created_at,
        configCount: payload?.config_count ?? 0,
        data: payload as SnapshotPayload
      };
    });
  }

  async rollbackSnapshot(snapshotId: number, userId: string | null = null): Promise<void> {
    const snapshotRow = await db('config_snapshots').where('id', snapshotId).first();
    if (!snapshotRow) {
      throw new Error(`快照不存在: ${snapshotId}`);
    }

    const payload: SnapshotPayload =
      typeof snapshotRow.config_data === 'string'
        ? JSON.parse(snapshotRow.config_data)
        : snapshotRow.config_data;

    if (!payload?.configs) {
      throw new Error('快照数据损坏，缺少configs');
    }

    await db.transaction(async (trx) => {
      for (const entry of payload.configs) {
        const before = await trx<SystemConfigRow>('system_configs')
          .where('config_key', entry.key)
          .first();

        const basePayload = {
          config_value: entry.config_value ?? null,
          encrypted_value: entry.encrypted_value ?? null,
          encryption_version: entry.encryption_version ?? null,
          config_type: entry.config_type,
          description: entry.description ?? null,
          is_secret: entry.is_secret ?? false,
          is_active: entry.is_active ?? true,
          category: entry.category ?? 'general',
          sort_order: entry.sort_order ?? 0,
          metadata: entry.metadata ?? null,
          version: entry.version ?? 1,
          updated_at: new Date(),
          updated_by_user: userId ?? null
        };

        if (before) {
          await trx('system_configs').where('config_key', entry.key).update(basePayload);
          const after = await trx<SystemConfigRow>('system_configs')
            .where('config_key', entry.key)
            .first();
          await this.recordHistory(trx, 'rollback', before, after ?? undefined, {
            userId,
            source: 'rollback'
          });
        } else {
          await trx('system_configs').insert({
            ...basePayload,
            config_key: entry.key,
            created_at: new Date(),
            created_by_user: userId ?? null
          });
          const created = await trx<SystemConfigRow>('system_configs')
            .where('config_key', entry.key)
            .first();
          await this.recordHistory(trx, 'rollback', undefined, created ?? undefined, {
            userId,
            source: 'rollback'
          });
        }

        await cacheService.delete(`system_config:${entry.key}`);
      }
    });

    logger.info(`[SystemConfigService] 已从快照 ${snapshotId} 回滚`);
  }

  /**
   * P1-010: 已移除isCacheValid()、setCache()和clearCache()方法
   * 现在使用Redis缓存，不再需要内存缓存管理方法
   */

  private parseRowValue(
    row: SystemConfigRow,
    options: { includeSecret?: boolean } = {}
  ): ConfigPrimitive | string | null {
    const includeSecret = options.includeSecret ?? false;

    if (row.is_secret) {
      if (!includeSecret) {
        return null;
      }

      const decrypted = this.decryptSecretValue(row);
      if (decrypted === null) {
        return null;
      }

      return this.parseValue(
        decrypted,
        row.config_type === 'secret' ? 'string' : (row.config_type as ConfigType)
      );
    }

    return this.parseValue(row.config_value, row.config_type);
  }

  private decryptSecretValue(row: SystemConfigRow): string | null {
    if (!row.encrypted_value) {
      return null;
    }

    try {
      return secretManager.decrypt(row.encrypted_value);
    } catch (error) {
      logger.error(
        `[SystemConfigService] 配置解密失败: ${row.config_key} (${(error as Error).message})`
      );
      return null;
    }
  }

  private maskSecretValue(row: SystemConfigRow): string | null {
    const decrypted = this.decryptSecretValue(row);
    return secretManager.mask(decrypted);
  }

  private normalizeType(type: ConfigType, options: ConfigUpdateOptions): ConfigType {
    if (options.sensitive) {
      return 'secret';
    }
    return type;
  }

  private prepareStorage(
    value: ConfigPrimitive,
    type: ConfigType,
    isSecret: boolean
  ): {
    config_value: string | null;
    encrypted_value: string | null;
    encryption_version: string | null;
  } {
    if (isSecret) {
      if (value === null || value === undefined || value === '') {
        return { config_value: null, encrypted_value: null, encryption_version: null };
      }

      const serialized =
        typeof value === 'string' ? value : (this.serializeValue(value, type) ?? '');

      if (!serialized) {
        return { config_value: null, encrypted_value: null, encryption_version: null };
      }

      return {
        config_value: null,
        encrypted_value: secretManager.encrypt(serialized),
        encryption_version: 'v1'
      };
    }

    return {
      config_value: this.serializeValue(value, type),
      encrypted_value: null,
      encryption_version: null
    };
  }

  private mergeMetadata(
    current: Record<string, unknown> | string | null | undefined,
    incoming: Record<string, unknown> | null | undefined,
    userId?: string | null
  ): Record<string, unknown> | null {
    const base = this.normalizeMetadata(current);
    const next = { ...base };

    if (incoming) {
      Object.assign(next, incoming);
    }

    if (userId) {
      next.lastUpdatedBy = userId;
      next.lastUpdatedAt = new Date().toISOString();
    }

    return Object.keys(next).length > 0 ? next : null;
  }

  private normalizeMetadata(
    metadata?: Record<string, unknown> | string | null
  ): Record<string, unknown> {
    if (!metadata) {
      return {};
    }

    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata) as Record<string, unknown>;
      } catch {
        return {};
      }
    }

    return metadata;
  }

  private buildHistorySnapshot(row?: SystemConfigRow): Record<string, unknown> | null {
    if (!row) {
      return null;
    }

    const snapshot: Record<string, unknown> = {
      key: row.config_key,
      type: row.config_type,
      category: row.category,
      description: row.description,
      isSecret: Boolean(row.is_secret),
      metadata: row.metadata ?? null,
      version: row.version ?? 1,
      updatedAt: row.updated_at ?? null
    };

    if (row.is_secret) {
      snapshot.maskedValue = this.maskSecretValue(row);
    } else {
      snapshot.value = this.parseRowValue(row, { includeSecret: true });
    }

    return snapshot;
  }

  private async recordHistory(
    trx: Knex.Transaction,
    action: HistoryRow['action'],
    before?: SystemConfigRow,
    after?: SystemConfigRow,
    context: { userId?: string | null; source?: string | null } = {}
  ): Promise<void> {
    const record: Partial<HistoryRow> = {
      config_id: after?.id ?? before?.id ?? null,
      config_key: after?.config_key ?? before?.config_key ?? '',
      action,
      old_snapshot: this.buildHistorySnapshot(before),
      new_snapshot: this.buildHistorySnapshot(after),
      is_secret: Boolean(after?.is_secret ?? before?.is_secret),
      version: after?.version ?? before?.version ?? 1,
      changed_by: context.userId ?? null,
      source: context.source ?? 'ui',
      created_at: new Date()
    };

    await trx('system_config_history').insert(record);
  }

  private parseValue(value: string | null, type: ConfigType): ConfigPrimitive | string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    try {
      switch (type) {
        case 'number':
          return Number(value);
        case 'boolean': {
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

  private serializeValue(value: ConfigPrimitive, type: ConfigType): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (type === 'json') {
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }

    if (type === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (type === 'number') {
      return Number(value).toString();
    }

    return String(value);
  }
}

const systemConfigService = new SystemConfigService();
export default systemConfigService;
