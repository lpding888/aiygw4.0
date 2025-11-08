import { Router } from 'express';
import adminController from '../controllers/admin.controller.js';
import assetController from '../controllers/asset.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

// 子控制器（JS），以 d.ts 桥接
import featureWizardController from '../controllers/admin/featureWizard.controller.js';
import pipelinesValidateController from '../controllers/admin/pipelines-validate.controller.js';
import formSchemasController from '../controllers/admin/formSchemas.controller.js';
import promptsController from '../controllers/admin/prompts.controller.js';

const router = Router();

// 系统概览
router.get('/overview', authenticate, requireAdmin, adminController.getOverview);

// 用户管理
router.get('/users', authenticate, requireAdmin, adminController.getUsers);

// 任务管理
router.get('/tasks', authenticate, requireAdmin, adminController.getTasks);

// 失败任务列表
router.get('/failed-tasks', authenticate, requireAdmin, adminController.getFailedTasks);

// 功能卡片管理
router.get('/features', authenticate, requireAdmin, adminController.getFeatures);
router.post('/features', authenticate, requireAdmin, adminController.createFeature);
router.put('/features/:featureId', authenticate, requireAdmin, adminController.updateFeature);
router.patch('/features/:featureId', authenticate, requireAdmin, adminController.toggleFeature);
router.delete('/features/:featureId', authenticate, requireAdmin, adminController.deleteFeature);

// Feature Wizard（需先于 /features 正则路由）
router.post(
  '/features/wizard',
  authenticate,
  requireAdmin,
  featureWizardController.createFeatureFromWizard
);

// 素材库管理（管理员查看所有用户素材）
router.get('/assets', authenticate, requireAdmin, assetController.getAllAssets);

// 分销代理管理
router.get('/distributors', authenticate, requireAdmin, adminController.getDistributors);
router.get('/distributors/:id', authenticate, requireAdmin, adminController.getDistributorDetail);
router.get(
  '/distributors/:id/referrals',
  authenticate,
  requireAdmin,
  adminController.getDistributorReferrals
);
router.get(
  '/distributors/:id/commissions',
  authenticate,
  requireAdmin,
  adminController.getDistributorCommissions
);
router.patch(
  '/distributors/:id/approve',
  authenticate,
  requireAdmin,
  adminController.approveDistributor
);
router.patch(
  '/distributors/:id/disable',
  authenticate,
  requireAdmin,
  adminController.disableDistributor
);

// 提现管理
router.get('/withdrawals', authenticate, requireAdmin, adminController.getWithdrawals);
router.patch(
  '/withdrawals/:id/approve',
  authenticate,
  requireAdmin,
  adminController.approveWithdrawal
);
router.patch(
  '/withdrawals/:id/reject',
  authenticate,
  requireAdmin,
  adminController.rejectWithdrawal
);

// 分销数据/配置
router.get('/distribution/stats', authenticate, requireAdmin, adminController.getDistributionStats);
router.get(
  '/distribution/settings',
  authenticate,
  requireAdmin,
  adminController.getDistributionSettings
);
router.put(
  '/distribution/settings',
  authenticate,
  requireAdmin,
  adminController.updateDistributionSettings
);

// Pipeline 拓扑校验
router.post(
  '/pipelines/validate',
  authenticate,
  requireAdmin,
  pipelinesValidateController.validatePipeline
);
router.post(
  '/pipelines/topological-order',
  authenticate,
  requireAdmin,
  pipelinesValidateController.getTopologicalOrder
);

// 表单Schema管理
router.get('/form-schemas', authenticate, requireAdmin, formSchemasController.listFormSchemas);
router.get(
  '/form-schemas/:schemaId',
  authenticate,
  requireAdmin,
  formSchemasController.getFormSchema
);
router.get(
  '/form-schemas/:schemaId/versions',
  authenticate,
  requireAdmin,
  formSchemasController.getFormSchemaVersions
);
router.post('/form-schemas', authenticate, requireAdmin, formSchemasController.createFormSchema);
router.post(
  '/form-schemas/:schemaId/versions',
  authenticate,
  requireAdmin,
  formSchemasController.createFormSchemaVersion
);
router.patch(
  '/form-schemas/:schemaId/versions/:version/publish',
  authenticate,
  requireAdmin,
  formSchemasController.publishFormSchemaVersion
);
router.patch(
  '/form-schemas/:schemaId/versions/:version/switch',
  authenticate,
  requireAdmin,
  formSchemasController.switchFormSchemaVersion
);
router.delete(
  '/form-schemas/:schemaId',
  authenticate,
  requireAdmin,
  formSchemasController.deleteFormSchema
);

// Prompt 模板管理（版本管理部分保持注释的历史行为不变）
router.post('/prompts/preview', authenticate, requireAdmin, promptsController.previewPrompt);
router.post('/prompts/validate', authenticate, requireAdmin, promptsController.validatePrompt);
router.get('/prompts/helpers', authenticate, requireAdmin, promptsController.getHelpers);

export default router;
