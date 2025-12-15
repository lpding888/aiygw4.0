/**
 * 用户评价路由
 */

import { Router } from 'express';
import reviewsController from '../controllers/reviews.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 管理端
router.get(
  '/admin/reviews',
  authenticate,
  requireAdmin,
  reviewsController.listReviews.bind(reviewsController)
);
router.get(
  '/admin/reviews/:id',
  authenticate,
  requireAdmin,
  reviewsController.getReview.bind(reviewsController)
);
router.put(
  '/admin/reviews/:id',
  authenticate,
  requireAdmin,
  reviewsController.updateReview.bind(reviewsController)
);
router.delete(
  '/admin/reviews/:id',
  authenticate,
  requireAdmin,
  reviewsController.deleteReview.bind(reviewsController)
);
router.patch(
  '/admin/reviews/:id/approve',
  authenticate,
  requireAdmin,
  reviewsController.approveReview.bind(reviewsController)
);
router.post(
  '/admin/reviews/:id/reply',
  authenticate,
  requireAdmin,
  reviewsController.replyToReview.bind(reviewsController)
);

// 前台
router.get('/reviews', reviewsController.getApprovedReviews.bind(reviewsController));
router.get('/reviews/stats', reviewsController.getAverageRating.bind(reviewsController));
router.post('/reviews', authenticate, reviewsController.createReview.bind(reviewsController));

export default router;
