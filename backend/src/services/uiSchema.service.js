const cmsFeatureService = require('./cmsFeature.service');
const cmsCacheService = require('./cmsCache.service');
const rbacService = require('./rbac.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * UI Schema服务
 * 后端驱动前端，提供动态菜单、表单模板、页面配置等
 */
class UiSchemaService {
  constructor() {
    this.UI_CACHE_SCOPE = 'ui';
  }

  /**
   * 获取用户菜单配置
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>}
   */
  async getMenus(userRole = 'viewer') {
    try {
      const cacheKey = `menus:${userRole}`;

      return await cmsCacheService.getOrSet(this.UI_CACHE_SCOPE, cacheKey, async () => {
        // 获取已发布的启用功能
        const result = await cmsFeatureService.getFeatures({
          status: 'published',
          enabled: true
        });

        // 根据用户角色过滤功能
        const filteredFeatures = result.features.filter(feature => {
          return this.hasMenuAccess(userRole, feature);
        });

        // 构建菜单树
        const menus = this.buildMenuTree(filteredFeatures, userRole);

        return {
          menus,
          userRole,
          generatedAt: new Date().toISOString()
        };
      }, { ttl: 300 }); // 5分钟缓存

    } catch (error) {
      logger.error('[UiSchemaService] Get menus failed:', error);
      throw new AppError('获取菜单配置失败', 500, 'GET_MENUS_FAILED');
    }
  }

  /**
   * 获取UI Schema配置
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>}
   */
  async getUiSchema(userRole = 'viewer') {
    try {
      const cacheKey = `schema:${userRole}`;

      return await cmsCacheService.getOrSet(this.UI_CACHE_SCOPE, cacheKey, async () => {
        const result = await cmsFeatureService.getFeatures({
          status: 'published',
          enabled: true
        });

        const filteredFeatures = result.features.filter(feature => {
          return this.hasMenuAccess(userRole, feature);
        });

        // 构建完整的UI Schema
        const schema = {
          // 页面配置
          pages: this.buildPagesSchema(filteredFeatures, userRole),

          // 表单配置
          forms: this.buildFormsSchema(filteredFeatures, userRole),

          // 表格配置
          tables: this.buildTablesSchema(filteredFeatures, userRole),

          // 组件配置
          components: this.buildComponentsSchema(filteredFeatures, userRole),

          // 权限配置
          permissions: this.buildPermissionsSchema(userRole),

          // 路由配置
          routes: this.buildRoutesSchema(filteredFeatures, userRole),

          userRole,
          generatedAt: new Date().toISOString()
        };

        return schema;
      }, { ttl: 300 });

    } catch (error) {
      logger.error('[UiSchemaService] Get UI schema failed:', error);
      throw new AppError('获取UI配置失败', 500, 'GET_UI_SCHEMA_FAILED');
    }
  }

  /**
   * 获取特定功能的UI配置
   * @param {string} featureKey - 功能键
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>}
   */
  async getFeatureUiConfig(featureKey, userRole = 'viewer') {
    try {
      const feature = await cmsFeatureService.getFeatureByKey(featureKey);

      if (!this.hasMenuAccess(userRole, feature)) {
        throw new AppError('无权访问该功能', 403, 'ACCESS_DENIED');
      }

      const menuConfig = JSON.parse(feature.menu || '{}');
      const config = JSON.parse(feature.config || '{}');

      return {
        featureKey,
        name: feature.name,
        description: feature.description,
        category: feature.category,
        menu: menuConfig,
        config,
        permissions: this.getFeaturePermissions(userRole, feature),
        userRole
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('[UiSchemaService] Get feature UI config failed:', error);
      throw new AppError('获取功能UI配置失败', 500, 'GET_FEATURE_UI_CONFIG_FAILED');
    }
  }

  /**
   * 构建菜单树
   * @param {Array} features - 功能列表
   * @param {string} userRole - 用户角色
   * @returns {Array}
   */
  buildMenuTree(features, userRole) {
    // 按分类分组
    const categories = {};

    features.forEach(feature => {
      const menuConfig = JSON.parse(feature.menu || '{}');
      const category = menuConfig.category || feature.category || 'default';

      if (!categories[category]) {
        categories[category] = {
          key: category,
          title: this.getCategoryTitle(category),
          icon: this.getCategoryIcon(category),
          children: []
        };
      }

      const menuItem = {
        key: feature.key,
        title: feature.name,
        description: feature.description,
        icon: menuConfig.icon || 'default',
        path: menuConfig.path || `/${feature.key}`,
        component: menuConfig.component || `${feature.key}Page`,
        permissions: this.getFeaturePermissions(userRole, feature),
        badge: menuConfig.badge,
        hidden: menuConfig.hidden || false,
        order: menuConfig.order || 0
      };

      categories[category].children.push(menuItem);
    });

    // 排序并返回菜单数组
    const menuArray = Object.values(categories);
    menuArray.forEach(category => {
      category.children.sort((a, b) => a.order - b.order);
    });
    menuArray.sort((a, b) => (a.order || 0) - (b.order || 0));

    return menuArray;
  }

  /**
   * 构建页面配置
   * @param {Array} features - 功能列表
   * @param {string} userRole - 用户角色
   * @returns {Object}
   */
  buildPagesSchema(features, userRole) {
    const pages = {};

    features.forEach(feature => {
      const menuConfig = JSON.parse(feature.menu || '{}');
      const config = JSON.parse(feature.config || '{}');

      pages[feature.key] = {
        title: feature.name,
        description: feature.description,
        layout: menuConfig.layout || 'default',
        components: config.components || [],
        permissions: this.getFeaturePermissions(userRole, feature),
        settings: {
          showBreadcrumb: true,
          showHeader: true,
          showSidebar: true,
          ...menuConfig.pageSettings
        }
      };
    });

    return pages;
  }

  /**
   * 构建表单配置
   * @param {Array} features - 功能列表
   * @param {string} userRole - 用户角色
   * @returns {Object}
   */
  buildFormsSchema(features, userRole) {
    const forms = {};

    features.forEach(feature => {
      const config = JSON.parse(feature.config || '{}');

      if (config.forms) {
        forms[feature.key] = {
          create: config.forms.create || this.getDefaultCreateForm(feature),
          edit: config.forms.edit || this.getDefaultEditForm(feature),
          search: config.forms.search || this.getDefaultSearchForm(feature),
          permissions: this.getFeaturePermissions(userRole, feature)
        };
      }
    });

    return forms;
  }

  /**
   * 构建表格配置
   * @param {Array} features - 功能列表
   * @param {string} userRole - 用户角色
   * @returns {Object}
   */
  buildTablesSchema(features, userRole) {
    const tables = {};

    features.forEach(feature => {
      const config = JSON.parse(feature.config || '{}');

      if (config.table) {
        tables[feature.key] = {
          columns: config.table.columns || this.getDefaultTableColumns(feature),
          actions: config.table.actions || this.getDefaultTableActions(userRole, feature),
          permissions: this.getFeaturePermissions(userRole, feature),
          settings: {
            pagination: true,
            sortable: true,
            filterable: true,
            ...config.table.settings
          }
        };
      }
    });

    return tables;
  }

  /**
   * 构建组件配置
   * @param {Array} features - 功能列表
   * @param {string} userRole - 用户角色
   * @returns {Object}
   */
  buildComponentsSchema(features, userRole) {
    const components = {
      common: {
        // 通用组件配置
        layout: {
          header: { show: true, fixed: true },
          sidebar: { show: true, collapsible: true },
          breadcrumb: { show: true },
          footer: { show: false }
        },
        table: {
          size: 'middle',
          bordered: false,
          striped: true
        },
        form: {
          layout: 'vertical',
          colon: false
        }
      }
    };

    features.forEach(feature => {
      const config = JSON.parse(feature.config || '{}');

      if (config.components) {
        components[feature.key] = {
          ...config.components,
          permissions: this.getFeaturePermissions(userRole, feature)
        };
      }
    });

    return components;
  }

  /**
   * 构建权限配置
   * @param {string} userRole - 用户角色
   * @returns {Object}
   */
  buildPermissionsSchema(userRole) {
    const userPermissions = rbacService.getUserPermissions(userRole);

    return {
      role: userRole,
      permissions: userPermissions,
      rolePriority: rbacService.getRolePriority(userRole),
      can: {
        read: (resource) => rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.READ),
        create: (resource) => rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.CREATE),
        update: (resource) => rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.UPDATE),
        delete: (resource) => rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.DELETE),
        publish: (resource) => rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.PUBLISH),
        rollback: (resource) => rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.ROLLBACK),
        test: (resource) => rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.TEST)
      }
    };
  }

  /**
   * 构建路由配置
   * @param {Array} features - 功能列表
   * @param {string} userRole - 用户角色
   * @returns {Object}
   */
  buildRoutesSchema(features, userRole) {
    const routes = {};

    features.forEach(feature => {
      const menuConfig = JSON.parse(feature.menu || '{}');

      if (this.hasMenuAccess(userRole, feature)) {
        routes[feature.key] = {
          path: menuConfig.path || `/${feature.key}`,
          component: menuConfig.component || `${feature.key}Page`,
          exact: true,
          permissions: this.getFeaturePermissions(userRole, feature),
          meta: {
            title: feature.name,
            description: feature.description,
            icon: menuConfig.icon,
            breadcrumb: menuConfig.breadcrumb
          }
        };
      }
    });

    return routes;
  }

  /**
   * 检查用户是否有菜单访问权限
   * @param {string} userRole - 用户角色
   * @param {Object} feature - 功能对象
   * @returns {boolean}
   */
  hasMenuAccess(userRole, feature) {
    const menuConfig = JSON.parse(feature.menu || '{}');
    const requiredRole = menuConfig.requiredRole || 'viewer';

    // 检查角色优先级
    const userPriority = rbacService.getRolePriority(userRole);
    const requiredPriority = rbacService.getRolePriority(requiredRole);

    return userPriority >= requiredPriority;
  }

  /**
   * 获取功能的权限配置
   * @param {string} userRole - 用户角色
   * @param {Object} feature - 功能对象
   * @returns {Array}
   */
  getFeaturePermissions(userRole, feature) {
    const menuConfig = JSON.parse(feature.menu || '{}');
    const resource = 'features'; // 所有功能都属于features资源

    const permissions = [];

    if (rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.READ)) {
      permissions.push('read');
    }
    if (rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.CREATE)) {
      permissions.push('create');
    }
    if (rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.UPDATE)) {
      permissions.push('update');
    }
    if (rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.DELETE)) {
      permissions.push('delete');
    }
    if (rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.PUBLISH)) {
      permissions.push('publish');
    }
    if (rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.ROLLBACK)) {
      permissions.push('rollback');
    }
    if (rbacService.hasPermission(userRole, resource, rbacService.ACTIONS.TEST)) {
      permissions.push('test');
    }

    return permissions;
  }

  /**
   * 获取分类标题
   * @param {string} category - 分类键
   * @returns {string}
   */
  getCategoryTitle(category) {
    const titles = {
      'content': '内容管理',
      'media': '媒体管理',
      'system': '系统管理',
      'user': '用户管理',
      'analytics': '数据分析',
      'settings': '设置管理',
      'default': '其他功能'
    };

    return titles[category] || category;
  }

  /**
   * 获取分类图标
   * @param {string} category - 分类键
   * @returns {string}
   */
  getCategoryIcon(category) {
    const icons = {
      'content': 'file-text',
      'media': 'picture',
      'system': 'setting',
      'user': 'user',
      'analytics': 'bar-chart',
      'settings': 'tool',
      'default': 'appstore'
    };

    return icons[category] || 'default';
  }

  /**
   * 获取默认创建表单
   * @param {Object} feature - 功能对象
   * @returns {Object}
   */
  getDefaultCreateForm(feature) {
    return {
      fields: [
        {
          name: 'name',
          label: '名称',
          type: 'input',
          required: true,
          rules: [{ required: true, message: '请输入名称' }]
        },
        {
          name: 'description',
          label: '描述',
          type: 'textarea',
          required: false
        }
      ],
      layout: 'vertical',
      submitText: '创建'
    };
  }

  /**
   * 获取默认编辑表单
   * @param {Object} feature - 功能对象
   * @returns {Object}
   */
  getDefaultEditForm(feature) {
    return this.getDefaultCreateForm(feature);
  }

  /**
   * 获取默认搜索表单
   * @param {Object} feature - 功能对象
   * @returns {Object}
   */
  getDefaultSearchForm(feature) {
    return {
      fields: [
        {
          name: 'search',
          label: '搜索',
          type: 'input',
          placeholder: '请输入关键词'
        }
      ],
      layout: 'inline'
    };
  }

  /**
   * 获取默认表格列
   * @param {Object} feature - 功能对象
   * @returns {Array}
   */
  getDefaultTableColumns(feature) {
    return [
      {
        key: 'name',
        title: '名称',
        dataIndex: 'name',
        sortable: true
      },
      {
        key: 'description',
        title: '描述',
        dataIndex: 'description'
      },
      {
        key: 'created_at',
        title: '创建时间',
        dataIndex: 'created_at',
        sortable: true,
        type: 'datetime'
      }
    ];
  }

  /**
   * 获取默认表格操作
   * @param {string} userRole - 用户角色
   * @param {Object} feature - 功能对象
   * @returns {Array}
   */
  getDefaultTableActions(userRole, feature) {
    const actions = [
      {
        key: 'view',
        label: '查看',
        type: 'button',
        icon: 'eye'
      }
    ];

    if (rbacService.hasPermission(userRole, 'features', 'update')) {
      actions.push({
        key: 'edit',
        label: '编辑',
        type: 'button',
        icon: 'edit'
      });
    }

    if (rbacService.hasPermission(userRole, 'features', 'delete')) {
      actions.push({
        key: 'delete',
        label: '删除',
        type: 'button',
        icon: 'delete',
        danger: true
      });
    }

    return actions;
  }

  /**
   * 失效UI缓存
   */
  async invalidateCache() {
    try {
      await cmsCacheService.invalidateScope(this.UI_CACHE_SCOPE);
      logger.info('[UiSchemaService] UI cache invalidated');
    } catch (error) {
      logger.error('[UiSchemaService] Invalidate cache failed:', error);
    }
  }
}

module.exports = new UiSchemaService();