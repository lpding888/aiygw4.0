import { Router } from 'express';
import referralController from '../controllers/referral-validation.controller.js';
import { authenticate as authenticateToken } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { body, query } from 'express-validator';

const router = Router();

// 公共接口（根据原有行为设置，默认需要认证，部分统计可能公开）
router.use(authenticateToken);

// 校验邀请关系
router.post(
  '/validate',
  [body('referralCode').notEmpty().withMessage('referralCode不能为空')],
  validate,
  referralController.validateReferral
);

// 查询邀请统计（管理员）
router.get(
  '/stats',
  [query('date').optional().isISO8601().withMessage('日期格式无效')],
  validate,
  requireAdmin,
  referralController.getReferralStats
);

export default router;
