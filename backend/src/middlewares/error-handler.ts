import type { NextFunction, Request, Response } from 'express';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { ERROR_CODES } from '../config/error-codes.js';
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '../config/i18n-messages.js';

const supportedLanguageCodes = new Set<SupportedLanguageCode>(
  Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguageCode[]
);

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

  // Critical错误需要特殊处理（如发送通知）
  if (appError.metadata.severity === 'critical' && appError.options.shouldNotify) {
    // TODO: 集成通知服务（邮件、Slack、钉钉等）
    logger.error('[ErrorHandler] 🚨 CRITICAL错误需要立即处理！', {
      code: appError.code,
      message: appError.message,
      requestId: appError.requestId,
      userId: appError.userId,
      path: req.originalUrl
    });
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
