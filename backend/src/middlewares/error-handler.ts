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
    userId: req.user?.id ?? req.user?.uid
  });

  if (appError.options.shouldLog) {
    logger.error('[ErrorHandler] 捕获到异常', appError.toLogFormat());
  }

  const language = resolveLanguage(req.headers['accept-language']);
  const responseBody = appError.toJSON(language);
  const status = appError.statusCode;

  res.status(status).json(responseBody);
}
