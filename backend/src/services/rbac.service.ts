import logger from '../utils/logger.js';

const ROLES = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
  ADMIN: 'admin'
} as const;

const RESOURCES = {
  FEATURES: 'features',
  PROVIDERS: 'providers',
  MCP_ENDPOINTS: 'mcp_endpoints',
  PROMPT_TEMPLATES: 'prompt_templates',
  PIPELINES: 'pipelines',
  PIPELINE_SCHEMAS: 'pipeline_schemas',
  USERS: 'users',
  SYSTEM: 'system'
} as const;

const ACTIONS = {
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  PUBLISH: 'publish',
  ROLLBACK: 'rollback',
  TEST: 'test',
  VALIDATE: 'validate',
  MANAGE: 'manage'
} as const;

type Role = (typeof ROLES)[keyof typeof ROLES];
type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];
type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

type PermissionMatrix = Partial<Record<Role, Partial<Record<Resource, Action[]>>>>;

export type PermissionSummary = Record<
  Resource,
  {
    actions: Action[];
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canPublish: boolean;
    canTest: boolean;
  }
>;

export type PermissionLog = {
  userId?: string;
  userRole: Role;
  resource: Resource | null;
  action: Action | null;
  path: string;
  method: string;
  ip?: string;
  userAgent?: string;
  allowed: boolean;
};

export type UserPayload = {
  id?: string;
  role?: string;
  is_admin?: boolean;
  membership_level?: string;
};

class RbacService {
  private readonly permissionMatrix: PermissionMatrix;

  constructor() {
    this.permissionMatrix = {
      [ROLES.VIEWER]: {
        [RESOURCES.FEATURES]: [ACTIONS.READ],
        [RESOURCES.PROVIDERS]: [ACTIONS.READ],
        [RESOURCES.MCP_ENDPOINTS]: [ACTIONS.READ],
        [RESOURCES.PROMPT_TEMPLATES]: [ACTIONS.READ],
        [RESOURCES.PIPELINES]: [ACTIONS.READ],
        [RESOURCES.PIPELINE_SCHEMAS]: [ACTIONS.READ],
        [RESOURCES.USERS]: [ACTIONS.READ],
        [RESOURCES.SYSTEM]: [ACTIONS.READ]
      },
      [ROLES.EDITOR]: {
        [RESOURCES.FEATURES]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE],
        [RESOURCES.PROVIDERS]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.TEST],
        [RESOURCES.MCP_ENDPOINTS]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.TEST],
        [RESOURCES.PROMPT_TEMPLATES]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.TEST],
        [RESOURCES.PIPELINES]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.TEST],
        [RESOURCES.PIPELINE_SCHEMAS]: [
          ACTIONS.READ,
          ACTIONS.CREATE,
          ACTIONS.UPDATE,
          ACTIONS.VALIDATE
        ],
        [RESOURCES.USERS]: [ACTIONS.READ],
        [RESOURCES.SYSTEM]: [ACTIONS.READ]
      },
      [ROLES.ADMIN]: {
        [RESOURCES.FEATURES]: [
          ACTIONS.READ,
          ACTIONS.CREATE,
          ACTIONS.UPDATE,
          ACTIONS.DELETE,
          ACTIONS.PUBLISH,
          ACTIONS.ROLLBACK
        ],
        [RESOURCES.PROVIDERS]: [
          ACTIONS.READ,
          ACTIONS.CREATE,
          ACTIONS.UPDATE,
          ACTIONS.DELETE,
          ACTIONS.TEST
        ],
        [RESOURCES.MCP_ENDPOINTS]: [
          ACTIONS.READ,
          ACTIONS.CREATE,
          ACTIONS.UPDATE,
          ACTIONS.DELETE,
          ACTIONS.TEST
        ],
        [RESOURCES.PROMPT_TEMPLATES]: [
          ACTIONS.READ,
          ACTIONS.CREATE,
          ACTIONS.UPDATE,
          ACTIONS.DELETE,
          ACTIONS.PUBLISH,
          ACTIONS.TEST
        ],
        [RESOURCES.PIPELINES]: [
          ACTIONS.READ,
          ACTIONS.CREATE,
          ACTIONS.UPDATE,
          ACTIONS.DELETE,
          ACTIONS.TEST
        ],
        [RESOURCES.PIPELINE_SCHEMAS]: [
          ACTIONS.READ,
          ACTIONS.CREATE,
          ACTIONS.UPDATE,
          ACTIONS.DELETE,
          ACTIONS.VALIDATE
        ],
        [RESOURCES.USERS]: [
          ACTIONS.READ,
          ACTIONS.CREATE,
          ACTIONS.UPDATE,
          ACTIONS.DELETE,
          ACTIONS.MANAGE
        ],
        [RESOURCES.SYSTEM]: [ACTIONS.READ, ACTIONS.MANAGE]
      }
    };
  }

  hasPermission(userRole: Role, resource: Resource | null, action: Action | null): boolean {
    if (!resource || !action) {
      return false;
    }

    const rolePermissions = this.permissionMatrix[userRole];
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

  checkRoutePermission(userRole: Role, method: string, path: string): boolean {
    const methodToAction: Record<string, Action | null> = {
      GET: ACTIONS.READ,
      POST: ACTIONS.CREATE,
      PUT: ACTIONS.UPDATE,
      PATCH: ACTIONS.UPDATE,
      DELETE: ACTIONS.DELETE
    };

    const action = methodToAction[method.toUpperCase()] ?? null;
    const resource = this.inferResourceFromPath(path);

    if (!resource || !action) {
      logger.warn('[RBAC] 无法解析路由资源或操作', { method, path });
      return false;
    }

    return this.hasPermission(userRole, resource, action);
  }

  inferResourceFromPath(path: string): Resource | null {
    if (path.includes('/features')) {
      return RESOURCES.FEATURES;
    }
    if (path.includes('/providers')) {
      return RESOURCES.PROVIDERS;
    }
    if (path.includes('/mcp-endpoints')) {
      return RESOURCES.MCP_ENDPOINTS;
    }
    if (path.includes('/prompt-templates')) {
      return RESOURCES.PROMPT_TEMPLATES;
    }
    if (path.includes('/pipelines')) {
      return RESOURCES.PIPELINES;
    }
    if (path.includes('/pipeline-schemas')) {
      return RESOURCES.PIPELINE_SCHEMAS;
    }
    if (path.includes('/users')) {
      return RESOURCES.USERS;
    }
    if (path.includes('/system')) {
      return RESOURCES.SYSTEM;
    }
    return null;
  }

  getUserPermissions(userRole: Role): Partial<Record<Resource, Action[]>> {
    return this.permissionMatrix[userRole] ?? {};
  }

  getRolePriority(role: Role): number {
    const priorities: Record<Role, number> = {
      [ROLES.VIEWER]: 1,
      [ROLES.EDITOR]: 2,
      [ROLES.ADMIN]: 3
    };
    return priorities[role] ?? 0;
  }

  isValidRole(role: string): role is Role {
    return Object.values(ROLES).includes(role as Role);
  }

  isValidResource(resource: string): resource is Resource {
    return Object.values(RESOURCES).includes(resource as Resource);
  }

  isValidAction(action: string): action is Action {
    return Object.values(ACTIONS).includes(action as Action);
  }

  getUserRole(user: UserPayload | null): Role {
    if (!user) {
      return ROLES.VIEWER;
    }

    if (user.is_admin || user.role === 'admin') {
      return ROLES.ADMIN;
    }

    if (user.membership_level === 'premium' || user.membership_level === 'pro') {
      return ROLES.EDITOR;
    }

    return ROLES.VIEWER;
  }

  logPermissionAccess(logData: PermissionLog): void {
    const { userId, userRole, resource, action, path, method, ip, allowed } = logData;
    logger.info(
      `[RBAC] ${allowed ? 'ALLOWED' : 'DENIED'} - User: ${userId ?? 'anonymous'}(${userRole}) - ` +
        `${method} ${path} - ${resource ?? 'unknown'}:${action ?? 'unknown'} - IP: ${ip ?? 'N/A'}`
    );
  }

  getRolePermissionsSummary(role: Role): PermissionSummary {
    const permissions = this.getUserPermissions(role);
    const summary = {} as PermissionSummary;

    (Object.entries(permissions) as Array<[Resource, Action[]]>).forEach(([resource, actions]) => {
      summary[resource] = {
        actions,
        canRead: actions.includes(ACTIONS.READ),
        canCreate: actions.includes(ACTIONS.CREATE),
        canUpdate: actions.includes(ACTIONS.UPDATE),
        canDelete: actions.includes(ACTIONS.DELETE),
        canPublish: actions.includes(ACTIONS.PUBLISH),
        canTest: actions.includes(ACTIONS.TEST)
      };
    });

    return summary;
  }
}

const rbacService = new RbacService();

export default rbacService;
