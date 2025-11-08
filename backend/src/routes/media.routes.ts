import { Router } from 'express';
import mediaController from '../controllers/media.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/sts', authenticate, mediaController.getSTS);
router.post('/validate', authenticate, mediaController.validateUpload);

export default router;
