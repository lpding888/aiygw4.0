const { hasPermission, checkRoutePermission, logPermissionAccess } = require('../utils/rbac');
const logger = require('../utils/logger');

/**
 * 权限验证中间件工厂函数
 *
 * 使用方式：
 * app.use('/admin/features', authenticateToken, requirePermission({
 *   resource: 'features',
 *   actions: ['read', 'update']
 * }), featuresRoutes);
 */
function requirePermission(options) {
  const { resource, actions } = options;

  return (req, res, next) => {
    try {
      // 检查用户是否已认证
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 4010,
            message: '用户未认证，请先登录'
          },
          requestId: req.id
        });
      }

      const userRole = req.user.role;
      const method = req.method;
      const route = req.route?.path || req.path;

      // 检查具体权限
      let hasAccess = false;
      if (resource && actions) {
        // 检查指定的资源权限
        hasAccess = actions.some(action => hasPermission(userRole, resource, action));
      } else {
        // 自动根据路由检查权限
        hasAccess = checkRoutePermission(userRole, method, route);
      }

      // 记录审计日志
      const auditLog = {
        userId: req.user.id,
        userRole,
        resource: resource || extractResourceFromRoute(route),
        action: extractActionFromMethod(method, route),
        route,
        method,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
        success: hasAccess,
        reason: hasAccess ? undefined : '权限不足'
      };

      logPermissionAccess(auditLog);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 4030,
            message: '权限不足，无法访问该资源'
          },
          requestId: req.id
        });
      }

      // 在请求对象中添加权限信息，供后续中间件使用
      req.userPermissions = {
        role: userRole,
        resource: resource || extractResourceFromRoute(route),
        actions: actions || [extractActionFromMethod(method, route)]
      };

      next();
    } catch (error) {
      logger.error('权限验证中间件错误:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 5000,
          message: '权限验证失败'
        },
        requestId: req.id
      });
    }
  };
}

/**
 * 从路由中提取资源名称
 */
function extractResourceFromRoute(route) {
  if (route.startsWith('/admin/features')) return 'features';
  if (route.startsWith('/admin/providers')) return 'providers';
  if (route.startsWith('/admin/mcp')) return 'mcp';
  if (route.startsWith('/admin/pipelines')) return 'pipelines';
  if (route.startsWith('/admin/prompts')) return 'prompts';
  if (route.startsWith('/ui/menus')) return 'ui:menus';
  if (route.startsWith('/ui/schema')) return 'ui:schema';
  if (route.startsWith('/system')) return 'system';
  return 'unknown';
}

/**
 * 从HTTP方法和路由中提取动作
 */
function extractActionFromMethod(method, route) {
  let action = method.toLowerCase();

  if (action === 'get') action = 'read';
  else if (action === 'post') action = 'create';
  else if (action === 'put' || action === 'patch') action = 'update';
  else if (action === 'delete') action = 'delete';

  // 特殊动作
  if (route.includes('/publish')) action = 'publish';
  else if (route.includes('/rollback')) action = 'rollback';
  else if (route.includes('/test')) action = 'test';
  else if (route.includes('/preview')) action = 'test';

  return action;
}

/**
 * 角色验证中间件
 * 检查用户是否具有指定角色
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 4010,
          message: '用户未认证，请先登录'
        },
        requestId: req.id
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 4030,
          message: '权限不足，需要更高权限'
        },
        requestId: req.id
      });
    }

    next();
  };
}

/**
 * 管理员权限验证中间件
 */
function requireAdmin(req, res, next) {
  return requireRole(['admin'])(req, res, next);
}

/**
 * 编辑者权限验证中间件（editor及以上）
 */
function requireEditor(req, res, next) {
  return requireRole(['editor', 'admin'])(req, res, next);
}

/**
 * 只读权限验证中间件（所有角色）
 */
function requireViewer(req, res, next) {
  return requireRole(['viewer', 'editor', 'admin'])(req, res, next);
}

module.exports = {
  requirePermission,
  requireRole,
  requireAdmin,
  requireEditor,
  requireViewer
};