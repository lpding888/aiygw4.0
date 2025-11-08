import type { NextFunction, Request, Response } from 'express';
import AppError from '../utils/AppError.js';

type ErrorStat = {
  code: number;
  category?: string;
  severity?: string;
  count: number;
  lastOccurrence: number;
};

class EnhancedErrorStats {
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

  public snapshot(): { total: number; topErrors: ErrorStat[] } {
    const list = Array.from(this.stats.values()).sort((a, b) => b.count - a.count);
    const total = list.reduce((acc, s) => acc + s.count, 0);
    return { total, topErrors: list };
  }
}

const store = new EnhancedErrorStats();

// 可选：Express 错误处理中间件，未在 app.ts 全局注册，但保留给后续接入
export function enhancedErrorMiddleware(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const appErr = AppError.fromError(err);
    store.record(appErr.code, (appErr as any).category, (appErr as any).severity);
  } catch {
    // 非 AppError 也做简单统计
    store.record(5000);
  }
  next(err as any);
}

const enhancedErrorHandler = {
  getErrorStats: () => store.snapshot(),
  resetStats: () => store.reset()
};

export default enhancedErrorHandler;
