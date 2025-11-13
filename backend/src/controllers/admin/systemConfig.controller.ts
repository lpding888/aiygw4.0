import type { Request, Response, NextFunction } from 'express';
import systemConfigService, {
  type ConfigPrimitive,
  type ConfigType
} from '../../services/systemConfig.service.js';
import logger from '../../utils/logger.js';

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const normalizeType = (type?: string): ConfigType => {
  if (type === 'number' || type === 'boolean' || type === 'json' || type === 'secret') {
    return type;
  }
  return 'string';
};

const normalizeValue = (value: unknown, type: ConfigType): ConfigPrimitive => {
  if (value === null || value === undefined) return null;
  if (type === 'number') {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
    return false;
  }
  if (type === 'json') {
    if (typeof value === 'object') return value as Record<string, unknown>;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
  return String(value);
};

class AdminSystemConfigController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page = '1',
        limit = '20',
        category = null,
        includeInactive = 'false',
        search = null
      } = req.query as Record<string, string>;

      const result = await systemConfigService.list({
        page: parseNumber(page, 1),
        limit: parseNumber(limit, 20),
        category,
        includeInactive: includeInactive === 'true',
        includeSecrets: true,
        search
      });

      const configs = result.configs.map((config) => ({
        key: config.config_key,
        value: config.parsed_value,
        maskedValue: config.masked_value ?? null,
        type: config.config_type,
        category: config.category ?? 'general',
        description: config.description ?? '',
        sensitive: Boolean(config.is_secret),
        version: config.version ?? 1,
        isActive: config.is_active !== false,
        updatedAt: config.updated_at ?? null,
        createdAt: config.created_at ?? null,
        metadata: config.metadata ?? null
      }));

      res.json({
        success: true,
        configs,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AdminConfig] 获取配置列表失败: ${err.message}`, err);
      next(err);
    }
  }

  async stats(_req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await systemConfigService.getStats();
      res.json({ success: true, stats });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AdminConfig] 获取配置统计失败: ${err.message}`, err);
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        key,
        value,
        type = 'string',
        description = '',
        category,
        sensitive,
        sortOrder,
        metadata,
        isActive
      } = req.body as Record<string, unknown>;

      if (!key) {
        res
          .status(400)
          .json({ success: false, error: { code: 'INVALID_KEY', message: '配置键不能为空' } });
        return;
      }

      const normalizedType = normalizeType(type as string | undefined);
      const normalizedValue = normalizeValue(value, normalizedType);
      const userId = req.user?.id ?? null;

      await systemConfigService.set(
        key as string,
        normalizedValue,
        normalizedType,
        description as string,
        userId,
        {
          category: category as string | undefined,
          sensitive: Boolean(sensitive),
          sortOrder: typeof sortOrder === 'number' ? sortOrder : undefined,
          metadata: (metadata as Record<string, unknown>) ?? null,
          isActive: typeof isActive === 'boolean' ? isActive : undefined,
          source: 'admin-ui'
        }
      );

      res.status(201).json({ success: true, message: '配置创建成功' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AdminConfig] 创建配置失败: ${err.message}`, err);
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params as { key: string };
      const {
        value,
        type = 'string',
        description = '',
        category,
        sensitive,
        sortOrder,
        metadata,
        isActive
      } = req.body as Record<string, unknown>;

      const normalizedType = normalizeType(type as string | undefined);
      const normalizedValue = normalizeValue(value, normalizedType);
      const userId = req.user?.id ?? null;

      await systemConfigService.set(
        key,
        normalizedValue,
        normalizedType,
        description as string,
        userId,
        {
          category: category as string | undefined,
          sensitive: Boolean(sensitive),
          sortOrder: typeof sortOrder === 'number' ? sortOrder : undefined,
          metadata: (metadata as Record<string, unknown>) ?? null,
          isActive: typeof isActive === 'boolean' ? isActive : undefined,
          source: 'admin-ui'
        }
      );

      res.json({ success: true, message: '配置更新成功' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AdminConfig] 更新配置失败: ${err.message}`, err);
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params as { key: string };
      const userId = req.user?.id ?? null;
      const deleted = await systemConfigService.delete(key, userId, 'admin-ui');
      if (!deleted) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '配置不存在' } });
        return;
      }
      res.json({ success: true, message: '配置已删除' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AdminConfig] 删除配置失败: ${err.message}`, err);
      next(err);
    }
  }

  async history(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params as { key: string };
      const history = await systemConfigService.getHistory(key, 50);
      res.json({ success: true, history });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AdminConfig] 获取历史失败: ${err.message}`, err);
      next(err);
    }
  }

  async listSnapshots(_req: Request, res: Response, next: NextFunction) {
    try {
      const snapshots = await systemConfigService.listSnapshots();
      res.json({
        success: true,
        snapshots: snapshots.map((snapshot) => ({
          id: snapshot.id,
          name: snapshot.name,
          description: snapshot.description,
          createdAt: snapshot.createdAt,
          configCount: snapshot.configCount
        }))
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AdminConfig] 获取快照失败: ${err.message}`, err);
      next(err);
    }
  }

  async createSnapshot(req: Request, res: Response, next: NextFunction) {
    try {
      const { description = '' } = req.body as { description?: string };
      const userId = req.user?.id ?? null;
      const snapshot = await systemConfigService.createSnapshot(description, userId);
      res.status(201).json({
        success: true,
        snapshot: {
          id: snapshot.id,
          name: snapshot.name,
          description: snapshot.description,
          createdAt: snapshot.createdAt,
          configCount: snapshot.configCount
        }
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AdminConfig] 创建快照失败: ${err.message}`, err);
      next(err);
    }
  }

  async rollbackSnapshot(req: Request, res: Response, next: NextFunction) {
    try {
      const { snapshotId } = req.params as { snapshotId: string };
      const userId = req.user?.id ?? null;
      await systemConfigService.rollbackSnapshot(Number(snapshotId), userId);
      res.json({ success: true, message: '回滚成功' });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[AdminConfig] 快照回滚失败: ${err.message}`, err);
      next(err);
    }
  }
}

export default new AdminSystemConfigController();
