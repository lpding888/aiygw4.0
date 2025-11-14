import type { NextFunction, Request, Response } from 'express';
import {
  hasPermission,
  checkRoutePermission,
  logPermissionAccess,
  type PermissionAuditLog,
  type Resource,
  type Action,
  type UserRole
} from '../utils/rbac.js';
import logger from '../utils/logger.js';
import { enforcePermission as casbinEnforce } from '../services/security/casbin-enforcer.js';

interface PermissionOptions {
  resource?: Resource;
  actions?: Action[];
}

const routeToResource = (route: string): Resource => {
  if (route.startsWith('/admin/features')) return 'features';
  if (route.startsWith('/admin/providers')) return 'providers';
  if (route.startsWith('/admin/mcp')) return 'mcp';
  if (route.startsWith('/admin/pipelines')) return 'pipelines';
  if (route.startsWith('/admin/prompts')) return 'prompts';
  if (route.startsWith('/ui/menus')) return 'ui:menus';
  if (route.startsWith('/ui/schema')) return 'ui:schema';
  if (route.startsWith('/system')) return 'system';
  return 'unknown';
};

const methodToAction = (method: string, route: string): Action => {
  const normalized = method.toLowerCase();

  if (route.includes('/publish')) return 'publish';
  if (route.includes('/rollback')) return 'rollback';
  if (route.includes('/test') || route.includes('/preview')) return 'test';

  switch (normalized) {
    case 'get':
      return 'read';
    case 'post':
      return 'create';
    case 'put':
    case 'patch':
      return 'update';
    case 'delete':
      return 'delete';
    default:
      return 'read';
  }
};

const buildAuditLog = (
  req: Request,
  resource: Resource,
  action: Action,
  success: boolean,
  reason?: string
): PermissionAuditLog => ({
  userId: req.user?.id ?? 'anonymous',
  userRole: req.user?.role ?? 'viewer',
  resource,
  action,
  route: req.route?.path ?? req.path,
  method: req.method,
  ip: (req.ip ?? req.socket.remoteAddress ?? '').toString(),
  userAgent: req.get('User-Agent') ?? '',
  timestamp: new Date(),
  success,
  reason
});

export function requirePermission(options: PermissionOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 4010, message: '用户未认证，请先登录' },
          requestId: req.id
        });
        return;
      }

      const resource = options.resource ?? routeToResource(req.route?.path ?? req.path);
      const methodAction = methodToAction(req.method, req.route?.path ?? req.path);
      const actions = options.actions ?? [methodAction];

      let hasAccess = false;

      if (resource !== 'unknown') {
        const casbinDecisions = await Promise.all(
          actions.map((action) => casbinEnforce(req.user!.role, resource, action))
        );
        hasAccess = casbinDecisions.some(Boolean);
      }

      if (!hasAccess) {
        hasAccess =
          options.resource && options.actions
            ? actions.some((action) => hasPermission(req.user!.role, resource, action))
            : checkRoutePermission(req.user!.role, req.method, req.route?.path ?? req.path);
      }

      logPermissionAccess(
        buildAuditLog(req, resource, methodAction, hasAccess, hasAccess ? undefined : '权限不足')
      );

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: { code: 4030, message: '权限不足，无法访问该资源' },
          requestId: req.id
        });
        return;
      }

      req.userPermissions = {
        role: req.user.role,
        resource,
        actions: actions ?? [methodAction]
      };

      next();
    } catch (error) {
      logger.error('权限验证中间件错误:', error);
      res.status(500).json({
        success: false,
        error: { code: 5000, message: '权限验证失败' },
        requestId: req.id
      });
    }
  };
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 4010, message: '用户未认证，请先登录' },
        requestId: req.id
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: { code: 4030, message: '权限不足，需要更高权限' },
        requestId: req.id
      });
      return;
    }

    next();
  };
}

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void =>
  requireRole(['admin'])(req, res, next);

export const requireEditor = (req: Request, res: Response, next: NextFunction): void =>
  requireRole(['editor', 'admin'])(req, res, next);

export const requireViewer = (req: Request, res: Response, next: NextFunction): void =>
  requireRole(['viewer', 'editor', 'admin'])(req, res, next);
