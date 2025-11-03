const rbacService = require('../services/rbac.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * 权限验证中间件
 */
class RequirePermissionMiddleware {
  /**
   * 创建权限验证中间件
   * @param {string} resource - 资源类型
   * @param {string|string[]} actions - 允许的操作
   * @returns {Function}
   */
  static require(resource, actions) {
    return (req, res, next) => {
      try {
        const user = req.user;
        if (!user) {
          throw new AppError('需要登录', 401, 'AUTH_REQUIRED');
        }

        const userRole = rbacService.getUserRole(user);
        const actionArray = Array.isArray(actions) ? actions : [actions];

        // 检查是否有任一权限
        const hasPermission = actionArray.some(action =>
          rbacService.hasPermission(userRole, resource, action)
        );

        if (!hasPermission) {
          logger.warn(`[Permission] Access denied - User: ${user.id}(${userRole}) - ` +
                     `Resource: ${resource} - Actions: ${actionArray.join(',')} - ` +
                     `IP: ${req.ip} - Path: ${req.path}`);

          throw new AppError('权限不足', 403, 'PERMISSION_DENIED');
        }

        // 记录权限访问日志
        rbacService.logPermissionAccess({
          userId: user.id,
          userRole,
          resource,
          action: actionArray[0], // 记录第一个操作
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          allowed: true
        });

        // 将用户角色添加到请求对象
        req.userRole = userRole;
        next();

      } catch (error) {
        if (error instanceof AppError) {
          return res.status(error.statusCode).json({
            success: false,
            code: error.errorCode,
            message: error.message,
            requestId: req.id
          });
        }

        logger.error('[Permission] Middleware error:', error);
        return res.status(500).json({
          success: false,
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
          requestId: req.id
        });
      }
    };
  }

  /**
   * 检查路由权限的中间件
   * @param {Object} options - 选项
   * @returns {Function}
   */
  static checkRoute(options = {}) {
    return (req, res, next) => {
      try {
        const user = req.user;
        if (!user && !options.skipAuth) {
          throw new AppError('需要登录', 401, 'AUTH_REQUIRED');
        }

        // 如果跳过认证或用户存在，检查路由权限
        if (options.skipAuth || user) {
          const userRole = user ? rbacService.getUserRole(user) : rbacService.ROLES.VIEWER;
          const hasPermission = rbacService.checkRoutePermission(
            userRole,
            req.method,
            req.path
          );

          if (!hasPermission) {
            logger.warn(`[RoutePermission] Access denied - User: ${user?.id || 'anonymous'}(${userRole}) - ` +
                       `${req.method} ${req.path} - IP: ${req.ip}`);

            throw new AppError('权限不足', 403, 'PERMISSION_DENIED');
          }

          // 记录访问日志
          rbacService.logPermissionAccess({
            userId: user?.id,
            userRole,
            resource: rbacService.extractResourceFromPath(req.path) || 'unknown',
            action: req.method.toLowerCase(),
            path: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            allowed: true
          });

          req.userRole = userRole;
        }

        next();

      } catch (error) {
        if (error instanceof AppError) {
          return res.status(error.statusCode).json({
            success: false,
            code: error.errorCode,
            message: error.message,
            requestId: req.id
          });
        }

        logger.error('[RoutePermission] Middleware error:', error);
        return res.status(500).json({
          success: false,
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
          requestId: req.id
        });
      }
    };
  }

  /**
   * 角色验证中间件
   * @param {string|string[]} allowedRoles - 允许的角色
   * @returns {Function}
   */
  static requireRole(allowedRoles) {
    const roleArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return (req, res, next) => {
      try {
        const user = req.user;
        if (!user) {
          throw new AppError('需要登录', 401, 'AUTH_REQUIRED');
        }

        const userRole = rbacService.getUserRole(user);

        if (!roleArray.includes(userRole)) {
          logger.warn(`[RolePermission] Access denied - User: ${user.id}(${userRole}) - ` +
                     `Required roles: ${roleArray.join(',')} - IP: ${req.ip}`);

          throw new AppError('角色权限不足', 403, 'ROLE_PERMISSION_DENIED');
        }

        // 记录访问日志
        rbacService.logPermissionAccess({
          userId: user.id,
          userRole,
          resource: 'role_check',
          action: 'access',
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          allowed: true
        });

        req.userRole = userRole;
        next();

      } catch (error) {
        if (error instanceof AppError) {
          return res.status(error.statusCode).json({
            success: false,
            code: error.errorCode,
            message: error.message,
            requestId: req.id
          });
        }

        logger.error('[RolePermission] Middleware error:', error);
        return res.status(500).json({
          success: false,
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
          requestId: req.id
        });
      }
    };
  }

  /**
   * 管理员权限中间件
   * @returns {Function}
   */
  static requireAdmin() {
    return this.requireRole([rbacService.ROLES.ADMIN]);
  }

  /**
   * 编辑者及以上权限中间件
   * @returns {Function}
   */
  static requireEditor() {
    return this.requireRole([rbacService.ROLES.EDITOR, rbacService.ROLES.ADMIN]);
  }
}

module.exports = RequirePermissionMiddleware;