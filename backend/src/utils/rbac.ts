import logger from './logger.js';

/**
 * RBAC权限控制系统
 *
 * 权限分级：
 * - viewer: 只读权限，可以查看配置但不能修改
 * - editor: 编辑权限，可以创建和修改配置但不能发布/回滚
 * - admin: 管理员权限，完全控制包括发布/回滚
 */

export type UserRole = 'viewer' | 'editor' | 'admin';

export type Resource = string;
export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'rollback'
  | 'test'
  | 'manage'
  | 'execute'
  | 'rate';

export interface Permission {
  role: UserRole;
  resource: Resource;
  actions: Action[];
}

/**
 * 权限定义矩阵
 */
// 先定义viewer权限
const VIEWER_PERMISSIONS: Record<Resource, Action[]> = {
  // 功能管理 - 只读
  features: ['read'],
  'features:list': ['read'],
  'features:view': ['read'],

  // Provider管理 - 只读
  providers: ['read'],
  'providers:list': ['read'],
  'providers:view': ['read'],

  // MCP管理 - 只读
  mcp: ['read'],
  'mcp:list': ['read'],
  'mcp:view': ['read'],

  // 流程管理 - 只读
  pipelines: ['read'],
  'pipelines:list': ['read'],
  'pipelines:view': ['read'],

  // Prompt管理 - 只读
  prompts: ['read'],
  'prompts:list': ['read'],
  'prompts:view': ['read'],

  // UI配置 - 只读
  ui: ['read'],
  'ui:menus': ['read'],
  'ui:schema': ['read'],

  // 系统状态 - 只读
  system: ['read'],
  'system:health': ['read'],
  'system:metrics': ['read']
};

export const PERMISSION_MATRIX: Record<UserRole, Record<Resource, Action[]>> = {
  viewer: VIEWER_PERMISSIONS,

  editor: {
    // 继承viewer所有权限
    ...VIEWER_PERMISSIONS,

    // 功能管理 - 编辑权限
    features: ['read', 'create', 'update'],
    'features:list': ['read'],
    'features:view': ['read', 'update'],
    'features:create': ['create'],
    'features:update': ['update'],

    // Provider管理 - 编辑权限
    providers: ['read', 'create', 'update'],
    'providers:list': ['read'],
    'providers:view': ['read', 'update'],
    'providers:create': ['create'],
    'providers:update': ['update'],
    'providers:test': ['test'], // 可以测试连接

    // MCP管理 - 编辑权限
    mcp: ['read', 'create', 'update'],
    'mcp:list': ['read'],
    'mcp:view': ['read', 'update'],
    'mcp:create': ['create'],
    'mcp:update': ['update'],
    'mcp:test': ['test'], // 可以测试连接

    // 流程管理 - 编辑权限
    pipelines: ['read', 'create', 'update'],
    'pipelines:list': ['read'],
    'pipelines:view': ['read', 'update'],
    'pipelines:create': ['create'],
    'pipelines:update': ['update'],
    'pipelines:test': ['test'], // 可以试跑

    // Prompt管理 - 编辑权限
    prompts: ['read', 'create', 'update'],
    'prompts:list': ['read'],
    'prompts:view': ['read', 'update'],
    'prompts:create': ['create'],
    'prompts:update': ['update'],
    'prompts:preview': ['test'] // 可以预览
  },

  admin: {
    // 完全控制权限
    features: ['read', 'create', 'update', 'delete', 'publish', 'rollback'],
    'features:list': ['read'],
    'features:view': ['read', 'update', 'delete'],
    'features:create': ['create'],
    'features:update': ['update'],
    'features:delete': ['delete'],
    'features:publish': ['publish'],
    'features:rollback': ['rollback'],

    providers: ['read', 'create', 'update', 'delete', 'test'],
    'providers:list': ['read'],
    'providers:view': ['read', 'update', 'delete'],
    'providers:create': ['create'],
    'providers:update': ['update'],
    'providers:delete': ['delete'],
    'providers:test': ['test'],

    mcp: ['read', 'create', 'update', 'delete', 'test'],
    'mcp:list': ['read'],
    'mcp:view': ['read', 'update', 'delete'],
    'mcp:create': ['create'],
    'mcp:update': ['update'],
    'mcp:delete': ['delete'],
    'mcp:test': ['test'],

    pipelines: ['read', 'create', 'update', 'delete', 'test'],
    'pipelines:list': ['read'],
    'pipelines:view': ['read', 'update', 'delete'],
    'pipelines:create': ['create'],
    'pipelines:update': ['update'],
    'pipelines:delete': ['delete'],
    'pipelines:test': ['test'],

    prompts: ['read', 'create', 'update', 'delete', 'test'],
    'prompts:list': ['read'],
    'prompts:view': ['read', 'update', 'delete'],
    'prompts:create': ['create'],
    'prompts:update': ['update'],
    'prompts:delete': ['delete'],
    'prompts:preview': ['test'],

    ui: ['read', 'create', 'update'],
    'ui:menus': ['read', 'update'],
    'ui:schema': ['read', 'update'],

    system: ['read', 'update'],
    'system:health': ['read'],
    'system:metrics': ['read'],
    'system:config': ['read', 'update'],

    // 用户和权限管理
    users: ['read', 'update'],
    'users:list': ['read'],
    'users:view': ['read', 'update'],
    permissions: ['read', 'update'],
    audit: ['read']
  }
};

/**
 * 检查用户是否有指定权限
 */
export function hasPermission(userRole: UserRole, resource: Resource, action: Action): boolean {
  const rolePermissions = PERMISSION_MATRIX[userRole];
  if (!rolePermissions) {
    return false;
  }

  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) {
    return false;
  }

  return resourcePermissions.includes(action);
}

/**
 * 检查用户是否有任一权限
 */
export function hasAnyPermission(
  userRole: UserRole,
  permissions: Array<{ resource: Resource; action: Action }>
): boolean {
  return permissions.some(({ resource, action }) => hasPermission(userRole, resource, action));
}

/**
 * 检查用户是否有所有权限
 */
export function hasAllPermissions(
  userRole: UserRole,
  permissions: Array<{ resource: Resource; action: Action }>
): boolean {
  return permissions.every(({ resource, action }) => hasPermission(userRole, resource, action));
}

/**
 * 获取用户角色对所有资源的权限
 */
export function getRolePermissions(userRole: UserRole): Record<Resource, Action[]> {
  return PERMISSION_MATRIX[userRole] || {};
}

/**
 * 获取用户对指定资源的权限
 */
export function getResourcePermissions(userRole: UserRole, resource: Resource): Action[] {
  const rolePermissions = PERMISSION_MATRIX[userRole];
  return rolePermissions?.[resource] || [];
}

/**
 * 检查路由权限
 * 将HTTP方法映射到权限动作
 */
export function checkRoutePermission(userRole: UserRole, method: string, route: string): boolean {
  // 根据HTTP方法确定动作
  let action: Action;
  switch (method.toLowerCase()) {
    case 'get':
      action = 'read';
      break;
    case 'post':
      action = 'create';
      break;
    case 'put':
    case 'patch':
      action = 'update';
      break;
    case 'delete':
      action = 'delete';
      break;
    default:
      return false;
  }

  // 根据路由确定资源
  let resource: Resource;

  if (route.startsWith('/admin/features')) {
    resource = 'features';
  } else if (route.startsWith('/admin/providers')) {
    resource = 'providers';
  } else if (route.startsWith('/admin/mcp')) {
    resource = 'mcp';
  } else if (route.startsWith('/admin/pipelines')) {
    resource = 'pipelines';
  } else if (route.startsWith('/admin/prompts')) {
    resource = 'prompts';
  } else if (route.startsWith('/ui')) {
    resource = 'ui';
  } else if (route.startsWith('/system')) {
    resource = 'system';
  } else {
    return false; // 未知路由，拒绝访问
  }

  // 特殊处理发布、回滚、测试等动作
  if (route.includes('/publish')) {
    action = 'publish';
  } else if (route.includes('/rollback')) {
    action = 'rollback';
  } else if (route.includes('/test')) {
    action = 'test';
  } else if (route.includes('/preview')) {
    action = 'test';
  }

  return hasPermission(userRole, resource, action);
}

/**
 * 权限装饰器元数据
 */
export interface PermissionMetadata {
  resource: Resource;
  actions: Action[];
}

/**
 * 权限审计日志
 */
export interface PermissionAuditLog {
  userId: string;
  userRole: UserRole;
  resource: Resource;
  action: Action;
  route: string;
  method: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  reason?: string;
}

/**
 * 记录权限审计日志
 */
export function logPermissionAccess(auditLog: PermissionAuditLog): void {
  if (auditLog.success) {
    logger.info('Permission access granted', {
      userId: auditLog.userId,
      role: auditLog.userRole,
      resource: auditLog.resource,
      action: auditLog.action,
      route: auditLog.route,
      ip: auditLog.ip,
      timestamp: auditLog.timestamp
    });
  } else {
    logger.warn('Permission access denied', {
      userId: auditLog.userId,
      role: auditLog.userRole,
      resource: auditLog.resource,
      action: auditLog.action,
      route: auditLog.route,
      ip: auditLog.ip,
      reason: auditLog.reason,
      timestamp: auditLog.timestamp
    });
  }
}
