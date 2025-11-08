import { Router } from 'express';
import pipelineSchemaController from '../controllers/pipelineSchema.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/require-permission.middleware.js';

const router = Router();
router.use(authenticate);

const RES = 'pipelines';

router.get(
  '/',
  requirePermission({ resource: RES, actions: ['read'] }),
  pipelineSchemaController.getSchemas
);
router.get(
  '/categories',
  requirePermission({ resource: RES, actions: ['read'] }),
  pipelineSchemaController.getSchemaCategories
);
router.get(
  '/stats',
  requirePermission({ resource: RES, actions: ['read'] }),
  pipelineSchemaController.getSchemaStats
);
router.post(
  '/batch-validate',
  requirePermission({ resource: RES, actions: ['update'] }),
  pipelineSchemaController.batchValidateSchemas
);
router.get(
  '/:id',
  requirePermission({ resource: RES, actions: ['read'] }),
  pipelineSchemaController.getSchemaById
);
router.post(
  '/:id/validate',
  requirePermission({ resource: RES, actions: ['update'] }),
  pipelineSchemaController.validateSchema
);
router.get(
  '/:id/validations',
  requirePermission({ resource: RES, actions: ['read'] }),
  pipelineSchemaController.getValidationHistory
);
router.post(
  '/:id/clone',
  requirePermission({ resource: RES, actions: ['create'] }),
  pipelineSchemaController.cloneSchema
);
router.post(
  '/',
  requirePermission({ resource: RES, actions: ['create'] }),
  pipelineSchemaController.createSchema
);
router.put(
  '/:id',
  requirePermission({ resource: RES, actions: ['update'] }),
  pipelineSchemaController.updateSchema
);
router.delete(
  '/:id',
  requirePermission({ resource: RES, actions: ['delete'] }),
  pipelineSchemaController.deleteSchema
);

export default router;
