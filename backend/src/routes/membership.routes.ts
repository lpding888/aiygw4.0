import { Router } from 'express';
import membershipController from '../controllers/membership.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/purchase', authenticate, membershipController.purchase);
router.post('/payment-callback', membershipController.paymentCallback);
router.get('/status', authenticate, membershipController.getStatus);

export default router;
