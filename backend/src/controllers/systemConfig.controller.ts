import type { Request, Response, NextFunction } from 'express';
import systemConfigService from '../services/systemConfig.service.js';
import logger from '../utils/logger.js';

interface GetValueQuery {
  defaultValue?: unknown;
}

interface GetCategoryQuery {
  includeSecrets?: string;
}

interface SetValueBody {
  value: unknown;
  type?: string;
  description?: string;
}

interface SetBatchBody {
  configs: Array<{
    key: string;
    value: unknown;
    type?: string;
    description?: string;
  }>;
}

interface ImportBody {
  configs: Array<{
    key: string;
    value: unknown;
    type?: string;
    description?: string;
  }>;
  overwrite?: boolean;
}

interface ConfigItem {
  key: string;
  value: unknown;
  type: string;
  description: string;
  updated_at: unknown;
}

class SystemConfigController {
  async getValue(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params as { key: string };
      const { defaultValue = null } = req.query as unknown as GetValueQuery;
      const value = await systemConfigService.get(key, defaultValue);
      res.json({ success: true, data: { key, value, exists: value !== null } });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[SystemConfigController] 获取配置值失败: ${err.message}`, error);
      next(error);
    }
  }

  async getCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { category } = req.params as { category: string };
      const { includeSecrets = false } = req.query as unknown as GetCategoryQuery;
      const configs = await systemConfigService.getByCategory(
        category,
        includeSecrets === 'true'
      );
      res.json({ success: true, data: { category, configs } });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[SystemConfigController] 获取分类配置失败: ${err.message}`, error);
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        category = null,
        page = '1',
        limit = '50',
        includeInactive = 'false'
      } = req.query as Record<string, string>;
      const result = await systemConfigService.list({
        category,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        includeInactive: includeInactive === 'true'
      });
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[SystemConfigController] 获取配置列表失败: ${err.message}`, error);
      next(error);
    }
  }

  async getCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await systemConfigService.getCategories();
      res.json({ success: true, data: categories });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[SystemConfigController] 获取配置分类失败: ${err.message}`, error);
      next(error);
    }
  }

  async setValue(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params as { key: string };
      const { value, type = 'string', description = '' } = req.body as unknown as SetValueBody;
      const userId = req.user?.id as string | undefined;
      if (value === undefined) {
        res.status(400).json({ success: false, error: { code: 4001, message: '配置值不能为空' } });
        return;
      }
      await systemConfigService.set(key, value, type, description, userId);
      res.json({ success: true, message: '配置更新成功', data: { key, value, type, description } });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[SystemConfigController] 设置配置值失败: ${err.message}`, error);
      if (String(err.message || '').includes('系统配置不可删除')) {
        res.status(403).json({ success: false, error: { code: 4003, message: err.message } });
        return;
      }
      next(error);
    }
  }

  async setBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { configs } = req.body as unknown as SetBatchBody;
      const userId = req.user?.id as string | undefined;
      if (!Array.isArray(configs) || configs.length === 0) {
        res
          .status(400)
          .json({ success: false, error: { code: 4001, message: '配置数组不能为空' } });
        return;
      }
      for (const config of configs) {
        if (!config.key || config.value === undefined) {
          res.status(400).json({
            success: false,
            error: { code: 4001, message: '每个配置必须包含key和value字段' }
          });
          return;
        }
      }
      await systemConfigService.setMultiple(configs, userId);
      res.json({
        success: true,
        message: `批量更新成功，共更新${configs.length}个配置`,
        data: { updatedCount: configs.length }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[SystemConfigController] 批量设置配置失败: ${err.message}`, error);
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params as { key: string };
      const userId = req.user?.id as string | undefined;
      const deleted = await systemConfigService.delete(key, userId);
      if (!deleted) {
        res.status(404).json({ success: false, error: { code: 4004, message: '配置不存在' } });
        return;
      }
      res.json({ success: true, message: '配置删除成功', data: { key } });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[SystemConfigController] 删除配置失败: ${err.message}`, error);
      if (String(err.message || '').includes('系统配置不可删除')) {
        res.status(403).json({ success: false, error: { code: 4003, message: err.message } });
        return;
      }
      next(error);
    }
  }

  async reloadCache(_req: Request, res: Response, next: NextFunction) {
    try {
      await systemConfigService.reloadCache();
      res.json({ success: true, message: '配置缓存已重载' });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[SystemConfigController] 重载缓存失败: ${err.message}`, error);
      next(error);
    }
  }

  async export(_req: Request, res: Response, next: NextFunction) {
    try {
      const configs = await systemConfigService.export();
      const exportData = (configs || []).map((c: ConfigItem) => ({
        key: c.key,
        value: c.value,
        type: c.type,
        description: c.description,
        updated_at: c.updated_at
      }));
      res.json({
        success: true,
        data: {
          configs: exportData,
          exportedAt: new Date().toISOString(),
          count: exportData.length
        }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[SystemConfigController] 导出配置失败: ${err.message}`, error);
      next(error);
    }
  }

  async import(req: Request, res: Response, next: NextFunction) {
    try {
      const { configs, overwrite = false } = req.body as unknown as ImportBody;
      const userId = req.user?.id as string | undefined;
      if (!Array.isArray(configs) || configs.length === 0) {
        res
          .status(400)
          .json({ success: false, error: { code: 4001, message: '配置数组不能为空' } });
        return;
      }
      const results = { success: 0, skipped: 0, failed: 0, errors: [] as string[] };
      for (const config of configs) {
        try {
          const { key, value, type = 'string', description = '' } = config;
          if (!key || value === undefined) {
            results.failed++;
            results.errors.push(`配置${config.key || '(未知)'}格式不正确`);
            continue;
          }
          const existing = await systemConfigService.get(key);
          if (existing && !overwrite) {
            results.skipped++;
            continue;
          }
          await systemConfigService.set(key, value, type, description, userId);
          results.success++;
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error(String(err));
          results.failed++;
          results.errors.push(`配置${config.key}导入失败: ${error.message}`);
        }
      }
      res.json({ success: true, message: '配置导入完成', data: results });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[SystemConfigController] 导入配置失败: ${err.message}`, error);
      next(error);
    }
  }
}

export default new SystemConfigController();
