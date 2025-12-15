/**
 * 系统管理控制器（限流、缓存、仪表盘）
 */
import { Request, Response, NextFunction } from 'express';
import * as rateLimitConfigsRepo from '../repositories/rateLimitConfigs.repo.js';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';

class SystemController {
  // ============ API限流配置 ============
  async listRateLimitConfigs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { includeInactive } = req.query;
      const configs = await rateLimitConfigsRepo.listConfigs(includeInactive === 'true');
      res.json({ success: true, data: configs });
    } catch (error) {
      next(error);
    }
  }

  async createRateLimitConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await rateLimitConfigsRepo.createConfig(req.body);
      res.status(201).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async updateRateLimitConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await rateLimitConfigsRepo.updateConfig(parseInt(req.params.id), req.body);
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async deleteRateLimitConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await rateLimitConfigsRepo.deleteConfig(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // ============ 缓存管理 ============
  async getCacheStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const info = await redis.info('memory');
      const keyCount = await redis.dbsize();
      const lines = info.split('\r\n');
      const memoryUsed =
        lines.find((l) => l.startsWith('used_memory_human:'))?.split(':')[1] || 'N/A';
      res.json({ success: true, data: { keyCount, memoryUsed } });
    } catch (error) {
      next(error);
    }
  }

  async listCacheKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pattern = '*', limit = 100 } = req.query;
      const keys = await redis.keys(pattern as string);
      res.json({
        success: true,
        data: { keys: keys.slice(0, parseInt(limit as string)), total: keys.length }
      });
    } catch (error) {
      next(error);
    }
  }

  async getCacheValue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;
      const value = await redis.get(key);
      const ttl = await redis.ttl(key);
      res.json({ success: true, data: { key, value, ttl } });
    } catch (error) {
      next(error);
    }
  }

  async deleteCacheKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;
      await redis.del(key);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async clearCachePattern(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pattern } = req.body;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
      res.json({ success: true, data: { deleted: keys.length } });
    } catch (error) {
      next(error);
    }
  }

  // ============ 数据仪表盘 ============
  async getDashboardStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [users, tasks, orders, announcements, showcases, templates, reviews] =
        await Promise.all([
          db('users').count('id as count').first(),
          db('tasks').count('id as count').first(),
          db('orders').count('id as count').first(),
          db('announcements').where('status', 'published').count('id as count').first(),
          db('showcases').where('status', 'published').count('id as count').first(),
          db('templates').where('status', 'published').count('id as count').first(),
          db('reviews').where('status', 'approved').count('id as count').first()
        ]);

      const recentTasks = await db('tasks')
        .select('status')
        .count('id as count')
        .where('created_at', '>', db.raw('DATE_SUB(NOW(), INTERVAL 7 DAY)'))
        .groupBy('status');

      res.json({
        success: true,
        data: {
          totals: {
            users: parseInt((users?.count as string) || '0'),
            tasks: parseInt((tasks?.count as string) || '0'),
            orders: parseInt((orders?.count as string) || '0'),
            announcements: parseInt((announcements?.count as string) || '0'),
            showcases: parseInt((showcases?.count as string) || '0'),
            templates: parseInt((templates?.count as string) || '0'),
            reviews: parseInt((reviews?.count as string) || '0')
          },
          recentTasks: recentTasks.reduce(
            (acc, r) => {
              acc[r.status] = parseInt(r.count as string);
              return acc;
            },
            {} as Record<string, number>
          )
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getCmsContentStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tables = [
        'announcements',
        'banners',
        'showcases',
        'templates',
        'help_articles',
        'changelogs',
        'campaigns',
        'popups',
        'forms',
        'tags'
      ];
      const stats: Record<string, number> = {};
      for (const table of tables) {
        try {
          const result = await db(table).count('id as count').first();
          stats[table] = parseInt((result?.count as string) || '0');
        } catch {
          stats[table] = 0;
        }
      }
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

export default new SystemController();
