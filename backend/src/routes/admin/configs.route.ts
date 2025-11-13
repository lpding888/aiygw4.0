import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/adminAuth.middleware.js';
import adminSystemConfigController from '../../controllers/admin/systemConfig.controller.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', (req, res, next) => adminSystemConfigController.list(req, res, next));
router.get('/stats', (req, res, next) => adminSystemConfigController.stats(req, res, next));

router.get('/snapshots', (req, res, next) =>
  adminSystemConfigController.listSnapshots(req, res, next)
);
router.post('/snapshots', (req, res, next) =>
  adminSystemConfigController.createSnapshot(req, res, next)
);
router.post('/snapshots/:snapshotId/rollback', (req, res, next) =>
  adminSystemConfigController.rollbackSnapshot(req, res, next)
);

router.post('/', (req, res, next) => adminSystemConfigController.create(req, res, next));
router.put('/:key', (req, res, next) => adminSystemConfigController.update(req, res, next));
router.delete('/:key', (req, res, next) => adminSystemConfigController.remove(req, res, next));
router.get('/:key/history', (req, res, next) =>
  adminSystemConfigController.history(req, res, next)
);

export default router;
