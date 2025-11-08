import { Router } from 'express';
import taskController from '../controllers/task.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

router.post(
  '/create-by-feature',
  authenticate,
  taskController.createByFeature.bind(taskController)
);
router.post('/create', authenticate, taskController.create.bind(taskController));
router.get('/:taskId', authenticate, taskController.get.bind(taskController));
router.get('/list', authenticate, taskController.list.bind(taskController));
router.put('/:taskId/status', authenticate, taskController.updateStatus.bind(taskController));

// 管理员
router.get(
  '/admin/tasks',
  authenticate,
  requireRole('admin'),
  taskController.adminList.bind(taskController)
);
router.get(
  '/admin/tasks/search',
  authenticate,
  requireRole('admin'),
  taskController.search.bind(taskController)
);
router.get(
  '/admin/db/performance',
  authenticate,
  requireRole('admin'),
  taskController.getDbPerformance.bind(taskController)
);

export default router;
