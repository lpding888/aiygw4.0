/**
 * JWT认证中间件 - 支持双Token机制
 * 艹，真正的TypeScript版本，不偷懒！
 */

import { Request, Response, NextFunction } from 'express';
import tokenService from '../services/token.service.js';
import logger from '../utils/logger.js';
import { UserRole } from '../utils/rbac.js';

/**
 * 用户信息接口
 * 艹，必须和require-permission.middleware.ts里定义的类型一致！
 */
export interface UserPayload {
  id: string;
  role: UserRole;
  uid?: string; // token中可能用uid存储id
  jti?: string;
  phone?: string;
  source?: string;
  [key: string]: unknown;
}

/**
 * 扩展后的请求对象，保留用户信息和Token，别乱删！
 */
export interface AuthRequest extends Request {
  user?: UserPayload;
  userId?: string;
  token?: string;
}

const ALLOWED_ROLES: readonly UserRole[] = ['viewer', 'editor', 'admin'] as const;

function normalizeUserPayload(payload: unknown): UserPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const raw = payload as Record<string, unknown>;
  const identifier = raw.uid ?? raw.id ?? raw.userId;

  if (typeof identifier !== 'string' || identifier.length === 0) {
    return null;
  }

  const roleCandidate = typeof raw.role === 'string' ? (raw.role as string) : undefined;
  const normalizedRole = ALLOWED_ROLES.includes(roleCandidate as UserRole)
    ? (roleCandidate as UserRole)
    : 'viewer';

  return {
    ...(payload as Record<string, unknown>),
    id: identifier,
    uid: (raw.uid as string | undefined) ?? identifier,
    role: normalizedRole,
    jti: typeof raw.jti === 'string' ? raw.jti : undefined,
    phone: typeof raw.phone === 'string' ? raw.phone : undefined
  };
}

/**
 * JWT认证中间件
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    // 获取token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未登录或Token格式错误'
        }
      });
      return;
    }

    const token = authHeader.substring(7);
    authReq.token = token; // 保存原始token供其他中间件使用

    // 验证Access Token
    const decoded = tokenService.verifyAccessToken(token);
    const normalizedUser = normalizeUserPayload(decoded);

    if (!normalizedUser) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token无效'
        }
      });
      return;
    }

    // 检查Token是否在黑名单中
    const isBlacklisted = await tokenService.isTokenBlacklisted(normalizedUser.jti ?? '');
    if (isBlacklisted) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_BLACKLISTED',
          message: 'Token已失效'
        }
      });
      return;
    }

    // 检查用户是否被撤销
    const isRevoked = await tokenService.isUserRevoked(normalizedUser.id);
    if (isRevoked) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_REVOKED',
          message: '用户登录状态已失效'
        }
      });
      return;
    }

    // 将用户信息附加到请求对象
    // 艹，注意decoded.role可能是string需要转换为UserRole！
    authReq.userId = normalizedUser.id;
    authReq.user = normalizedUser;

    logger.debug(
      `[AuthMiddleware] 用户认证成功: userId=${normalizedUser.id}, role=${normalizedUser.role}`
    );
    next();
  } catch (error) {
    const err = error as Error;
    logger.error('JWT验证失败:', error);

    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: '登录已过期，请刷新Token或重新登录'
        }
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token无效'
      }
    });
  }
}

/**
 * 可选认证中间件(用于某些接口既可登录也可不登录访问)
 */
export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      authReq.token = token;

      // 尝试验证token
      const decoded = tokenService.verifyAccessToken(token);
      const normalizedUser = normalizeUserPayload(decoded);
      if (normalizedUser) {
        // 检查黑名单和撤销状态
        const isBlacklisted = await tokenService.isTokenBlacklisted(normalizedUser.jti ?? '');
        const isRevoked = await tokenService.isUserRevoked(normalizedUser.id);

        if (!isBlacklisted && !isRevoked) {
          authReq.userId = normalizedUser.id;
          authReq.user = normalizedUser;
        }
      }
    }
    next();
  } catch (error) {
    const err = error as Error;
    // 可选认证失败不阻止请求继续
    logger.debug('可选认证失败:', err.message);
    next();
  }
}

/**
 * 角色权限检查中间件
 * @param requiredRoles - 需要的角色
 * @returns 中间件函数
 */
export function requireRole(requiredRoles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未登录'
        }
      });
      return;
    }

    const userRole = authReq.user.role;
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    if (!roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: '权限不足'
        }
      });
      return;
    }

    logger.debug(
      `[AuthMiddleware] 权限检查通过: userId=${authReq.user.uid}, role=${userRole}, required=${roles.join(',')}`
    );
    next();
  };
}

/**
 * 管理员权限检查
 */
export const requireAdmin = requireRole(['admin']);

/**
 * 用户或管理员权限检查
 */
export const requireUserOrAdmin = requireRole(['user', 'admin']);

/**
 * API Key认证中间件（用于系统间调用）
 */
export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const apiKey = authReq.headers['x-api-key'];
    const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];

    if (!apiKey || !validApiKeys.includes(apiKey as string)) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'API Key无效'
        }
      });
      return;
    }

    // 设置系统用户标识
    // 艹，'system'不是合法的UserRole，用'admin'代替！
    authReq.user = {
      id: 'system',
      uid: 'system',
      role: 'admin' as UserRole,
      source: 'api_key'
    };
    authReq.userId = 'system';

    logger.debug('[AuthMiddleware] API Key认证成功');
    next();
  } catch (error) {
    logger.error('API Key认证失败:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'API_KEY_AUTH_FAILED',
        message: 'API Key认证失败'
      }
    });
  }
}
