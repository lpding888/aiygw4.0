/**
 * CMS验证中间件
 *
 * 使用Zod进行请求参数验证的中间件工厂
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { z } from 'zod';
import logger from '../utils/logger.js';

/**
 * 格式化Zod验证错误
 */
function formatZodErrors(issues: ZodIssue[]): {
  messages: string[];
  details: Array<{ field: string; message: string }>;
} {
  const messages = issues.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`);
  const details = issues.map((e: ZodIssue) => ({
    field: e.path.join('.'),
    message: e.message
  }));
  return { messages, details };
}

/**
 * 验证请求体的中间件工厂
 *
 * @param schema - Zod验证Schema
 * @returns Express中间件
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const { messages, details } = formatZodErrors(error.issues);
        logger.warn('[CMS验证] 请求体验证失败:', messages);
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: messages[0] || '验证失败',
            details
          }
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * 验证查询参数的中间件工厂
 *
 * @param schema - Zod验证Schema
 * @returns Express中间件
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.query);
      Object.assign(req.query, validated);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const { messages, details } = formatZodErrors(error.issues);
        logger.warn('[CMS验证] 查询参数验证失败:', messages);
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: messages[0] || '验证失败',
            details
          }
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * 验证路径参数的中间件工厂
 *
 * @param schema - Zod验证Schema
 * @returns Express中间件
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.params);
      Object.assign(req.params, validated);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const { messages, details } = formatZodErrors(error.issues);
        logger.warn('[CMS验证] 路径参数验证失败:', messages);
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: messages[0] || '验证失败',
            details
          }
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * 常用的ID参数验证Schema
 */
export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID必须为数字').transform(Number)
});

export type IdParam = z.infer<typeof idParamSchema>;
