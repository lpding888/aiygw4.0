import { Router } from 'express';
import cmsProviderController from '../controllers/cmsProvider.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/require-permission.middleware.js';

const router = Router();
router.use(authenticate);

const PROVIDERS = 'providers';

router.get(
  '/',
  requirePermission({ resource: PROVIDERS, actions: ['read'] }),
  cmsProviderController.getProviders.bind(cmsProviderController)
);
router.get(
  '/stats',
  requirePermission({ resource: PROVIDERS, actions: ['read'] }),
  cmsProviderController.getProviderStats.bind(cmsProviderController)
);
router.get(
  '/types',
  requirePermission({ resource: PROVIDERS, actions: ['read'] }),
  cmsProviderController.getProviderTypes.bind(cmsProviderController)
);
router.get(
  '/:id',
  requirePermission({ resource: PROVIDERS, actions: ['read'] }),
  cmsProviderController.getProviderById.bind(cmsProviderController)
);
router.post(
  '/:id/test',
  requirePermission({ resource: PROVIDERS, actions: ['test'] }),
  cmsProviderController.testProvider.bind(cmsProviderController)
);

router.post(
  '/',
  requirePermission({ resource: PROVIDERS, actions: ['create'] }),
  cmsProviderController.createProvider.bind(cmsProviderController)
);
router.put(
  '/:id',
  requirePermission({ resource: PROVIDERS, actions: ['update'] }),
  cmsProviderController.updateProvider.bind(cmsProviderController)
);
router.patch(
  '/:id/toggle',
  requirePermission({ resource: PROVIDERS, actions: ['update'] }),
  cmsProviderController.toggleProvider.bind(cmsProviderController)
);
router.post(
  '/test-all',
  requirePermission({ resource: PROVIDERS, actions: ['test'] }),
  cmsProviderController.testAllProviders.bind(cmsProviderController)
);
router.delete(
  '/:id',
  requirePermission({ resource: PROVIDERS, actions: ['delete'] }),
  cmsProviderController.deleteProvider.bind(cmsProviderController)
);

export default router;
