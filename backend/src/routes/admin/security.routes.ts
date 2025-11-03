const express = require('express');
const rateLimit = require('express-rate-limit');
const securityService = require('../../services/security.service');
const { authenticateToken, requireAdmin } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/require-permission.middleware');
const { body, param, query } = require('express-validator');
const validate = require('../../middlewares/validate.middleware');
const logger = require('../../utils/logger');

const router = express.Router();

// 频率限制
const securityRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 30, // 最多30次请求
  message: {
    success: false,
    error: {
      code: 4290,
      message: '请求过于频繁，请稍后再试'
    }
  }
});

// 验证规则
const rateLimitConfigValidation = [
  body('windowMs')
    .isInt({ min: 1000, max: 3600000 })
    .withMessage('时间窗口必须是1000-3600000毫秒之间'),
  body('maxRequests')
    .isInt({ min: 1, max: 10000 })
    .withMessage('最大请求数必须是1-10000之间'),
  body('key')
    .notEmpty()
    .withMessage('限流键不能为空')
    .isLength({ max: 100 })
    .withMessage('限流键最多100个字符')
];

const dataMaskingValidation = [
  body('data')
    .notEmpty()
    .withMessage('数据不能为空'),
  body('rules')
    .isArray({ min: 1 })
    .withMessage('脱敏规则不能为空'),
  body('rules.*.field')
    .notEmpty()
    .withMessage('字段名不能为空'),
  body('rules.*.type')
    .isIn(['email', 'phone', 'id_card', 'bank_card', 'password', 'token', 'custom'])
    .withMessage('无效的脱敏类型')
];

const auditLogValidation = [
  query('type')
    .optional()
    .isIn(['rate_limit', 'data_access', 'auth_attempt', 'permission_denied', 'suspicious_activity'])
    .withMessage('无效的日志类型'),
  query('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('无效的严重级别'),
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('页码必须是1-1000之间的整数'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('每页数量必须是1-200之间的整数')
];

const suspiciousActivityValidation = [
  body('ip')
    .notEmpty()
    .withMessage('IP地址不能为空')
    .isIP()
    .withMessage('无效的IP地址'),
  body('timeWindowMs')
    .optional()
    .isInt({ min: 60000, max: 3600000 })
    .withMessage('时间窗口必须是60000-3600000毫秒之间')
];

/**
 * 安全防护路由
 *
 * 提供限流、数据脱敏、健康检查等安全防护功能
 */

// 应用认证中间件
router.use(authenticateToken);
router.use(securityRateLimit);

// 应用权限中间件
router.use(requirePermission({
  resource: 'security',
  actions: ['read']
}));

/**
 * 获取安全统计信息
 * GET /api/admin/security/stats
 */
router.get('/stats',
  async (req, res, next) => {
    try {
      const stats = await securityService.getSecurityStats();

      res.json({
        success: true,
        data: stats,
        requestId: req.id
      });
    } catch (error) {
      logger.error('获取安全统计失败:', error);
      next(error);
    }
  }
);

/**
 * 执行健康检查
 * GET /api/admin/security/health
 */
router.get('/health',
  async (req, res, next) => {
    try {
      const healthResult = await securityService.performHealthChecks();

      res.status(healthResult.overall === 'healthy' ? 200 :
                   healthResult.overall === 'warning' ? 200 : 503).json({
        success: healthResult.overall !== 'unhealthy',
        data: healthResult,
        requestId: req.id
      });
    } catch (error) {
      logger.error('健康检查失败:', error);
      next(error);
    }
  }
);

/**
 * 获取安全审计日志
 * GET /api/admin/security/audit-logs
 */
router.get('/audit-logs',
  auditLogValidation,
  validate,
  async (req, res, next) => {
    try {
      const {
        type,
        severity,
        userId,
        ip,
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = req.query;

      const filters: any = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      if (type) filters.type = type;
      if (severity) filters.severity = severity;
      if (userId) filters.userId = userId;
      if (ip) filters.ip = ip;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const result = await securityService.getAuditLogs(filters);

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error('获取安全审计日志失败:', error);
      next(error);
    }
  }
);

// ============ 需要管理权限的路由 ============
router.use(requirePermission({
  resource: 'security',
  actions: ['manage', 'test']
}));

/**
 * 检查频率限制
 * POST /api/admin/security/rate-limit/check
 */
router.post('/rate-limit/check',
  requirePermission({
    resource: 'security',
    actions: ['manage']
  }),
  rateLimitConfigValidation,
  validate,
  async (req, res, next) => {
    try {
      const { windowMs, maxRequests, key } = req.body;

      const result = await securityService.checkRateLimit(key, {
        windowMs,
        maxRequests,
        message: '请求过于频繁，请稍后再试'
      });

      logger.info('频率限制检查', {
        key,
        allowed: result.allowed,
        remaining: result.remaining,
        checkedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error('检查频率限制失败:', error);
      next(error);
    }
  }
);

/**
 * 重置频率限制
 * DELETE /api/admin/security/rate-limit/:key
 */
router.delete('/rate-limit/:key',
  requirePermission({
    resource: 'security',
    actions: ['manage']
  }),
  param('key')
    .notEmpty()
    .withMessage('限流键不能为空'),
  validate,
  async (req, res, next) => {
    try {
      const { key } = req.params;

      const success = await securityService.resetRateLimit(key);

      logger.info('频率限制重置', {
        key,
        success,
        resetBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success,
        message: success ? '频率限制重置成功' : '频率限制重置失败',
        requestId: req.id
      });
    } catch (error) {
      logger.error('重置频率限制失败:', error);
      next(error);
    }
  }
);

/**
 * 数据脱敏测试
 * POST /api/admin/security/data-masking
 */
router.post('/data-masking',
  requirePermission({
    resource: 'security',
    actions: ['test']
  }),
  dataMaskingValidation,
  validate,
  async (req, res, next) => {
    try {
      const { data, rules } = req.body;

      const maskedData = securityService.maskData(data, rules);

      logger.info('数据脱敏测试', {
        rulesCount: rules.length,
        fieldsCount: Object.keys(data).length,
        testedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: {
          original: data,
          masked: maskedData,
          rules
        },
        requestId: req.id
      });
    } catch (error) {
      logger.error('数据脱敏测试失败:', error);
      next(error);
    }
  }
);

/**
 * 检测可疑活动
 * POST /api/admin/security/suspicious-activity/detect
 */
router.post('/suspicious-activity/detect',
  requirePermission({
    resource: 'security',
    actions: ['manage']
  }),
  suspiciousActivityValidation,
  validate,
  async (req, res, next) => {
    try {
      const { ip, timeWindowMs = 300000 } = req.body;

      const result = await securityService.detectSuspiciousActivity(ip, timeWindowMs);

      logger.info('可疑活动检测', {
        ip,
        suspicious: result.suspicious,
        riskScore: result.riskScore,
        reasonsCount: result.reasons.length,
        detectedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error('检测可疑活动失败:', error);
      next(error);
    }
  }
);

/**
 * 手动记录安全事件
 * POST /api/admin/security/audit-logs
 */
router.post('/audit-logs',
  requirePermission({
    resource: 'security',
    actions: ['manage']
  }),
  body('type')
    .isIn(['rate_limit', 'data_access', 'auth_attempt', 'permission_denied', 'suspicious_activity'])
    .withMessage('无效的日志类型'),
  body('severity')
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('无效的严重级别'),
  body('ip')
    .notEmpty()
    .withMessage('IP地址不能为空')
    .isIP()
    .withMessage('无效的IP地址'),
  body('endpoint')
    .notEmpty()
    .withMessage('端点不能为空'),
  body('method')
    .isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
    .withMessage('无效的HTTP方法'),
  body('details')
    .optional()
    .isObject()
    .withMessage('详情必须是对象'),
  validate,
  async (req, res, next) => {
    try {
      const {
        type,
        severity,
        userId,
        ip,
        userAgent,
        endpoint,
        method,
        details = {}
      } = req.body;

      await securityService.logSecurityEvent({
        type,
        severity,
        userId,
        ip,
        userAgent,
        endpoint,
        method,
        details,
        // 自动添加请求信息
        userId: userId || req.user?.id,
        ip: ip || req.ip,
        userAgent: userAgent || req.get('User-Agent'),
        endpoint: endpoint || req.path,
        method: method || req.method
      });

      logger.info('安全事件记录', {
        type,
        severity,
        ip,
        endpoint,
        method,
        loggedBy: req.user.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: '安全事件记录成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('记录安全事件失败:', error);
      next(error);
    }
  }
);

/**
 * 获取脱敏规则示例
 * GET /api/admin/security/masking-rules/examples
 */
router.get('/masking-rules/examples',
  requirePermission({
    resource: 'security',
    actions: ['read']
  }),
  async (req, res, next) => {
    try {
      const examples = [
        {
          field: 'email',
          type: 'email',
          description: '邮箱地址脱敏'
        },
        {
          field: 'phone',
          type: 'phone',
          description: '手机号脱敏'
        },
        {
          field: 'idCard',
          type: 'id_card',
          description: '身份证号脱敏'
        },
        {
          field: 'bankCard',
          type: 'bank_card',
          description: '银行卡号脱敏'
        },
        {
          field: 'password',
          type: 'password',
          description: '密码脱敏'
        },
        {
          field: 'token',
          type: 'token',
          description: 'Token脱敏'
        },
        {
          field: 'customField',
          type: 'custom',
          customPattern: '\\d{4}',
          replacement: '****',
          description: '自定义脱敏规则'
        }
      ];

      res.json({
        success: true,
        data: { examples },
        requestId: req.id
      });
    } catch (error) {
      logger.error('获取脱敏规则示例失败:', error);
      next(error);
    }
  }
);

/**
 * 获取限流配置示例
 * GET /api/admin/security/rate-limit/examples
 */
router.get('/rate-limit/examples',
  requirePermission({
    resource: 'security',
    actions: ['read']
  }),
  async (req, res, next) => {
    try {
      const examples = [
        {
          name: '严格限制',
          config: {
            windowMs: 60000,
            maxRequests: 10,
            key: 'strict_limit'
          },
          description: '每分钟最多10次请求'
        },
        {
          name: '中等限制',
          config: {
            windowMs: 60000,
            maxRequests: 100,
            key: 'medium_limit'
          },
          description: '每分钟最多100次请求'
        },
        {
          name: '宽松限制',
          config: {
            windowMs: 60000,
            maxRequests: 1000,
            key: 'loose_limit'
          },
          description: '每分钟最多1000次请求'
        },
        {
          name: '小时限制',
          config: {
            windowMs: 3600000,
            maxRequests: 5000,
            key: 'hourly_limit'
          },
          description: '每小时最多5000次请求'
        }
      ];

      res.json({
        success: true,
        data: { examples },
        requestId: req.id
      });
    } catch (error) {
      logger.error('获取限流配置示例失败:', error);
      next(error);
    }
  }
);

/**
 * 测试数据脱敏
 * POST /api/admin/security/masking-test
 */
router.post('/masking-test',
  requirePermission({
    resource: 'security',
    actions: ['test']
  }),
  body('testType')
    .isIn(['email', 'phone', 'id_card', 'bank_card', 'password', 'token', 'custom'])
    .withMessage('无效的测试类型'),
  body('value')
    .notEmpty()
    .withMessage('测试值不能为空'),
  validate,
  async (req, res, next) => {
    try {
      const { testType, value } = req.body;

      const rule = {
        field: 'test',
        type: testType
      };

      const maskedValue = securityService.maskData({ test: value }, [rule]).test;

      logger.info('数据脱敏测试', {
        testType,
        originalLength: value.length,
        maskedLength: maskedValue.length,
        testedBy: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        data: {
          original: value,
          masked: maskedValue,
          type: testType
        },
        requestId: req.id
      });
    } catch (error) {
      logger.error('测试数据脱敏失败:', error);
      next(error);
    }
  }
);

module.exports = router;