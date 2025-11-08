import { Router } from 'express';
import featureController from '../controllers/feature.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

// 功能卡片路由（TS版）
const router = Router();

// GET /api/features - 获取功能卡片列表（公开）
router.get('/', featureController.getFeatures.bind(featureController));

// GET /api/features/:featureId/form-schema - 获取表单Schema（需要登录）
router.get(
  '/:featureId/form-schema',
  authenticate,
  featureController.getFormSchema.bind(featureController)
);

export default router;
