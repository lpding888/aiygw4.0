import type { NextFunction, Request, Response } from 'express';
import * as securityService from '../services/security.service.js';
import { createErrorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export const rateLimit = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = config.keyGenerator
        ? config.keyGenerator(req)
        : `rate_limit:${req.ip}:${req.path}`;

      const result = await securityService.checkRateLimit(key, {
        windowMs: config.windowMs,
        maxRequests: config.maxRequests,
        message: config.message || '请求过于频繁，请稍后再试'
      });

      res.set({
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetTime.getTime() / 1000))
      });

      if (!result.allowed) {
        res
          .status(429)
          .json(
            createErrorResponse(
              'RATE_LIMIT_EXCEEDED',
              config.message || '请求过于频繁，请稍后再试',
              { retryAfter: result.retryAfter, resetTime: result.resetTime }
            )
          );
        return;
      }

      next();
    } catch (error) {
      logger.error('限流中间件错误:', error as any);
      next();
    }
  };
};

export const dataMasking = (rules: any[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    (res as any).json = ((data: any) => {
      if (data && (data as any).data) {
        (data as any).data = securityService.maskData((data as any).data, rules as any);
      }
      return originalJson(data);
    }) as any;
    next();
  };
};
export const securityCheck = (options: { skipCriticalCheck?: boolean } = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const checks = await securityService.performHealthChecks();
      const criticalIssues = (checks.checks ?? []).filter(
        (check: any) => check.status === 'unhealthy' && check.details?.severity === 'critical'
      );

      if (criticalIssues.length > 0 && !options.skipCriticalCheck) {
        logger.error('发现严重安全问题:', criticalIssues);
        res.status(503).json(
          createErrorResponse('SECURITY_ISSUE', '系统安全问题，暂时无法提供服务', {
            issues: criticalIssues
          })
        );
        return;
      }

      (req as any).securityChecks = checks;
      next();
    } catch (error) {
      logger.error('安全检查中间件错误:', error as any);
      next();
    }
  };
};

export const suspiciousActivityDetection = (options: Record<string, unknown> = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const suspicious = await securityService.detectSuspiciousActivity(req.ip as string);

      if ((suspicious as any).isSuspicious) {
        logger.warn('检测到可疑活动:', suspicious as any);
        await securityService.logSecurityEvent({
          type: 'suspicious_activity',
          severity: (suspicious as any).severity,
          userId: (req as any).user?.id,
          ip: String(req.ip ?? ''),
          userAgent: req.get('User-Agent') ?? '',
          endpoint: req.path,
          method: req.method,
          details: suspicious as any
        });

        if (
          (suspicious as any).severity === 'high' ||
          (suspicious as any).severity === 'critical'
        ) {
          res
            .status(403)
            .json(
              createErrorResponse(
                'SUSPICIOUS_ACTIVITY',
                '请求被标记为可疑活动，已被阻止',
                suspicious as any
              )
            );
          return;
        }
      }

      next();
    } catch (error) {
      logger.error('可疑活动检测中间件错误:', error as any);
      next();
    }
  };
};

export const securityAudit = (
  options: { includeRequestData?: boolean; includeResponseData?: boolean } = {}
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);
    const startTime = Date.now();

    const audit = (statusCode: number, data: unknown) => {
      const auditData = {
        method: req.method,
        endpoint: req.path,
        statusCode,
        userId: (req as any).user?.id,
        ip: String(req.ip ?? ''),
        userAgent: req.get('User-Agent') ?? '',
        responseTime: Date.now() - startTime,
        requestData: options.includeRequestData ? (req as any).body : undefined,
        responseData: options.includeResponseData ? data : undefined
      };
      securityService.logSecurityEvent({
        type: 'data_access',
        severity: statusCode >= 400 ? 'medium' : 'low',
        userId: (req as any).user?.id,
        ip: String(req.ip ?? ''),
        endpoint: req.path,
        method: req.method,
        details: auditData
      });
    };

    (res as any).send = ((data: any) => {
      audit(res.statusCode, data);
      return originalSend(data);
    }) as any;

    (res as any).json = ((data: any) => {
      audit(res.statusCode, data);
      return originalJson(data);
    }) as any;

    next();
  };
};

export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = (req.ip || (req.connection as any).remoteAddress) as string;
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      logger.warn(`IP ${clientIP} 不在白名单中，拒绝访问`);
      res.status(403).json(createErrorResponse('IP_NOT_ALLOWED', 'IP地址不在允许范围中'));
      return;
    }
    next();
  };
};

export const forceHTTPS = (options: { skipInDev?: boolean } = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if ((req as any).secure || req.headers['x-forwarded-proto'] === 'https') {
      next();
      return;
    }
    if (process.env.NODE_ENV === 'development' && options.skipInDev) {
      next();
      return;
    }
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    res.redirect(301, httpsUrl);
  };
};

export const securityHeaders = (options: Record<string, string> = {}) => {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': options['frameOptions'] || 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': options['hsts'] || 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': options['csp'] || "default-src 'self'",
      'Referrer-Policy': options['referrerPolicy'] || 'strict-origin-when-cross-origin',
      'Permissions-Policy':
        options['permissionsPolicy'] || 'geolocation=(), microphone=(), camera=()'
    });
    next();
  };
};
