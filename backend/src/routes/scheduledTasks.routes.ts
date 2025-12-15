/**
 * 定时发布路由
 */
import { Router } from 'express';
import scheduledTasksController from '../controllers/scheduledTasks.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

router.get(
  '/admin/scheduled-tasks',
  authenticate,
  requireAdmin,
  scheduledTasksController.listTasks.bind(scheduledTasksController)
);
router.post(
  '/admin/scheduled-tasks',
  authenticate,
  requireAdmin,
  scheduledTasksController.createTask.bind(scheduledTasksController)
);
router.get(
  '/admin/scheduled-tasks/pending',
  authenticate,
  requireAdmin,
  scheduledTasksController.getPendingTasks.bind(scheduledTasksController)
);
router.get(
  '/admin/scheduled-tasks/:id',
  authenticate,
  requireAdmin,
  scheduledTasksController.getTask.bind(scheduledTasksController)
);
router.put(
  '/admin/scheduled-tasks/:id',
  authenticate,
  requireAdmin,
  scheduledTasksController.updateTask.bind(scheduledTasksController)
);
router.delete(
  '/admin/scheduled-tasks/:id',
  authenticate,
  requireAdmin,
  scheduledTasksController.deleteTask.bind(scheduledTasksController)
);
router.post(
  '/admin/scheduled-tasks/:id/cancel',
  authenticate,
  requireAdmin,
  scheduledTasksController.cancelTask.bind(scheduledTasksController)
);

export default router;
