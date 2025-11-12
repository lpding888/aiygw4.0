import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import enhancedErrorHandler from '../middlewares/enhanced-error-handler.middleware.js';
import {
  ERROR_CODES,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  ERROR_METADATA,
  type ErrorCode
} from '../config/error-codes.js';
import type { SupportedLanguageCode } from '../config/i18n-messages.js';
import AppError from '../utils/AppError.js';

const router = Router();

const resolveLocale = (req: Request): SupportedLanguageCode => {
  const locale = req.i18n?.locale;
  return locale === 'zh-CN' || locale === 'ja-JP' ? locale : 'en-US';
};

// GET /stats - 错误统计
router.get('/stats', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  try {
    const stats = enhancedErrorHandler.getErrorStats();
    res.json({ success: true, data: stats, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    const message =
      req.i18n?.getErrorMessage?.(ERROR_CODES.INTERNAL_SERVER_ERROR) ??
      'Failed to get error statistics';
    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// GET /codes - 错误码列表
router.get('/codes', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  try {
    interface ErrorMetadataEntry {
      category?: string;
      severity?: string;
    }

    const errorCodesList = Object.entries(ERROR_CODES)
      .filter(([key]) => !Number.isNaN(Number(key)))
      .map(([name, code]) => {
        const metadata = (ERROR_METADATA as Record<string, ErrorMetadataEntry>)[code] ?? {};
        return {
          name,
          code: code as unknown as number,
          category: metadata.category ?? 'unknown',
          severity: metadata.severity ?? 'medium'
        };
      })
      .sort((a, b) => a.code - b.code);

    res.json({
      success: true,
      data: { categories: ERROR_CATEGORIES, severity: ERROR_SEVERITY, codes: errorCodesList },
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    const locale = resolveLocale(req);
    res.status(appError.statusCode).json(appError.toJSON(locale));
  }
});

// POST /reset-stats - 重置错误统计
router.post('/reset-stats', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  try {
    enhancedErrorHandler.resetStats();
    const message =
      req.i18n?.getMessage?.('error.stats_reset') ?? 'Error statistics reset successfully';
    res.json({ success: true, message, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    const locale = resolveLocale(req);
    res.status(appError.statusCode).json(appError.toJSON(locale));
  }
});

// POST /test - 触发测试错误
router.post('/test', authenticate, requireRole('admin'), (req: Request, res: Response, next) => {
  try {
    const {
      code,
      message,
      context = {}
    } = (req.body ?? {}) as { code?: number; message?: string; context?: Record<string, unknown> };
    if (!code || typeof code !== 'number') {
      const error = AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
        field: 'code',
        reason: 'Code must be a valid error code number'
      });
      const locale = resolveLocale(req);
      res.status(error.statusCode).json(error.toJSON(locale));
      return;
    }
    const testError = AppError.custom(code as ErrorCode, message ?? '', {
      ...context,
      testMode: true,
      requestedBy: req.user?.id,
      timestamp: new Date().toISOString()
    });
    next(testError);
  } catch (error: unknown) {
    const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    next(appError);
  }
});

// GET /export - 导出CSV
router.get('/export', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  try {
    const stats = enhancedErrorHandler.getErrorStats();
    const csvHeaders = ['Code', 'Category', 'Severity', 'Count', 'Last Occurrence', 'Message'];
    const rows = (stats.topErrors ?? []).map((e) => [
      e.code,
      e.category ?? 'unknown',
      e.severity ?? 'unknown',
      e.count,
      new Date(e.lastOccurrence).toISOString(),
      ''
    ]);
    const csv = [csvHeaders, ...rows]
      .map((row: Array<string | number>) =>
        row.map((cell: string | number) => `"${String(cell)}"`).join(',')
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="error-stats-${new Date().toISOString().split('T')[0]}.csv"`
    );
    res.send(csv);
  } catch (error: unknown) {
    const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    const locale = resolveLocale(req);
    res.status(appError.statusCode).json(appError.toJSON(locale));
  }
});

export default router;
