import { Router } from 'express';
import cmsFeatureController from '../controllers/cmsFeature.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/require-permission.middleware.js';

const router = Router();

// 所有路由需要认证
router.use(authenticate);

// helper for permissions
const FEATURES = 'features';

router.get(
  '/',
  requirePermission({ resource: FEATURES, actions: ['read'] }),
  cmsFeatureController.getFeatures.bind(cmsFeatureController)
);
router.get(
  '/categories',
  requirePermission({ resource: FEATURES, actions: ['read'] }),
  cmsFeatureController.getFeatureCategories.bind(cmsFeatureController)
);
router.get(
  '/:id',
  requirePermission({ resource: FEATURES, actions: ['read'] }),
  cmsFeatureController.getFeatureById.bind(cmsFeatureController)
);
router.get(
  '/:id/history',
  requirePermission({ resource: FEATURES, actions: ['read'] }),
  cmsFeatureController.getFeatureHistory.bind(cmsFeatureController)
);

router.post(
  '/',
  requirePermission({ resource: FEATURES, actions: ['create'] }),
  cmsFeatureController.createFeature.bind(cmsFeatureController)
);
router.put(
  '/:id',
  requirePermission({ resource: FEATURES, actions: ['update'] }),
  cmsFeatureController.updateFeature.bind(cmsFeatureController)
);
router.patch(
  '/:id/toggle',
  requirePermission({ resource: FEATURES, actions: ['update'] }),
  cmsFeatureController.toggleFeature.bind(cmsFeatureController)
);
router.patch(
  '/batch',
  requirePermission({ resource: FEATURES, actions: ['update'] }),
  cmsFeatureController.batchUpdateFeatures.bind(cmsFeatureController)
);

router.delete(
  '/:id',
  requirePermission({ resource: FEATURES, actions: ['delete'] }),
  cmsFeatureController.deleteFeature.bind(cmsFeatureController)
);
router.post(
  '/:id/publish',
  requirePermission({ resource: FEATURES, actions: ['publish'] }),
  cmsFeatureController.publishFeature.bind(cmsFeatureController)
);
router.post(
  '/:id/rollback',
  requirePermission({ resource: FEATURES, actions: ['rollback'] }),
  cmsFeatureController.rollbackFeature.bind(cmsFeatureController)
);

export default router;
