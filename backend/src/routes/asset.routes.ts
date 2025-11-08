import { Router } from 'express';
import assetController from '../controllers/asset.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, assetController.getAssets);
router.delete('/:assetId', authenticate, assetController.deleteAsset);

export default router;
