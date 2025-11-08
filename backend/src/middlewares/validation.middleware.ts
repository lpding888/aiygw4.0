import type { NextFunction, Request, Response } from 'express';

// 针对熔断操作的最小校验：确保路径参数存在且格式合理
export const validateCircuitBreakerOperation = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { name } = req.params;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 4000,
        message: '无效的熔断器名称',
        details: { param: 'name' }
      }
    });
    return;
  }

  // 可按需扩展对 body 的操作合法性校验
  next();
};
