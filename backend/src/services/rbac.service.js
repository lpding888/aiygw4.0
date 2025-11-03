const logger = require('../utils/logger');

/**
 * RBAC权限服务
 * 实现基于角色的访问控制：viewer/editor/admin
 */
class RbacService {
  constructor() {
    // 用户角色定义
    this.ROLES = {
      VIEWER: 'viewer',    // 只读权限
      EDITOR: 'editor',    // 编辑权限
      ADMIN: 'admin'       // 管理员权限
    };

    // 资源定义
    this.RESOURCES = {
      FEATURES: 'features',
      PROVIDERS: 'providers',
      MCP_ENDPOINTS: 'mcp_endpoints',
      PROMPT_TEMPLATES: 'prompt_templates',
      PIPELINES: 'pipelines',
      PIPELINE_SCHEMAS: 'pipeline_schemas',
      USERS: 'users',
      SYSTEM: 'system'
    };

    // 操作定义
    this.ACTIONS = {
      READ: 'read',
      CREATE: 'create',
      UPDATE: 'update',
      DELETE: 'delete',
      PUBLISH: 'publish',
      ROLLBACK: 'rollback',
      TEST: 'test',
      VALIDATE: 'validate',
      MANAGE: 'manage'
    };

    // 权限矩阵
    this.PERMISSION_MATRIX = {
      [this.ROLES.VIEWER]: {
        [this.RESOURCES.FEATURES]: [this.ACTIONS.READ],
        [this.RESOURCES.PROVIDERS]: [this.ACTIONS.READ],
        [this.RESOURCES.MCP_ENDPOINTS]: [this.ACTIONS.READ],
        [this.RESOURCES.PROMPT_TEMPLATES]: [this.ACTIONS.READ],
        [this.RESOURCES.PIPELINES]: [this.ACTIONS.READ],
        [this.RESOURCES.PIPELINE_SCHEMAS]: [this.ACTIONS.READ],
        [this.RESOURCES.USERS]: [this.ACTIONS.READ],
        [this.RESOURCES.SYSTEM]: [this.ACTIONS.READ]
      },
      [this.ROLES.EDITOR]: {
        [this.RESOURCES.FEATURES]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE],
        [this.RESOURCES.PROVIDERS]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE, this.ACTIONS.TEST],
        [this.RESOURCES.MCP_ENDPOINTS]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE, this.ACTIONS.TEST],
        [this.RESOURCES.PROMPT_TEMPLATES]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE, this.ACTIONS.TEST],
        [this.RESOURCES.PIPELINES]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE, this.ACTIONS.TEST],
        [this.RESOURCES.PIPELINE_SCHEMAS]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE, this.ACTIONS.VALIDATE],
        [this.RESOURCES.USERS]: [this.ACTIONS.READ],
        [this.RESOURCES.SYSTEM]: [this.ACTIONS.READ]
      },
      [this.ROLES.ADMIN]: {
        [this.RESOURCES.FEATURES]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE,
                                   this.ACTIONS.DELETE, this.ACTIONS.PUBLISH, this.ACTIONS.ROLLBACK],
        [this.RESOURCES.PROVIDERS]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE,
                                     this.ACTIONS.DELETE, this.ACTIONS.TEST],
        [this.RESOURCES.MCP_ENDPOINTS]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE,
                                       this.ACTIONS.DELETE, this.ACTIONS.TEST],
        [this.RESOURCES.PROMPT_TEMPLATES]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE,
                                           this.ACTIONS.DELETE, this.ACTIONS.PUBLISH, this.ACTIONS.TEST],
        [this.RESOURCES.PIPELINES]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE,
                                    this.ACTIONS.DELETE, this.ACTIONS.TEST],
        [this.RESOURCES.PIPELINE_SCHEMAS]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE,
                                           this.ACTIONS.DELETE, this.ACTIONS.VALIDATE],
        [this.RESOURCES.USERS]: [this.ACTIONS.READ, this.ACTIONS.CREATE, this.ACTIONS.UPDATE,
                                this.ACTIONS.DELETE, this.ACTIONS.MANAGE],
        [this.RESOURCES.SYSTEM]: [this.ACTIONS.READ, this.ACTIONS.MANAGE]
      }
    };
  }

  /**
   * 检查用户是否有指定权限
   * @param {string} userRole - 用户角色
   * @param {string} resource - 资源
   * @param {string} action - 操作
   * @returns {boolean}
   */
  hasPermission(userRole, resource, action) {
    const rolePermissions = this.PERMISSION_MATRIX[userRole];
    if (!rolePermissions) {
      logger.warn(`[RBAC] Unknown role: ${userRole}`);
      return false;
    }

    const resourcePermissions = rolePermissions[resource];
    if (!resourcePermissions) {
      logger.warn(`[RBAC] No permissions defined for resource: ${resource}`);
      return false;
    }

    return resourcePermissions.includes(action);
  }

  /**
   * 检查路由权限
   * @param {string} userRole - 用户角色
   * @param {string} method - HTTP方法
   * @param {string} path - 路由路径
   * @returns {boolean}
   */
  checkRoutePermission(userRole, method, path) {
    // HTTP方法到操作的映射
    const methodToAction = {
      'GET': this.ACTIONS.READ,
      'POST': this.ACTIONS.CREATE,
      'PUT': this.ACTIONS.UPDATE,
      'PATCH': this.ACTIONS.UPDATE,
      'DELETE': this.ACTIONS.DELETE
    };

    const action = methodToAction[method];
    if (!action) {
      return false;
    }

    // 从路径提取资源类型
    const resource = this.extractResourceFromPath(path);
    if (!resource) {
      return true; // 未知路径默认允许
    }

    // 检查特殊操作权限
    if (path.includes('/publish')) {
      return this.hasPermission(userRole, resource, this.ACTIONS.PUBLISH);
    }
    if (path.includes('/rollback')) {
      return this.hasPermission(userRole, resource, this.ACTIONS.ROLLBACK);
    }
    if (path.includes('/test')) {
      return this.hasPermission(userRole, resource, this.ACTIONS.TEST);
    }

    return this.hasPermission(userRole, resource, action);
  }

  /**
   * 从路径提取资源类型
   * @param {string} path - 路由路径
   * @returns {string|null}
   */
  extractResourceFromPath(path) {
    if (path.includes('/features')) {
      return this.RESOURCES.FEATURES;
    }
    if (path.includes('/providers')) {
      return this.RESOURCES.PROVIDERS;
    }
    if (path.includes('/mcp')) {
      return this.RESOURCES.MCP_ENDPOINTS;
    }
    if (path.includes('/prompts')) {
      return this.RESOURCES.PROMPT_TEMPLATES;
    }
    if (path.includes('/pipelines')) {
      return this.RESOURCES.PIPELINES;
    }
    if (path.includes('/pipeline-schemas') || path.includes('/pipeline_schemas')) {
      return this.RESOURCES.PIPELINE_SCHEMAS;
    }
    if (path.includes('/users')) {
      return this.RESOURCES.USERS;
    }
    if (path.includes('/system')) {
      return this.RESOURCES.SYSTEM;
    }
    return null;
  }

  /**
   * 获取用户的所有权限
   * @param {string} userRole - 用户角色
   * @returns {Object}
   */
  getUserPermissions(userRole) {
    return this.PERMISSION_MATRIX[userRole] || {};
  }

  /**
   * 获取角色优先级
   * @param {string} role - 角色
   * @returns {number}
   */
  getRolePriority(role) {
    const priorities = {
      [this.ROLES.VIEWER]: 1,
      [this.ROLES.EDITOR]: 2,
      [this.ROLES.ADMIN]: 3
    };
    return priorities[role] || 0;
  }

  /**
   * 检查角色是否有效
   * @param {string} role - 角色
   * @returns {boolean}
   */
  isValidRole(role) {
    return Object.values(this.ROLES).includes(role);
  }

  /**
   * 检查资源是否有效
   * @param {string} resource - 资源
   * @returns {boolean}
   */
  isValidResource(resource) {
    return Object.values(this.RESOURCES).includes(resource);
  }

  /**
   * 检查操作是否有效
   * @param {string} action - 操作
   * @returns {boolean}
   */
  isValidAction(action) {
    return Object.values(this.ACTIONS).includes(action);
  }

  /**
   * 获取用户角色（基于用户信息）
   * @param {Object} user - 用户对象
   * @returns {string}
   */
  getUserRole(user) {
    if (!user) {
      return this.ROLES.VIEWER;
    }

    // 管理员检查
    if (user.is_admin || user.role === 'admin') {
      return this.ROLES.ADMIN;
    }

    // 编辑者检查（基于会员等级或其他条件）
    if (user.membership_level === 'premium' || user.membership_level === 'pro') {
      return this.ROLES.EDITOR;
    }

    // 默认为只读用户
    return this.ROLES.VIEWER;
  }

  /**
   * 记录权限访问日志
   * @param {Object} logData - 日志数据
   */
  logPermissionAccess(logData) {
    const { userId, userRole, resource, action, path, method, ip, userAgent, allowed } = logData;

    logger.info(`[RBAC] ${allowed ? 'ALLOWED' : 'DENIED'} - User: ${userId}(${userRole}) - ` +
                `${method} ${path} - ${resource}:${action} - IP: ${ip}`);

    // 这里可以保存到数据库审计表
    // this.saveAuditLog(logData);
  }

  /**
   * 获取角色的权限摘要
   * @param {string} role - 角色
   * @returns {Object}
   */
  getRolePermissionsSummary(role) {
    const permissions = this.getUserPermissions(role);
    const summary = {};

    for (const [resource, actions] of Object.entries(permissions)) {
      summary[resource] = {
        actions,
        canRead: actions.includes(this.ACTIONS.READ),
        canCreate: actions.includes(this.ACTIONS.CREATE),
        canUpdate: actions.includes(this.ACTIONS.UPDATE),
        canDelete: actions.includes(this.ACTIONS.DELETE),
        canPublish: actions.includes(this.ACTIONS.PUBLISH),
        canTest: actions.includes(this.ACTIONS.TEST)
      };
    }

    return summary;
  }
}

// 单例实例
const rbacService = new RbacService();

module.exports = rbacService;