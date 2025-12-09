import type { NextFunction, Request, Response } from 'express';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import notificationService from '../services/notification.service.js';
import { ERROR_CODES } from '../config/error-codes.js';
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '../config/i18n-messages.js';

const supportedLanguageCodes = new Set<SupportedLanguageCode>(
  Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguageCode[]
);

/**
 * 错误统计类 - 整合自 enhanced-error-handler.middleware.ts
 */
type ErrorStat = {
  code: number;
  category?: string;
  severity?: string;
  count: number;
  lastOccurrence: number;
};

class ErrorStatsCollector {
  private stats = new Map<number, ErrorStat>();

  public record(code: number, category?: string, severity?: string): void {
    const now = Date.now();
    const prev = this.stats.get(code);
    if (prev) {
      prev.count += 1;
      prev.lastOccurrence = now;
      if (category && !prev.category) prev.category = category;
      if (severity && !prev.severity) prev.severity = severity;
    } else {
      this.stats.set(code, { code, category, severity, count: 1, lastOccurrence: now });
    }
  }

  public reset(): void {
    this.stats.clear();
  }

  public snapshot(): { total: number; topErrors: ErrorStat[]; byCategory: Record<string, number>; bySeverity: Record<string, number> } {
    const list = Array.from(this.stats.values()).sort((a, b) => b.count - a.count);
    const total = list.reduce((acc, s) => acc + s.count, 0);

    // 按分类统计
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    list.forEach((stat) => {
      if (stat.category) {
        byCategory[stat.category] = (byCategory[stat.category] || 0) + stat.count;
      }
      if (stat.severity) {
        bySeverity[stat.severity] = (bySeverity[stat.severity] || 0) + stat.count;
      }
    });

    return { total, topErrors: list.slice(0, 10), byCategory, bySeverity };
  }
}

// 全局错误统计实例
const errorStats = new ErrorStatsCollector();

/**
 * 导出错误统计API
 */
export const errorStatsApi = {
  getStats: () => errorStats.snapshot(),
  reset: () => errorStats.reset()
};

const resolveLanguage = (
  header: string | string[] | undefined
): SupportedLanguageCode | undefined => {
  if (!header) {
    return undefined;
  }

  const raw = Array.isArray(header) ? header[0] : header;
  const candidate = raw.split(',')[0]?.trim() as SupportedLanguageCode | undefined;
  if (candidate && supportedLanguageCodes.has(candidate)) {
    return candidate;
  }
  return undefined;
};

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = AppError.custom(
    ERROR_CODES.INVALID_REQUEST,
    `路由未找到: ${req.method} ${req.originalUrl}`,
    {
      requestId: req.id,
      path: req.originalUrl,
      method: req.method
    }
  );
  next(error);
}

export function appErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const appError = AppError.fromError(err, ERROR_CODES.INTERNAL_SERVER_ERROR, {
    requestId: req.id,
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.id ?? req.user?.uid,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress
  });

  // 记录错误统计
  errorStats.record(appError.code, appError.metadata.category, appError.metadata.severity);

  // 记录增强的错误日志
  if (appError.options.shouldLog) {
    const logLevel =
      appError.metadata.severity === 'critical'
        ? 'error'
        : appError.metadata.severity === 'high'
          ? 'warn'
          : 'error';

    logger[logLevel]('[ErrorHandler] 捕获到异常', {
      ...appError.toLogFormat(),
      category: appError.metadata.category,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.socket.remoteAddress,
      body: req.method !== 'GET' ? req.body : undefined
    });
  }

  // 上报Prometheus指标 (延迟导入避免循环依赖)
  void (async () => {
    try {
      const metricsModule = await import('../services/metrics.service.js');
      metricsModule.default.recordTaskFailed(
        appError.metadata.category || 'unknown',
        String(appError.code)
      );
    } catch {
      // 忽略指标上报失败
    }
  })();

  // Critical错误需要特殊处理（如发送通知）
  if (appError.metadata.severity === 'critical' && appError.options.shouldNotify) {
    const notifyPayload = {
      title: '🚨 Critical Error Detected',
      message: `${appError.code} - ${appError.message}`,
      severity: 'critical' as const,
      context: {
        requestId: appError.requestId,
        userId: appError.userId,
        path: req.originalUrl,
        method: req.method,
        ip: req.ip || req.socket.remoteAddress
      }
    };
    logger.error('[ErrorHandler] 🚨 CRITICAL错误需要立即处理！', notifyPayload.context);
    void notificationService.notify(notifyPayload);
  }

  const language = resolveLanguage(req.headers['accept-language']);
  const responseBody = appError.toJSON(language);
  const status = appError.statusCode;

  // 添加响应头，帮助前端处理错误
  res.setHeader('X-Error-Code', String(appError.code));
  res.setHeader('X-Error-Category', appError.metadata.category);
  res.setHeader('X-Error-Severity', appError.metadata.severity);
  if (appError.requestId) {
    res.setHeader('X-Request-Id', appError.requestId);
  }

  res.status(status).json(responseBody);
}
