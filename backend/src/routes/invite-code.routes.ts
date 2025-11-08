import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, query } from 'express-validator';
import inviteCodeController from '../controllers/invite-code.controller.js';
import { authenticate as authenticateToken } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';

const router = Router();

// 生成限制
const generateRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: '邀请码生成过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
});

// 使用/验证限制
const useRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: '邀请码验证过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
});

// 校验器
const generateValidation = [
  body('count').optional().isInt({ min: 1, max: 1000 }).withMessage('生成数量必须在1-1000之间'),
  body('type')
    .optional()
    .isIn(['general', 'vip', 'special', 'limited'])
    .withMessage('无效的邀请码类型'),
  body('maxUses').optional().isInt({ min: 1, max: 100 }).withMessage('最大使用次数必须在1-100之间'),
  body('validDays').optional().isInt({ min: 1, max: 365 }).withMessage('有效天数必须在1-365之间'),
  body('batchName')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('批次名称最多100个字符'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('批次描述最多500个字符')
];

const validateValidation = [
  body('code')
    .notEmpty()
    .withMessage('邀请码不能为空')
    .isString()
    .isLength({ min: 4, max: 20 })
    .withMessage('邀请码长度必须在4-20个字符之间')
];

const useValidation = [
  body('code')
    .notEmpty()
    .withMessage('邀请码不能为空')
    .isString()
    .isLength({ min: 4, max: 20 })
    .withMessage('邀请码长度必须在4-20个字符之间'),
  body('inviterId').optional().isUUID().withMessage('邀请人ID格式无效'),
  body('inviteeEmail').optional().isEmail().withMessage('被邀请人邮箱格式无效'),
  body('inviteePhone').optional().isMobilePhone('zh-CN').withMessage('被邀请人手机号格式无效')
];

const codeParamValidation = [
  param('code')
    .notEmpty()
    .withMessage('邀请码不能为空')
    .isString()
    .isLength({ min: 4, max: 20 })
    .withMessage('邀请码长度必须在4-20个字符之间')
];

const userIdParamValidation = [param('userId').optional().isUUID().withMessage('用户ID格式无效')];

const queryValidation = [
  query('type')
    .optional()
    .isIn(['general', 'vip', 'special', 'limited'])
    .withMessage('无效的邀请码类型'),
  query('status')
    .optional()
    .isIn(['active', 'used', 'expired', 'disabled'])
    .withMessage('无效的邀请码状态'),
  query('creatorId').optional().isUUID().withMessage('创建者ID格式无效'),
  query('inviterId').optional().isUUID().withMessage('邀请人ID格式无效'),
  query('inviteeId').optional().isUUID().withMessage('被邀请人ID格式无效'),
  query('page').optional().isInt({ min: 1, max: 1000 }).withMessage('页码必须在1-1000之间'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('sortBy')
    .optional()
    .isIn(['created_at', 'updated_at', 'used_count', 'expires_at'])
    .withMessage('无效的排序字段'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('无效的排序方向')
];

const usageLogQueryValidation = [
  query('inviteCodeId').optional().isUUID().withMessage('邀请码ID格式无效'),
  query('inviterId').optional().isUUID().withMessage('邀请人ID格式无效'),
  query('inviteeId').optional().isUUID().withMessage('被邀请人ID格式无效'),
  query('status').optional().isIn(['pending', 'success', 'failed']).withMessage('无效的邀请状态'),
  query('page').optional().isInt({ min: 1, max: 1000 }).withMessage('页码必须在1-1000之间'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('sortBy').optional().isIn(['created_at', 'updated_at']).withMessage('无效的排序字段'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('无效的排序方向')
];

// 公开：验证邀请码
router.post(
  '/validate',
  useRateLimit,
  validateValidation,
  validate,
  inviteCodeController.validateInviteCode.bind(inviteCodeController)
);

// 登录后
router.use(authenticateToken);

// 使用邀请码
router.post(
  '/use',
  useRateLimit,
  useValidation,
  validate,
  inviteCodeController.useInviteCode.bind(inviteCodeController)
);

// 用户统计
router.get(
  '/stats/user/:userId',
  userIdParamValidation,
  validate,
  inviteCodeController.getUserInviteStats.bind(inviteCodeController)
);

// 当前用户统计
router.get('/stats/me', inviteCodeController.getUserInviteStats.bind(inviteCodeController));

// 邀请码列表
router.get(
  '/',
  queryValidation,
  validate,
  inviteCodeController.getInviteCodes.bind(inviteCodeController)
);

// 邀请记录
router.get(
  '/logs',
  usageLogQueryValidation,
  validate,
  inviteCodeController.getInviteUsageLogs.bind(inviteCodeController)
);

// 管理员才能操作
router.use(requireAdmin);

router.post(
  '/generate',
  generateRateLimit,
  generateValidation,
  validate,
  inviteCodeController.generateInviteCodes.bind(inviteCodeController)
);

router.put(
  '/disable/:code',
  codeParamValidation,
  validate,
  inviteCodeController.disableInviteCode.bind(inviteCodeController)
);

router.get('/stats/system', inviteCodeController.getInviteCodeStats.bind(inviteCodeController));

router.post(
  '/cleanup/expired',
  inviteCodeController.cleanupExpiredCodes.bind(inviteCodeController)
);

export default router;
