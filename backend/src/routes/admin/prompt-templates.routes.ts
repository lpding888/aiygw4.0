const express = require('express');
const rateLimit = require('express-rate-limit');
const promptTemplateService = require('../../services/prompt-template.service');
const { authenticateToken, requireAdmin } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/require-permission.middleware');
const { body, param, query } = require('express-validator');
const validate = require('../../middlewares/validate.middleware');
const logger = require('../../utils/logger');

const router = express.Router();

// 频率限制
const promptRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 80, // 最多80次请求
  message: {
    success: false,
    error: {
      code: 4290,
      message: '请求过于频繁，请稍后再试'
    }
  }
});

// 验证规则
const createTemplateValidation = [
  body('name')
    .notEmpty()
    .withMessage('模板名称不能为空')
    .isLength({ max: 100 })
    .withMessage('模板名称最多100个字符'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('描述最多500个字符'),
  body('category')
    .optional()
    .isIn(['general', 'creative', 'technical', 'business', 'educational', 'marketing'])
    .withMessage('无效的分类'),
  body('template')
    .notEmpty()
    .withMessage('模板内容不能为空')
    .isLength({ max: 10000 })
    .withMessage('模板内容最多10000个字符'),
  body('variables')
    .optional()
    .isArray()
    .withMessage('变量列表必须是数组'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('标签列表必须是数组'),
  body('config.allowCustomVariables')
    .optional()
    .isBoolean()
    .withMessage('allowCustomVariables必须是布尔值'),
  body('config.requireAllVariables')
    .optional()
    .isBoolean()
    .withMessage('requireAllVariables必须是布尔值'),
  body('config.maxTokens')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('最大Token数必须是1-100000之间'),
  body('config.temperature')
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage('temperature必须是0-2之间的浮点数'),
  body('config.topP')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('topP必须是0-1之间的浮点数')
];

const updateTemplateValidation = [
  param('id')
    .notEmpty()
    .withMessage('模板ID不能为空'),
  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('模板名称最多100个字符'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('描述最多500个字符'),
  body('category')
    .optional()
    .isIn(['general', 'creative', 'technical', 'business', 'educational', 'marketing'])
    .withMessage('无效的分类'),
  body('template')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('模板内容最多10000个字符'),
  body('variables')
    .optional()
    .isArray()
    .withMessage('变量列表必须是数组'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('标签列表必须是数组'),
  body('config.allowCustomVariables')
    .optional()
    .isBoolean()
    .withMessage('allowCustomVariables必须是布尔值'),
  body('config.requireAllVariables')
    .optional()
    .isBoolean()
    .withMessage('requireAllVariables必须是布尔值'),
  body('config.maxTokens')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('最大Token数必须是1-100000之间'),
  body('config.temperature')
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage('temperature必须是0-2之间的浮点数'),
  body('config.topP')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('topP必须是0-1之间的浮点数')
];

const previewTemplateValidation = [
  param('id')
    .notEmpty()
    .withMessage('模板ID不能为空'),
  body('variables')
    .optional()
    .isObject()
    .withMessage('变量必须是对象')
];

const rateTemplateValidation = [
  param('id')
    .notEmpty()
    .withMessage('模板ID不能为空'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('评分必须是1-5之间的整数')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('页码必须是1-1000之间的整数'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('每页数量必须是1-100之间的整数'),
  query('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('无效的状态值'),
  query('category')
    .optional()
    .isIn(['general', 'creative', 'technical', 'business', 'educational', 'marketing'])
    .withMessage('无效的分类'),
  query('complexity')
    .optional()
    .isIn(['simple', 'medium', 'complex'])
    .withMessage('无效的复杂度'),
  query('sortBy')
    .optional()
    .isIn(['created_at', 'updated_at', 'used_count', 'avg_rating'])
    .withMessage('无效的排序字段'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('无效的排序方向'),
  query('tags')
    .optional()
    .custom(value => {
      if (typeof value === 'string') {
        return true; // 单个标签
      }
      if (Array.isArray(value)) {
        return value.every(tag => typeof tag === 'string');
      }
      throw new Error('标签必须是字符串或字符串数组');
    })
];

const searchValidation = [
  query('q')
    .notEmpty()
    .withMessage('搜索关键词不能为空')
    .isLength({ min: 1, max: 100 })
    .withMessage('搜索关键词长度必须在1-100之间'),
  query('category')
    .optional()
    .isIn(['general', 'creative', 'technical', 'business', 'educational', 'marketing'])
    .withMessage('无效的分类'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('返回数量必须是1-50之间')
];

/**
 * Prompt模板管理路由
 *
 * 管理提示词模板，支持预览、变量校验、版本控制和分类管理
 */

// 应用认证中间件
router.use(authenticateToken);
router.use(promptRateLimit);

// 应用权限中间件
router.use(requirePermission({
  resource: 'prompt_templates',
  actions: ['read']
}));

/**
 * 获取Prompt模板列表
 * GET /api/admin/prompt-templates
 */
router.get('/',
  queryValidation,
  validate,
  async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        category,
        complexity,
        sortBy,
        sortOrder,
        tags
      } = req.query;

      const filters: any = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      if (status) filters.status = status;
      if (category) filters.category = category;
      if (complexity) filters.complexity = complexity;
      if (sortBy) filters.sortBy = sortBy;
      if (sortOrder) filters.sortOrder = sortOrder;
      if (tags) {
        filters.tags = Array.isArray(tags) ? tags : [tags];
      }

      const result = await promptTemplateService.getTemplates(filters);

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error('获取Prompt模板列表失败:', error);
      next(error);
    }
  }
);

/**
 * 搜索Prompt模板
 * GET /api/admin/prompt-templates/search
 */
router.get('/search',
  searchValidation,
  validate,
  async (req, res, next) => {
    try {
      const { q: query, category, limit = 10, tags } = req.query;

      const filters: any = { limit: parseInt(limit) };
      if (category) filters.category = category;
      if (tags) {
        filters.tags = Array.isArray(tags) ? tags : [tags];
      }

      const templates = await promptTemplateService.searchTemplates(query, filters);

      res.json({
        success: true,
        data: { templates, total: templates.length },
        requestId: req.id
      });
    } catch (error) {
      logger.error('搜索Prompt模板失败:', error);
      next(error);
    }
  }
);

/**
 * 获取热门标签
 * GET /api/admin/prompt-templates/tags/popular
 */
router.get('/tags/popular',
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('数量限制必须是1-100之间'),
  validate,
  async (req, res, next) => {
    try {
      const { limit = 20 } = req.query;
      const tags = await promptTemplateService.getPopularTags(parseInt(limit));

      res.json({
        success: true,
        data: { tags },
        requestId: req.id
      });
    } catch (error) {
      logger.error('获取热门标签失败:', error);
      next(error);
    }
  }
);

/**
 * 获取Prompt模板详情
 * GET /api/admin/prompt-templates/:id
 */
router.get('/:id',
  param('id')
    .notEmpty()
    .withMessage('模板ID不能为空'),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const template = await promptTemplateService.getTemplate(id);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: {
            code: 4040,
            message: 'Prompt模板不存在'
          },
          requestId: req.id
        });
      }

      res.json({
        success: true,
        data: template,
        requestId: req.id
      });
    } catch (error) {
      logger.error(`获取Prompt模板详情失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 获取Prompt模板历史
 * GET /api/admin/prompt-templates/:id/history
 */
router.get('/:id/history',
  param('id')
    .notEmpty()
    .withMessage('模板ID不能为空'),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const history = await promptTemplateService.getTemplateHistory(id);

      res.json({
        success: true,
        data: { history },
        requestId: req.id
      });
    } catch (error) {
      logger.error(`获取Prompt模板历史失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 验证Prompt模板
 * POST /api/admin/prompt-templates/validate
 */
router.post('/validate',
  body('template')
    .notEmpty()
    .withMessage('模板内容不能为空'),
  body('variables')
    .optional()
    .isArray()
    .withMessage('变量列表必须是数组'),
  validate,
  async (req, res, next) => {
    try {
      const { template, variables = [] } = req.body;
      const validation = await promptTemplateService.validateTemplate(template, variables);

      res.json({
        success: true,
        data: validation,
        requestId: req.id
      });
    } catch (error) {
      logger.error('验证Prompt模板失败:', error);
      next(error);
    }
  }
);

/**
 * 获取Prompt模板统计信息
 * GET /api/admin/prompt-templates/stats
 */
router.get('/stats',
  async (req, res, next) => {
    try {
      const stats = await promptTemplateService.getStats();

      res.json({
        success: true,
        data: stats,
        requestId: req.id
      });
    } catch (error) {
      logger.error('获取Prompt模板统计失败:', error);
      next(error);
    }
  }
);

// ============ 需要编辑权限的路由 ============
router.use(requirePermission({
  resource: 'prompt_templates',
  actions: ['create', 'update', 'delete', 'publish', 'rate']
}));

/**
 * 创建Prompt模板
 * POST /api/admin/prompt-templates
 */
router.post('/',
  requirePermission({
    resource: 'prompt_templates',
    actions: ['create']
  }),
  createTemplateValidation,
  validate,
  async (req, res, next) => {
    try {
      const {
        name,
        description,
        category,
        template,
        variables,
        tags,
        config,
        metadata
      } = req.body;

      const promptTemplate = await promptTemplateService.createTemplate({
        name,
        description,
        category,
        template,
        variables,
        tags,
        config,
        metadata
      }, req.user.id);

      logger.info('Prompt模板已创建', {
        templateId: promptTemplate.id,
        name: promptTemplate.name,
        createdBy: req.user.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        data: promptTemplate,
        message: 'Prompt模板创建成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('创建Prompt模板失败:', error);
      next(error);
    }
  }
);

/**
 * 更新Prompt模板
 * PUT /api/admin/prompt-templates/:id
 */
router.put('/:id',
  requirePermission({
    resource: 'prompt_templates',
    actions: ['update']
  }),
  updateTemplateValidation,
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const template = await promptTemplateService.updateTemplate(id, updateData, req.user.id);

      logger.info('Prompt模板已更新', {
        templateId: id,
        updatedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: template,
        message: 'Prompt模板更新成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error(`更新Prompt模板失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 发布Prompt模板
 * POST /api/admin/prompt-templates/:id/publish
 */
router.post('/:id/publish',
  requirePermission({
    resource: 'prompt_templates',
    actions: ['publish']
  }),
  param('id')
    .notEmpty()
    .withMessage('模板ID不能为空'),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      await promptTemplateService.publishTemplate(id, req.user.id);

      logger.info('Prompt模板已发布', {
        templateId: id,
        publishedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Prompt模板发布成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error(`发布Prompt模板失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 回滚Prompt模板
 * POST /api/admin/prompt-templates/:id/rollback
 */
router.post('/:id/rollback',
  requirePermission({
    resource: 'prompt_templates',
    actions: ['publish']
  }),
  param('id')
    .notEmpty()
    .withMessage('模板ID不能为空'),
  body('targetVersion')
    .notEmpty()
    .withMessage('目标版本不能为空'),
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('回滚原因最多500个字符'),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { targetVersion, reason } = req.body;

      await promptTemplateService.rollbackTemplate(id, targetVersion, req.user.id, reason);

      logger.info('Prompt模板已回滚', {
        templateId: id,
        targetVersion,
        rolledBy: req.user.id,
        reason,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Prompt模板回滚成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error(`回滚Prompt模板失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 预览Prompt模板
 * POST /api/admin/prompt-templates/:id/preview
 */
router.post('/:id/preview',
  requirePermission({
    resource: 'prompt_templates',
    actions: ['read']
  }),
  previewTemplateValidation,
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { variables = {} } = req.body;

      const preview = await promptTemplateService.previewTemplate(id, variables);

      logger.info('Prompt模板预览完成', {
        templateId: id,
        userId: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: preview,
        requestId: req.id
      });
    } catch (error) {
      logger.error(`预览Prompt模板失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 评价Prompt模板
 * POST /api/admin/prompt-templates/:id/rate
 */
router.post('/:id/rate',
  requirePermission({
    resource: 'prompt_templates',
    actions: ['rate']
  }),
  rateTemplateValidation,
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { rating } = req.body;

      await promptTemplateService.rateTemplate(id, req.user.id, rating);

      logger.info('Prompt模板评价已提交', {
        templateId: id,
        userId: req.user.id,
        rating,
        ip: req.ip
      });

      res.json({
        success: true,
        message: '评价提交成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error(`评价Prompt模板失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

/**
 * 删除Prompt模板
 * DELETE /api/admin/prompt-templates/:id
 */
router.delete('/:id',
  requirePermission({
    resource: 'prompt_templates',
    actions: ['delete']
  }),
  param('id')
    .notEmpty()
    .withMessage('模板ID不能为空'),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      await promptTemplateService.deleteTemplate(id, req.user.id);

      logger.info('Prompt模板已删除', {
        templateId: id,
        deletedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Prompt模板删除成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error(`删除Prompt模板失败: ${req.params.id}`, error);
      next(error);
    }
  }
);

module.exports = router;