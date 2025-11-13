import configCacheService from '../cache/config-cache.js';
import { db as knex } from '../db/index.js';
import logger from '../utils/logger.js';
import { hasPermission, getRolePermissions } from '../utils/rbac.js';

interface MenuConfig {
  id: string;
  key: string;
  title: string;
  icon?: string;
  path?: string;
  children?: MenuConfig[];
  permissions?: string[];
  visible?: boolean;
  order?: number;
  badge?: {
    count: number;
    color: string;
  };
}

interface PropertySchema {
  type: string;
  title: string;
  [key: string]: unknown;
}

interface FormSchema {
  type: string;
  title: string;
  properties: Record<string, PropertySchema>;
  required?: string[];
  uiSchema?: Record<string, unknown>;
}

interface FilterOption {
  text: string;
  value: string | number | boolean;
}

interface TableColumn {
  key: string;
  title: string;
  dataIndex: string;
  width?: number;
  fixed?: 'left' | 'right';
  sorter?: boolean;
  filters?: FilterOption[];
  render?: string; // 渲染函数名
}

interface TableAction {
  key: string;
  title: string;
  icon?: string;
  permission?: string;
  danger?: boolean;
}

interface TableSchema {
  columns: TableColumn[];
  actions?: TableAction[];
}

interface UISchema {
  menus: MenuConfig[];
  forms: Record<string, FormSchema>;
  tables: Record<string, TableSchema>;
  permissions: Record<string, string[]>;
  version: string;
  timestamp: number;
}

/**
 * UI Schema服务 - 后端驱动前端界面
 *
 * 提供动态菜单、表单模板、页面配置等UI元素
 * 支持按角色权限过滤，发布后实时生效
 */
class UISchemaService {
  private readonly CACHE_SCOPE = 'ui_schema';
  private readonly DEFAULT_VERSION = '1.0.0';

  /**
   * 获取用户菜单配置
   */
  async getMenus(userRole: string = 'viewer'): Promise<MenuConfig[]> {
    try {
      const cacheKey = `menus:${userRole}`;

      const menus = await configCacheService.getOrSet(
        {
          scope: this.CACHE_SCOPE,
          key: cacheKey,
          version: this.DEFAULT_VERSION
        },
        () => this.generateMenusFromDB(userRole)
      );

      return this.filterMenusByPermission(menus, userRole);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('获取菜单配置失败:', err);
      return this.getDefaultMenus(userRole);
    }
  }

  /**
   * 获取UI Schema配置
   */
  async getUISchema(userRole: string = 'viewer'): Promise<UISchema> {
    try {
      const cacheKey = `ui_schema:${userRole}`;

      const schema = await configCacheService.getOrSet(
        {
          scope: this.CACHE_SCOPE,
          key: cacheKey,
          version: this.DEFAULT_VERSION
        },
        () => this.generateUISchemaFromDB(userRole)
      );

      return this.filterSchemaByPermission(schema, userRole);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('获取UI Schema失败:', err);
      return this.getDefaultUISchema(userRole);
    }
  }

  /**
   * 获取表单Schema
   */
  async getFormSchema(formKey: string, userRole: string = 'viewer'): Promise<FormSchema | null> {
    try {
      const cacheKey = `form:${formKey}:${userRole}`;

      return await configCacheService.getOrSet(
        {
          scope: this.CACHE_SCOPE,
          key: cacheKey,
          version: this.DEFAULT_VERSION
        },
        () => this.generateFormSchemaFromDB(formKey, userRole)
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`获取表单Schema失败: ${formKey}`, err);
      return null;
    }
  }

  /**
   * 获取表格Schema
   */
  async getTableSchema(tableKey: string, userRole: string = 'viewer'): Promise<TableSchema | null> {
    try {
      const cacheKey = `table:${tableKey}:${userRole}`;

      return await configCacheService.getOrSet(
        {
          scope: this.CACHE_SCOPE,
          key: cacheKey,
          version: this.DEFAULT_VERSION
        },
        () => this.generateTableSchemaFromDB(tableKey, userRole)
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`获取表格Schema失败: ${tableKey}`, err);
      return null;
    }
  }

  /**
   * 获取单个功能的完整UI配置
   */
  async getFeatureUiConfig(
    featureKey: string,
    userRole: string = 'viewer'
  ): Promise<{
    form: FormSchema | null;
    table: TableSchema | null;
    permissions: string[];
  }> {
    const schema = await this.getUISchema(userRole);
    return {
      form: schema.forms?.[featureKey] ?? null,
      table: schema.tables?.[featureKey] ?? null,
      permissions: schema.permissions?.[featureKey] ?? []
    };
  }

  /**
   * 更新菜单配置
   */
  async updateMenus(menus: MenuConfig[], updatedBy: string): Promise<void> {
    try {
      const menusJson = JSON.stringify(menus);

      await knex('ui_configs')
        .insert({
          config_key: 'menus',
          config_value: menusJson,
          version: this.DEFAULT_VERSION,
          updated_by: updatedBy
        })
        .onConflict('config_key')
        .merge({
          config_value: menusJson,
          version: this.DEFAULT_VERSION,
          updated_by: updatedBy,
          updated_at: new Date()
        });

      // 失效缓存
      await this.invalidateCache('menus');

      logger.info('菜单配置已更新', { updatedBy });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('更新菜单配置失败:', err);
      throw err;
    }
  }

  /**
   * 更新表单Schema
   */
  async updateFormSchema(formKey: string, schema: FormSchema, updatedBy: string): Promise<void> {
    try {
      const schemaJson = JSON.stringify(schema);

      await knex('ui_configs')
        .insert({
          config_key: `form:${formKey}`,
          config_value: schemaJson,
          version: this.DEFAULT_VERSION,
          updated_by: updatedBy
        })
        .onConflict('config_key')
        .merge({
          config_value: schemaJson,
          version: this.DEFAULT_VERSION,
          updated_by: updatedBy,
          updated_at: new Date()
        });

      // 失效缓存
      await this.invalidateCache(`form:${formKey}`);

      logger.info(`表单Schema已更新: ${formKey}`, { updatedBy });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`更新表单Schema失败: ${formKey}`, err);
      throw err;
    }
  }

  async invalidateAllCaches(): Promise<void> {
    await configCacheService.invalidate(this.CACHE_SCOPE);
  }

  /**
   * 从数据库生成菜单配置
   */
  private async generateMenusFromDB(userRole: string): Promise<MenuConfig[]> {
    // 从features表生成功能菜单
    const features = await knex('features')
      .where('enabled', true)
      .where('status', 'published')
      .orderBy('menu_path', 'asc');

    const menuMap = new Map<string, MenuConfig>();

    features.forEach((feature) => {
      const menuPath = feature.menu_path || `/admin/${feature.key}`;
      const pathParts = menuPath.split('/').filter((p: string) => p);

      let currentPath = '';
      let parentMenu: MenuConfig | null = null;

      pathParts.forEach((part: string, index: number) => {
        currentPath += `/${part}`;

        if (!menuMap.has(currentPath)) {
          const isFeature = index === pathParts.length - 1;

          const menu: MenuConfig = {
            id: isFeature ? feature.id : `menu_${currentPath}`,
            key: isFeature ? feature.key : part,
            title: isFeature ? feature.name : this.formatMenuTitle(part),
            icon: isFeature ? feature.icon : this.getDefaultIcon(part),
            path: isFeature ? currentPath : undefined,
            children: isFeature ? undefined : [],
            permissions: isFeature ? [`${feature.key}:read`] : [`${part}:read`],
            visible: true,
            order: index
          };

          menuMap.set(currentPath, menu);

          if (parentMenu && parentMenu.children) {
            parentMenu.children.push(menu);
          }
        }

        parentMenu = menuMap.get(currentPath)!;
      });
    });

    return Array.from(menuMap.values()).filter((menu) => !menu.path);
  }

  /**
   * 从数据库生成完整UI Schema
   */
  private async generateUISchemaFromDB(userRole: string): Promise<UISchema> {
    const [menus, forms, tables] = await Promise.all([
      this.generateMenusFromDB(userRole),
      this.generateAllFormSchemas(userRole),
      this.generateAllTableSchemas(userRole)
    ]);

    return {
      menus,
      forms,
      tables,
      permissions: this.getAllPermissions(userRole),
      version: this.DEFAULT_VERSION,
      timestamp: Date.now()
    };
  }

  /**
   * 从数据库生成表单Schema
   */
  private async generateFormSchemaFromDB(
    formKey: string,
    userRole: string
  ): Promise<FormSchema | null> {
    try {
      const config = await knex('ui_configs').where('config_key', `form:${formKey}`).first();

      if (config) {
        return JSON.parse(config.config_value);
      }

      // 如果没有配置，根据功能生成默认表单
      return this.generateDefaultFormSchema(formKey, userRole);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`生成表单Schema失败: ${formKey}`, err);
      return null;
    }
  }

  /**
   * 从数据库生成表格Schema
   */
  private async generateTableSchemaFromDB(
    tableKey: string,
    userRole: string
  ): Promise<TableSchema | null> {
    try {
      const config = await knex('ui_configs').where('config_key', `table:${tableKey}`).first();

      if (config) {
        return JSON.parse(config.config_value);
      }

      // 如果没有配置，生成默认表格配置
      return this.generateDefaultTableSchema(tableKey, userRole);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`生成表格Schema失败: ${tableKey}`, err);
      return null;
    }
  }

  /**
   * 生成所有表单Schema
   */
  private async generateAllFormSchemas(userRole: string): Promise<Record<string, FormSchema>> {
    const forms: Record<string, FormSchema> = {};

    // 为每个启用的功能生成表单Schema
    const features = await knex('features').where('enabled', true).where('status', 'published');

    for (const feature of features) {
      const formSchema = await this.generateDefaultFormSchema(feature.key, userRole);
      if (formSchema) {
        forms[feature.key] = formSchema;
      }
    }

    return forms;
  }

  /**
   * 生成所有表格Schema
   */
  private async generateAllTableSchemas(userRole: string): Promise<Record<string, TableSchema>> {
    const tables: Record<string, TableSchema> = {};

    // 生成各类管理表格Schema
    const tableTypes = ['features', 'providers', 'mcp', 'pipelines', 'prompts'];

    for (const type of tableTypes) {
      tables[type] = this.generateDefaultTableSchema(type, userRole);
    }

    return tables;
  }

  /**
   * 生成默认表单Schema
   */
  private generateDefaultFormSchema(featureKey: string, userRole: string): FormSchema | null {
    const schemaMap: Record<string, FormSchema> = {
      features: {
        type: 'object',
        title: '功能配置',
        properties: {
          name: { type: 'string', title: '功能名称' } as PropertySchema,
          description: { type: 'string', title: '描述' } as PropertySchema,
          category: {
            type: 'string',
            title: '分类',
            enum: ['image', 'video', 'text']
          } as PropertySchema,
          quota_cost: { type: 'number', title: '配额消耗' } as PropertySchema,
          enabled: { type: 'boolean', title: '启用' } as PropertySchema
        },
        required: ['name', 'category']
      },
      providers: {
        type: 'object',
        title: '供应商配置',
        properties: {
          name: { type: 'string', title: '供应商名称' } as PropertySchema,
          type: { type: 'string', title: '类型' } as PropertySchema,
          base_url: { type: 'string', title: '基础URL', format: 'uri' } as PropertySchema,
          timeout_ms: { type: 'number', title: '超时时间' } as PropertySchema,
          enabled: { type: 'boolean', title: '启用' } as PropertySchema
        },
        required: ['name', 'type', 'base_url']
      }
    };

    return schemaMap[featureKey] || null;
  }

  /**
   * 生成默认表格Schema
   */
  private generateDefaultTableSchema(tableKey: string, userRole: string): TableSchema {
    const schemaMap: Record<string, TableSchema> = {
      features: {
        columns: [
          { key: 'id', title: 'ID', dataIndex: 'id', width: 80 },
          { key: 'name', title: '功能名称', dataIndex: 'name', sorter: true },
          {
            key: 'category',
            title: '分类',
            dataIndex: 'category',
            filters: [
              { text: '图像处理', value: 'image' },
              { text: '视频处理', value: 'video' },
              { text: '文本处理', value: 'text' }
            ]
          },
          { key: 'quota_cost', title: '配额消耗', dataIndex: 'quota_cost', width: 100 },
          { key: 'enabled', title: '状态', dataIndex: 'enabled', width: 80, render: 'statusBadge' },
          { key: 'actions', title: '操作', dataIndex: 'actions', width: 200, fixed: 'right' }
        ],
        actions: [
          { key: 'edit', title: '编辑', icon: 'edit', permission: 'features:update' },
          {
            key: 'delete',
            title: '删除',
            icon: 'delete',
            permission: 'features:delete',
            danger: true
          }
        ]
      },
      providers: {
        columns: [
          { key: 'id', title: 'ID', dataIndex: 'id', width: 80 },
          { key: 'name', title: '供应商名称', dataIndex: 'name', sorter: true },
          { key: 'type', title: '类型', dataIndex: 'type' },
          { key: 'base_url', title: '基础URL', dataIndex: 'base_url' },
          {
            key: 'healthy',
            title: '健康状态',
            dataIndex: 'healthy',
            width: 100,
            render: 'healthBadge'
          },
          { key: 'actions', title: '操作', dataIndex: 'actions', width: 200, fixed: 'right' }
        ],
        actions: [
          { key: 'test', title: '测试', icon: 'api', permission: 'providers:test' },
          { key: 'edit', title: '编辑', icon: 'edit', permission: 'providers:update' }
        ]
      }
    };

    return (
      schemaMap[tableKey] || {
        columns: [
          { key: 'id', title: 'ID', dataIndex: 'id', width: 80 },
          { key: 'name', title: '名称', dataIndex: 'name', sorter: true },
          { key: 'actions', title: '操作', dataIndex: 'actions', width: 150, fixed: 'right' }
        ]
      }
    );
  }

  /**
   * 按权限过滤菜单
   */
  filterMenusByPermission(menus: MenuConfig[], userRole: string): MenuConfig[] {
    return menus
      .filter((menu) => this.hasMenuPermission(menu, userRole))
      .map((menu) => ({
        ...menu,
        children: menu.children ? this.filterMenusByPermission(menu.children, userRole) : undefined
      }))
      .filter(
        (menu) =>
          menu.children?.length || !menu.permissions || this.hasMenuPermission(menu, userRole)
      );
  }

  /**
   * 按权限过滤Schema
   */
  private filterSchemaByPermission(schema: UISchema, userRole: string): UISchema {
    return {
      ...schema,
      menus: this.filterMenusByPermission(schema.menus, userRole)
    };
  }

  /**
   * 检查菜单权限
   */
  private hasMenuPermission(menu: MenuConfig, userRole: string): boolean {
    if (!menu.permissions || menu.permissions.length === 0) {
      return true;
    }

    return menu.permissions.some((permission) => {
      const [resource, action] = permission.split(':');
      return hasPermission(userRole, resource, action);
    });
  }

  /**
   * 获取所有权限
   */
  private getAllPermissions(userRole: string): Record<string, string[]> {
    return getRolePermissions(userRole);
  }

  /**
   * 格式化菜单标题
   */
  private formatMenuTitle(part: string): string {
    return part.charAt(0).toUpperCase() + part.slice(1).replace(/[-_]/g, ' ');
  }

  /**
   * 获取默认图标
   */
  private getDefaultIcon(part: string): string {
    const iconMap: Record<string, string> = {
      admin: 'setting',
      features: 'appstore',
      providers: 'cloud',
      mcp: 'api',
      pipelines: 'share-alt',
      prompts: 'edit',
      system: 'monitor'
    };

    return iconMap[part] || 'folder';
  }

  /**
   * 获取默认菜单
   */
  private getDefaultMenus(userRole: string): MenuConfig[] {
    const baseMenus: MenuConfig[] = [
      {
        id: 'dashboard',
        key: 'dashboard',
        title: '仪表盘',
        icon: 'dashboard',
        path: '/admin/dashboard',
        permissions: ['system:read']
      }
    ];

    if (userRole === 'admin') {
      baseMenus.push({
        id: 'system',
        key: 'system',
        title: '系统管理',
        icon: 'setting',
        children: [
          {
            id: 'features',
            key: 'features',
            title: '功能管理',
            path: '/admin/features',
            permissions: ['features:read']
          },
          {
            id: 'providers',
            key: 'providers',
            title: '供应商管理',
            path: '/admin/providers',
            permissions: ['providers:read']
          }
        ]
      });
    }

    return baseMenus;
  }

  /**
   * 获取默认UI Schema
   */
  private getDefaultUISchema(userRole: string): UISchema {
    return {
      menus: this.getDefaultMenus(userRole),
      forms: {},
      tables: {},
      permissions: this.getAllPermissions(userRole),
      version: this.DEFAULT_VERSION,
      timestamp: Date.now()
    };
  }

  /**
   * 失效缓存
   */
  private async invalidateCache(key: string): Promise<void> {
    await configCacheService.invalidate(this.CACHE_SCOPE, key);
  }
}

const uiSchemaService = new UISchemaService();

// 导出类实例的所有public方法
export const getMenus = uiSchemaService.getMenus.bind(uiSchemaService);
export const getUISchema = uiSchemaService.getUISchema.bind(uiSchemaService);
export const getFormSchema = uiSchemaService.getFormSchema.bind(uiSchemaService);
export const getTableSchema = uiSchemaService.getTableSchema.bind(uiSchemaService);
export const getFeatureUiConfig = uiSchemaService.getFeatureUiConfig.bind(uiSchemaService);
export const updateMenus = uiSchemaService.updateMenus.bind(uiSchemaService);
export const updateFormSchema = uiSchemaService.updateFormSchema.bind(uiSchemaService);
export const filterMenusByPermission =
  uiSchemaService.filterMenusByPermission.bind(uiSchemaService);
export const invalidateAllCaches = uiSchemaService.invalidateAllCaches.bind(uiSchemaService);

export default uiSchemaService;
