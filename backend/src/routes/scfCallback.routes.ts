import { Router } from 'express';
import scfCallbackController from '../controllers/scfCallback.controller.js';

const router = Router();

router.post('/callback', scfCallbackController.handleCallback);

export default router;
