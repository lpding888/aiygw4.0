import { Router } from 'express';
import systemConfigController from '../controllers/systemConfig.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, systemConfigController.list);
router.get('/categories', authenticate, systemConfigController.getCategories);
router.get('/category/:category', authenticate, systemConfigController.getCategory);
router.post('/reload-cache', authenticate, systemConfigController.reloadCache);
router.get('/export', authenticate, systemConfigController.export);
router.post('/import', authenticate, systemConfigController.import);
router.post('/batch', authenticate, systemConfigController.setBatch);
router.get('/:key', authenticate, systemConfigController.getValue);
router.put('/:key', authenticate, systemConfigController.setValue);
router.delete('/:key', authenticate, systemConfigController.delete);

export default router;
