/**
 * 定价配置路由
 */

import { Router } from 'express';
import pricingConfigsController from '../controllers/pricingConfigs.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 管理端
router.get(
  '/admin/pricing-configs',
  authenticate,
  requireAdmin,
  pricingConfigsController.listPricingConfigs.bind(pricingConfigsController)
);
router.post(
  '/admin/pricing-configs',
  authenticate,
  requireAdmin,
  pricingConfigsController.createPricingConfig.bind(pricingConfigsController)
);
router.get(
  '/admin/pricing-configs/:id',
  authenticate,
  requireAdmin,
  pricingConfigsController.getPricingConfig.bind(pricingConfigsController)
);
router.put(
  '/admin/pricing-configs/:id',
  authenticate,
  requireAdmin,
  pricingConfigsController.updatePricingConfig.bind(pricingConfigsController)
);
router.delete(
  '/admin/pricing-configs/:id',
  authenticate,
  requireAdmin,
  pricingConfigsController.deletePricingConfig.bind(pricingConfigsController)
);

// 前台
router.get(
  '/pricing-configs/active',
  pricingConfigsController.getActivePricingConfigs.bind(pricingConfigsController)
);
router.post(
  '/pricing-configs/validate',
  pricingConfigsController.validateCode.bind(pricingConfigsController)
);

export default router;
