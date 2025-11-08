import type { NextFunction, Request, Response } from 'express';
import cacheService from '../services/cache.service.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

interface ResponseCacheOptions {
  ttl?: number;
  keyGenerator?: ((req: Request) => string) | null;
  condition?: (req: Request, res: Response) => boolean;
  namespace?: string;
  skipCache?: boolean;
  headersToInclude?: string[];
  queryParamsToInclude?: string[];
}

class CacheMiddleware {
  responseCache(
    options: ResponseCacheOptions = {}
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    const {
      ttl = 300,
      keyGenerator = null,
      condition = () => true,
      namespace = 'api_response',
      skipCache = false,
      headersToInclude = [],
      queryParamsToInclude = []
    } = options;

    return async (req, res, next) => {
      try {
        if (skipCache || !condition(req, res)) {
          return next();
        }

        const cacheKey = keyGenerator
          ? keyGenerator(req)
          : this.generateCacheKey(req, namespace, headersToInclude, queryParamsToInclude);

        const cachedResponse = await cacheService.getWithVersion(namespace, cacheKey);
        if (cachedResponse) {
          logger.debug(`[CacheMiddleware] 缓存命中: ${cacheKey}`);
          res.set('X-Cache', 'HIT');
          res.set('X-Cache-Key', cacheKey);
          res.json(cachedResponse);
          return;
        }

        const originalJson = res.json.bind(res);
        res.json = ((data: any) => {
          cacheService
            .setWithVersion(namespace, cacheKey, data, ttl)
            .then(() => {
              logger.debug(`[CacheMiddleware] 响应已缓存: ${cacheKey}`);
            })
            .catch((error: any) => {
              logger.warn(`[CacheMiddleware] 响应缓存失败: ${cacheKey}`, error);
            });

          (res as any).set('X-Cache', 'MISS');
          (res as any).set('X-Cache-Key', cacheKey);
          return originalJson(data);
        }) as any;

        next();
      } catch (error) {
        logger.error('[CacheMiddleware] 缓存中间件错误', error as any);
        next();
      }
    };
  }

  userCache(options: { ttl?: number; namespace?: string } = {}) {
    const { ttl = 600, namespace = 'user_data' } = options;
    return this.responseCache({
      ttl,
      namespace,
      keyGenerator: (req) => {
        const userId =
          (req as any).user?.id || (req.params as any).userId || (req.query as any).userId;
        return `user:${userId}:${req.originalUrl}`;
      },
      condition: (req) => Boolean((req as any).user)
    });
  }

  adminCache(options: { ttl?: number; namespace?: string } = {}) {
    const { ttl = 180, namespace = 'admin_data' } = options;
    return this.responseCache({
      ttl,
      namespace,
      keyGenerator: (req) => {
        const adminId = (req as any).user?.id;
        const path = req.originalUrl;
        const query = JSON.stringify(req.query);
        return `admin:${adminId}:${path}:${query}`;
      },
      condition: (req) => (req as any).user?.role === 'admin'
    });
  }

  featureCache(options: { ttl?: number; namespace?: string } = {}) {
    const { ttl = 3600, namespace = 'feature_config' } = options;
    return this.responseCache({
      ttl,
      namespace,
      keyGenerator: (req) => {
        const featureId = (req.params as any).featureId || (req.query as any).featureId;
        return `feature:${featureId}`;
      },
      condition: (req) =>
        req.originalUrl.includes('/feature/') || req.originalUrl.includes('/api/features')
    });
  }

  statsCache(options: { ttl?: number; namespace?: string } = {}) {
    const { ttl = 900, namespace = 'stats_data' } = options;
    return this.responseCache({
      ttl,
      namespace,
      keyGenerator: (req) => {
        const userId = (req as any).user?.id;
        const path = req.originalUrl;
        const query = JSON.stringify(req.query);
        return `stats:${userId}:${path}:${query}`;
      },
      condition: (req) =>
        req.originalUrl.includes('/stats/') ||
        req.originalUrl.includes('/analytics/') ||
        req.originalUrl.includes('/dashboard')
    });
  }

  generateCacheKey(
    req: Request,
    namespace: string,
    headersToInclude: string[] = [],
    queryParamsToInclude: string[] = []
  ): string {
    try {
      const keyComponents: string[] = [req.method.toLowerCase(), req.path];

      if ((req as any).user?.id) {
        keyComponents.push(`user:${(req as any).user.id}`);
      }

      if (queryParamsToInclude.length > 0) {
        const queryParams: Record<string, unknown> = {};
        for (const param of queryParamsToInclude) {
          const q = (req.query as any)[param];
          if (q !== undefined) queryParams[param] = q;
        }
        if (Object.keys(queryParams).length > 0) {
          keyComponents.push(`q:${JSON.stringify(queryParams)}`);
        }
      } else if (Object.keys(req.query).length > 0) {
        keyComponents.push(`q:${JSON.stringify(req.query)}`);
      }

      if (headersToInclude.length > 0) {
        const headers: Record<string, unknown> = {};
        for (const header of headersToInclude) {
          const v = (req.headers as any)[header];
          if (v) headers[header] = v;
        }
        if (Object.keys(headers).length > 0) {
          keyComponents.push(`h:${JSON.stringify(headers)}`);
        }
      }

      const baseKey = keyComponents.join(':');
      const hash = crypto.createHash('md5').update(baseKey).digest('hex').substring(0, 8);
      return `${namespace}:${hash}:${baseKey.substring(0, 100)}`;
    } catch (error) {
      logger.error('[CacheMiddleware] 生成缓存键失败', error as any);
      return `${namespace}:${req.method}:${req.path}:${Date.now()}`;
    }
  }

  clearCache(namespace: string, pattern: string | null = null) {
    return async (_req: Request, _res: Response, next: NextFunction) => {
      try {
        if (pattern) {
          await cacheService.deletePattern(`${namespace}:${pattern}*`);
          logger.info(`[CacheMiddleware] 清除缓存: ${namespace}:${pattern}*`);
        } else {
          await cacheService.incrementVersion(namespace);
          logger.info(`[CacheMiddleware] 清除命名空间缓存: ${namespace}`);
        }
        next();
      } catch (error) {
        logger.error('[CacheMiddleware] 清除缓存失败', error as any);
        next();
      }
    };
  }

  cacheControl() {
    return (req: Request, res: Response, next: NextFunction) => {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      if ((req.query as any).nocache === 'true') {
        const namespace = ((req.headers as any)['x-cache-namespace'] as string) || 'api_response';
        const pattern = (req.headers as any)['x-cache-pattern'] as string | undefined;

        if (pattern) {
          cacheService
            .deletePattern(`${namespace}:${pattern}*`)
            .then(() => logger.info(`[CacheMiddleware] 强制清除缓存: ${namespace}:${pattern}*`))
            .catch((error: any) => logger.warn('[CacheMiddleware] 强制清除缓存失败', error));
        } else {
          cacheService
            .incrementVersion(namespace)
            .then(() => logger.info(`[CacheMiddleware] 强制清除命名空间: ${namespace}`))
            .catch((error: any) => logger.warn('[CacheMiddleware] 强制清除命名空间失败', error));
        }
      }

      next();
    };
  }

  conditionalCache(
    condition: (req: Request, res: Response) => boolean,
    cacheOptions: Omit<ResponseCacheOptions, 'condition'> = {}
  ) {
    const options: ResponseCacheOptions = {
      ...cacheOptions,
      condition: (req, res) => {
        try {
          return condition(req, res);
        } catch (error) {
          logger.error('[CacheMiddleware] 条件判断失败', error as any);
          return false;
        }
      }
    };
    return this.responseCache(options);
  }

  timeBasedCache(
    timeConfig: {
      workHours?: { start: number; end: number };
      workDays?: number[];
      timezone?: string;
    } = {},
    cacheOptions: ResponseCacheOptions & { workTTL?: number; offWorkTTL?: number } = {}
  ) {
    const { workHours = { start: 9, end: 18 }, workDays = [1, 2, 3, 4, 5] } = timeConfig;
    const options: ResponseCacheOptions & { workTTL?: number; offWorkTTL?: number } = {
      ...cacheOptions,
      condition: (_req) => {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        const isWorkHour = hour >= workHours.start && hour < workHours.end;
        const isWorkDay = workDays.includes(day);
        if (isWorkHour && isWorkDay) {
          (options as any).ttl = cacheOptions.workTTL || 300;
        } else {
          (options as any).ttl = cacheOptions.offWorkTTL || 1800;
        }
        return true;
      }
    };
    return this.responseCache(options);
  }

  cacheStats() {
    return (_req: Request, res: Response, next: NextFunction) => {
      if (_req.path === '/cache/stats') {
        return res.json({
          success: true,
          data: { ...(cacheService.getStats() as any), timestamp: new Date().toISOString() }
        });
      }
      next();
    };
  }

  cacheHealthCheck() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/cache/health') {
        try {
          const health = await cacheService.healthCheck();
          return res.json({ success: true, data: health });
        } catch (error: any) {
          return res.status(503).json({ success: false, error: error.message });
        }
      }
      next();
    };
  }
}

const cacheMiddleware = new CacheMiddleware();
export default cacheMiddleware;
