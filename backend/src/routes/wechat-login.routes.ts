import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query, body } from 'express-validator';
import wechatLoginController from '../controllers/wechat-login.controller.js';
import { validate } from '../middlewares/validate.middleware.js';

const router = Router();

const wechatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: '请求过于频繁，请稍后再试' }
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: { code: 'LOGIN_RATE_LIMIT', message: '登录尝试过于频繁，请稍后再试' }
  }
});

// Official OAuth URL
router.get(
  '/official/oauth',
  wechatLimiter,
  [
    query('redirectUri').isURL().withMessage('回调地址格式不正确'),
    query('scope')
      .optional()
      .isIn(['snsapi_base', 'snsapi_userinfo'])
      .withMessage('授权范围必须是: snsapi_base, snsapi_userinfo'),
    query('state')
      .optional()
      .isLength({ min: 1, max: 128 })
      .withMessage('状态参数长度必须在1-128之间')
  ],
  validate,
  wechatLoginController.generateOfficialOAuthUrl
);

// Official OAuth callback
router.get('/official/callback', loginLimiter, wechatLoginController.handleOfficialOAuthCallback);

// Mini program login
router.post(
  '/miniprogram/login',
  loginLimiter,
  [
    body('code').notEmpty().withMessage('登录凭证不能为空'),
    body('userInfo').optional().isObject().withMessage('用户信息必须是对象')
  ],
  validate,
  wechatLoginController.handleMiniProgramLogin
);

// Open platform OAuth URL
router.get(
  '/open/oauth',
  wechatLimiter,
  [
    query('redirectUri').isURL().withMessage('回调地址格式不正确'),
    query('state')
      .optional()
      .isLength({ min: 1, max: 128 })
      .withMessage('状态参数长度必须在1-128之间')
  ],
  validate,
  wechatLoginController.generateOpenPlatformOAuthUrl
);

// Open platform callback
router.get('/open/callback', loginLimiter, wechatLoginController.handleOpenPlatformCallback);

// Bindings
router.get('/bindings', wechatLimiter, wechatLoginController.getUserWechatBindings);
router.delete('/bindings', wechatLimiter, wechatLoginController.unbindWechat);

// Stats
router.get('/stats', wechatLimiter, wechatLoginController.getWechatLoginStats);

// Official server verify + message
router.get('/official/verify', wechatLoginController.verifyOfficialServer);
router.post('/official/verify', wechatLoginController.handleOfficialMessage);

// Update mini program profile
router.post(
  '/miniprogram/update-profile',
  wechatLimiter,
  [body('userInfo').notEmpty().isObject().withMessage('用户信息不能为空且必须是对象')],
  validate,
  wechatLoginController.updateMiniProgramProfile
);

// Bind Wechat Pay
router.post(
  '/pay/bind',
  wechatLimiter,
  [
    body('openid').notEmpty().withMessage('openid不能为空'),
    body('unionid').optional().isString().withMessage('unionid必须是字符串')
  ],
  validate,
  wechatLoginController.bindWechatPay
);

export default router;
