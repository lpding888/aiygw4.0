import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/adminAuth.middleware.js';
import aiHelperController from '../../controllers/admin/aiHelper.controller.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/config', (req, res, next) => aiHelperController.getConfig(req, res, next));
router.post('/config', (req, res, next) => aiHelperController.saveConfig(req, res, next));
router.post('/test', (req, res, next) => aiHelperController.testConnection(req, res, next));
router.get('/models', (req, res, next) => aiHelperController.listModels(req, res, next));

export default router;
