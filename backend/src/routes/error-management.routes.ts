import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import enhancedErrorHandler from '../middlewares/enhanced-error-handler.middleware.js';
import {
  ERROR_CODES,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  ERROR_METADATA
} from '../config/error-codes.js';
import AppError from '../utils/AppError.js';

const router = Router();

// GET /stats - 错误统计
router.get('/stats', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  try {
    const stats = enhancedErrorHandler.getErrorStats();
    res.json({ success: true, data: stats, timestamp: new Date().toISOString() });
  } catch (error) {
    const message =
      (req as any).i18n?.getErrorMessage?.(ERROR_CODES.INTERNAL_SERVER_ERROR) ??
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
router.get('/codes', authenticate, requireRole('admin'), (_req: Request, res: Response) => {
  try {
    const errorCodesList = Object.entries(ERROR_CODES)
      .filter(([key]) => !Number.isNaN(Number(key)))
      .map(([name, code]) => ({
        name,
        code: code as unknown as number,
        category: (ERROR_METADATA as any)[code]?.category ?? 'unknown',
        severity: (ERROR_METADATA as any)[code]?.severity ?? 'medium'
      }))
      .sort((a, b) => a.code - b.code);

    res.json({
      success: true,
      data: { categories: ERROR_CATEGORIES, severity: ERROR_SEVERITY, codes: errorCodesList },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    res.status(appError.statusCode).json(appError.toJSON((_req as any).i18n?.locale as any));
  }
});

// POST /reset-stats - 重置错误统计
router.post('/reset-stats', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  try {
    enhancedErrorHandler.resetStats();
    const message =
      (req as any).i18n?.getMessage?.('error.stats_reset') ?? 'Error statistics reset successfully';
    res.json({ success: true, message, timestamp: new Date().toISOString() });
  } catch (error) {
    const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    res.status(appError.statusCode).json(appError.toJSON((req as any).i18n?.locale));
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
      res.status(error.statusCode).json(error.toJSON((req as any).i18n?.locale));
      return;
    }
    const testError = AppError.custom(code as any, message as any, {
      ...context,
      testMode: true,
      requestedBy: (req as any).user?.id,
      timestamp: new Date().toISOString()
    });
    next(testError);
  } catch (error) {
    const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    next(appError);
  }
});

// GET /export - 导出CSV
router.get('/export', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  try {
    const stats = enhancedErrorHandler.getErrorStats();
    const csvHeaders = ['Code', 'Category', 'Severity', 'Count', 'Last Occurrence', 'Message'];
    const rows = (stats.topErrors ?? []).map((e: any) => [
      e.code,
      e.category,
      e.severity,
      e.count,
      new Date(e.lastOccurrence).toISOString(),
      ''
    ]);
    const csv = [csvHeaders, ...rows]
      .map((row: any[]) => row.map((cell: unknown) => `"${String(cell)}"`).join(','))
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="error-stats-${new Date().toISOString().split('T')[0]}.csv"`
    );
    res.send(csv);
  } catch (error) {
    const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    res.status(appError.statusCode).json(appError.toJSON((req as any).i18n?.locale));
  }
});

export default router;
