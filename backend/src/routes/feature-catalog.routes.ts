import { Router } from 'express';
import { body, query, param } from 'express-validator';
import featureCatalogController from '../controllers/feature-catalog.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';

const router = Router();

// 查询参数校验（公开列表）
const queryValidationRules = [
  query('category')
    .optional()
    .isIn([
      'image_processing',
      'ai_generation',
      'video_processing',
      'audio_processing',
      'text_processing',
      'data_analysis',
      'file_management',
      'user_management',
      'payment',
      'integration'
    ])
    .withMessage('分类必须是有效的值'),
  query('type')
    .optional()
    .isIn(['basic', 'premium', 'enterprise', 'beta'])
    .withMessage('类型必须是basic、premium、enterprise或beta'),
  query('is_public').optional().isBoolean().withMessage('is_public必须是布尔值'),
  query('is_enabled').optional().isBoolean().withMessage('is_enabled必须是布尔值'),
  query('tags').optional().isString().withMessage('tags必须是字符串'),
  query('search')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('search长度需在1-100字符之间'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit必须是1-100之间的整数'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset必须是非负整数'),
  query('sort_by')
    .optional()
    .isIn(['name', 'category', 'type', 'released_at', 'created_at'])
    .withMessage('sort_by必须是有效的字段'),
  query('sort_order').optional().isIn(['asc', 'desc']).withMessage('sort_order必须是asc或desc')
];

// 列表与详情（注意：/api/features 为前台 feature.routes.ts，管理端挂载在 /api/admin/features）
router.get(
  '/',
  authenticate,
  requireRole('admin'),
  queryValidationRules,
  validate,
  featureCatalogController.getFeatures
);

router.get(
  '/:featureKey',
  authenticate,
  requireRole('admin'),
  [param('featureKey').notEmpty()],
  validate,
  featureCatalogController.getFeatureById
);

router.post(
  '/',
  authenticate,
  requireRole('admin'),
  [
    body('feature_key').notEmpty().withMessage('feature_key不能为空'),
    body('name').notEmpty().withMessage('name不能为空'),
    body('category').notEmpty().withMessage('category不能为空')
  ],
  validate,
  featureCatalogController.createFeature
);

router.put(
  '/:featureKey',
  authenticate,
  requireRole('admin'),
  [param('featureKey').notEmpty()],
  validate,
  featureCatalogController.updateFeature
);
router.patch(
  '/:featureKey',
  authenticate,
  requireRole('admin'),
  [param('featureKey').notEmpty()],
  validate,
  featureCatalogController.updateFeature
);
router.delete(
  '/:featureKey',
  authenticate,
  requireRole('admin'),
  [param('featureKey').notEmpty()],
  validate,
  featureCatalogController.deleteFeature
);

// 统计与服务状态
router.get(
  '/stats',
  authenticate,
  requireRole('admin'),
  [query('group_by').optional().isIn(['day', 'feature', 'user'])],
  validate,
  featureCatalogController.getUsageStats
);
router.get(
  '/service-stats',
  authenticate,
  requireRole('admin'),
  featureCatalogController.getServiceStats
);

export default router;
