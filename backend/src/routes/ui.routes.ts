const express = require('express');
const rateLimit = require('express-rate-limit');
const uiSchemaService = require('../services/ui-schema.service');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/require-permission.middleware');
const { body, query } = require('express-validator');
const validate = require('../middlewares/validate.middleware');
const logger = require('../utils/logger');

const router = express.Router();

// UI接口频率限制
const uiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 1000, // 最多1000次请求
  message: {
    success: false,
    error: {
      code: 4290,
      message: '请求过于频繁，请稍后再试'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 验证规则
const updateMenusValidation = [
  body('menus')
    .isArray()
    .withMessage('菜单配置必须为数组'),
  body('menus.*.key')
    .notEmpty()
    .withMessage('菜单key不能为空'),
  body('menus.*.title')
    .notEmpty()
    .withMessage('菜单标题不能为空')
];

const updateFormSchemaValidation = [
  body('schema')
    .isObject()
    .withMessage('表单Schema必须为对象'),
  body('schema.type')
    .notEmpty()
    .withMessage('Schema类型不能为空'),
  body('schema.title')
    .notEmpty()
    .withMessage('Schema标题不能为空')
];

/**
 * UI配置路由
 *
 * 提供动态菜单、表单模板、页面配置等UI元素的API
 * 支持按角色权限过滤，发布后实时生效
 */

// 应用所有中间件
router.use(authenticateToken);
router.use(uiRateLimit);

/**
 * 获取用户菜单配置
 * GET /ui/menus
 */
router.get('/menus',
  async (req, res, next) => {
    try {
      const userRole = req.user?.role || 'viewer';
      const menus = await uiSchemaService.getMenus(userRole);

      res.json({
        success: true,
        data: {
          menus,
          userRole,
          version: '1.0.0',
          timestamp: Date.now()
        },
        requestId: req.id
      });
    } catch (error) {
      logger.error('获取菜单配置失败:', error);
      next(error);
    }
  }
);

/**
 * 获取完整UI Schema
 * GET /ui/schema
 */
router.get('/schema',
  async (req, res, next) => {
    try {
      const userRole = req.user?.role || 'viewer';
      const schema = await uiSchemaService.getUISchema(userRole);

      res.json({
        success: true,
        data: schema,
        requestId: req.id
      });
    } catch (error) {
      logger.error('获取UI Schema失败:', error);
      next(error);
    }
  }
);

/**
 * 获取表单Schema
 * GET /ui/schema/form/:formKey
 */
router.get('/schema/form/:formKey',
  async (req, res, next) => {
    try {
      const { formKey } = req.params;
      const userRole = req.user?.role || 'viewer';

      const schema = await uiSchemaService.getFormSchema(formKey, userRole);

      if (!schema) {
        return res.status(404).json({
          success: false,
          error: {
            code: 4040,
            message: `表单Schema不存在: ${formKey}`
          },
          requestId: req.id
        });
      }

      res.json({
        success: true,
        data: {
          formKey,
          schema,
          userRole
        },
        requestId: req.id
      });
    } catch (error) {
      logger.error(`获取表单Schema失败: ${req.params.formKey}`, error);
      next(error);
    }
  }
);

/**
 * 获取表格Schema
 * GET /ui/schema/table/:tableKey
 */
router.get('/schema/table/:tableKey',
  async (req, res, next) => {
    try {
      const { tableKey } = req.params;
      const userRole = req.user?.role || 'viewer';

      const schema = await uiSchemaService.getTableSchema(tableKey, userRole);

      if (!schema) {
        return res.status(404).json({
          success: false,
          error: {
            code: 4040,
            message: `表格Schema不存在: ${tableKey}`
          },
          requestId: req.id
        });
      }

      res.json({
        success: true,
        data: {
          tableKey,
          schema,
          userRole
        },
        requestId: req.id
      });
    } catch (error) {
      logger.error(`获取表格Schema失败: ${req.params.tableKey}`, error);
      next(error);
    }
  }
);

/**
 * 批量获取Schema配置
 * POST /ui/schema/batch
 */
router.post('/schema/batch',
  body('forms')
    .optional()
    .isArray()
    .withMessage('forms必须为数组'),
  body('tables')
    .optional()
    .isArray()
    .withMessage('tables必须为数组'),
  validate,
  async (req, res, next) => {
    try {
      const { forms = [], tables = [] } = req.body;
      const userRole = req.user?.role || 'viewer';

      const [formSchemas, tableSchemas] = await Promise.all([
        Promise.all(
          forms.map(formKey =>
            uiSchemaService.getFormSchema(formKey, userRole)
              .then(schema => ({ formKey, schema }))
          )
        ),
        Promise.all(
          tables.map(tableKey =>
            uiSchemaService.getTableSchema(tableKey, userRole)
              .then(schema => ({ tableKey, schema }))
          )
        )
      ]);

      res.json({
        success: true,
        data: {
          forms: formSchemas.reduce((acc, { formKey, schema }) => {
            if (schema) acc[formKey] = schema;
            return acc;
          }, {}),
          tables: tableSchemas.reduce((acc, { tableKey, schema }) => {
            if (schema) acc[tableKey] = schema;
            return acc;
          }, {}),
          userRole
        },
        requestId: req.id
      });
    } catch (error) {
      logger.error('批量获取Schema失败:', error);
      next(error);
    }
  }
);

// ============ 管理员路由 ============

// 以下路由需要管理员权限
router.use(requirePermission({
  resource: 'ui',
  actions: ['update']
}));

/**
 * 更新菜单配置
 * PUT /ui/menus
 */
router.put('/menus',
  updateMenusValidation,
  validate,
  async (req, res, next) => {
    try {
      const { menus } = req.body;
      const updatedBy = req.user.id;

      await uiSchemaService.updateMenus(menus, updatedBy);

      // 发布后立即失效缓存，确保前端实时更新
      const configCacheService = require('../cache/config-cache');
      await configCacheService.invalidate('ui_schema', 'menus');

      logger.info('菜单配置已更新', {
        updatedBy,
        menuCount: menus.length,
        ip: req.ip
      });

      res.json({
        success: true,
        data: {
          message: '菜单配置更新成功',
          updatedCount: menus.length,
          version: '1.0.0'
        },
        requestId: req.id
      });
    } catch (error) {
      logger.error('更新菜单配置失败:', error);
      next(error);
    }
  }
);

/**
 * 更新表单Schema
 * PUT /ui/schema/form/:formKey
 */
router.put('/schema/form/:formKey',
  updateFormSchemaValidation,
  validate,
  async (req, res, next) => {
    try {
      const { formKey } = req.params;
      const { schema } = req.body;
      const updatedBy = req.user.id;

      await uiSchemaService.updateFormSchema(formKey, schema, updatedBy);

      // 失效相关缓存
      const configCacheService = require('../cache/config-cache');
      await configCacheService.invalidate('ui_schema', `form:${formKey}`);

      logger.info(`表单Schema已更新: ${formKey}`, {
        updatedBy,
        ip: req.ip
      });

      res.json({
        success: true,
        data: {
          message: '表单Schema更新成功',
          formKey,
          version: '1.0.0'
        },
        requestId: req.id
      });
    } catch (error) {
      logger.error(`更新表单Schema失败: ${req.params.formKey}`, error);
      next(error);
    }
  }
);

/**
 * 预览UI配置
 * POST /ui/preview
 */
router.post('/preview',
  body('menus')
    .optional()
    .isArray(),
  body('userRole')
    .optional()
    .isIn(['viewer', 'editor', 'admin'])
    .withMessage('无效的用户角色'),
  validate,
  async (req, res, next) => {
    try {
      const { menus, userRole = req.user?.role || 'viewer' } = req.body;

      let result;

      if (menus) {
        // 预览菜单配置
        result = {
          type: 'menus',
          data: uiSchemaService.filterMenusByPermission(menus, userRole),
          userRole
        };
      } else {
        // 预览完整UI Schema
        result = await uiSchemaService.getUISchema(userRole);
      }

      res.json({
        success: true,
        data: {
          preview: result,
          timestamp: Date.now()
        },
        requestId: req.id
      });
    } catch (error) {
      logger.error('预览UI配置失败:', error);
      next(error);
    }
  }
);

/**
 * 获取UI配置统计信息
 * GET /ui/stats
 */
router.get('/stats',
  requirePermission({
    resource: 'system',
    actions: ['read']
  }),
  async (req, res, next) => {
    try {
      const stats = {
        menus: {
          total: 0,
          enabled: 0,
          categories: []
        },
        forms: {
          total: 0,
          types: []
        },
        tables: {
          total: 0,
          types: []
        },
        cache: {
          // 获取缓存统计
          ...require('../cache/config-cache').getStats()
        }
      };

      res.json({
        success: true,
        data: stats,
        requestId: req.id
      });
    } catch (error) {
      logger.error('获取UI配置统计失败:', error);
      next(error);
    }
  }
);

module.exports = router;