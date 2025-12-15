/**
 * 工作流审批路由
 */
import { Router } from 'express';
import workflowsController from '../controllers/workflows.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 工作流管理
router.get(
  '/admin/workflows',
  authenticate,
  requireAdmin,
  workflowsController.listWorkflows.bind(workflowsController)
);
router.post(
  '/admin/workflows',
  authenticate,
  requireAdmin,
  workflowsController.createWorkflow.bind(workflowsController)
);
router.get(
  '/admin/workflows/:id',
  authenticate,
  requireAdmin,
  workflowsController.getWorkflow.bind(workflowsController)
);
router.put(
  '/admin/workflows/:id',
  authenticate,
  requireAdmin,
  workflowsController.updateWorkflow.bind(workflowsController)
);
router.delete(
  '/admin/workflows/:id',
  authenticate,
  requireAdmin,
  workflowsController.deleteWorkflow.bind(workflowsController)
);
router.post(
  '/admin/workflows/:workflowId/steps',
  authenticate,
  requireAdmin,
  workflowsController.createStep.bind(workflowsController)
);
router.put(
  '/admin/workflows/steps/:id',
  authenticate,
  requireAdmin,
  workflowsController.updateStep.bind(workflowsController)
);
router.delete(
  '/admin/workflows/steps/:id',
  authenticate,
  requireAdmin,
  workflowsController.deleteStep.bind(workflowsController)
);

// 工作流实例
router.get(
  '/admin/workflow-instances',
  authenticate,
  requireAdmin,
  workflowsController.listInstances.bind(workflowsController)
);
router.post(
  '/admin/workflow-instances',
  authenticate,
  requireAdmin,
  workflowsController.startWorkflow.bind(workflowsController)
);
router.post(
  '/admin/workflow-instances/:id/approve',
  authenticate,
  requireAdmin,
  workflowsController.approveStep.bind(workflowsController)
);
router.post(
  '/admin/workflow-instances/:id/reject',
  authenticate,
  requireAdmin,
  workflowsController.rejectStep.bind(workflowsController)
);

export default router;
