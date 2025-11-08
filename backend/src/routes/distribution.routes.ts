import { Router } from 'express';
import distributionController from '../controllers/distribution.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// 用户端接口（需要登录）
router.post('/apply', authenticate, distributionController.apply.bind(distributionController));
router.get('/status', authenticate, distributionController.getStatus.bind(distributionController));
router.get('/detail', authenticate, distributionController.getDetail.bind(distributionController));
router.get(
  '/dashboard',
  authenticate,
  distributionController.getDashboard.bind(distributionController)
);
router.get(
  '/referrals',
  authenticate,
  distributionController.getReferrals.bind(distributionController)
);
router.get(
  '/commissions',
  authenticate,
  distributionController.getCommissions.bind(distributionController)
);
router.get(
  '/withdrawals',
  authenticate,
  distributionController.getWithdrawals.bind(distributionController)
);
router.post(
  '/withdraw',
  authenticate,
  distributionController.createWithdrawal.bind(distributionController)
);

export default router;
