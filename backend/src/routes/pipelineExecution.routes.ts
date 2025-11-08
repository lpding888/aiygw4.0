import { Router } from 'express';
import pipelineExecutionController from '../controllers/pipelineExecution.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/require-permission.middleware.js';

const router = Router();
router.use(authenticate);

const RES = 'pipelines';

router.get(
  '/',
  requirePermission({ resource: RES, actions: ['read'] }),
  pipelineExecutionController.getExecutions
);
router.get(
  '/stats',
  requirePermission({ resource: RES, actions: ['read'] }),
  pipelineExecutionController.getExecutionStats
);
router.get(
  '/health',
  requirePermission({ resource: RES, actions: ['read'] }),
  pipelineExecutionController.healthCheck
);
router.post(
  '/batch-operate',
  requirePermission({ resource: RES, actions: ['update'] }),
  pipelineExecutionController.batchOperateExecutions
);
router.post(
  '/cleanup',
  requirePermission({ resource: RES, actions: ['delete'] }),
  pipelineExecutionController.cleanupExecutions
);
router.post(
  '/',
  requirePermission({ resource: RES, actions: ['create'] }),
  pipelineExecutionController.createExecution
);
router.post(
  '/start',
  requirePermission({ resource: RES, actions: ['create'] }),
  pipelineExecutionController.createAndStartExecution
);
router.get(
  '/:id',
  requirePermission({ resource: RES, actions: ['read'] }),
  pipelineExecutionController.getExecution
);
router.post(
  '/:id/start',
  requirePermission({ resource: RES, actions: ['update'] }),
  pipelineExecutionController.startExecution
);
router.post(
  '/:id/cancel',
  requirePermission({ resource: RES, actions: ['update'] }),
  pipelineExecutionController.cancelExecution
);
router.get(
  '/:id/events',
  requirePermission({ resource: RES, actions: ['read'] }),
  pipelineExecutionController.getExecutionEvents
);

export default router;
