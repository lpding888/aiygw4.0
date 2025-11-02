const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * @route POST /api/auth/send-code
 * @desc 发送验证码
 * @access Public
 */
router.post('/send-code', authController.sendCode);

/**
 * @route POST /api/auth/login
 * @desc 登录/注册
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route POST /api/auth/wechat-login
 * @desc 微信登录
 * @access Public
 */
router.post('/wechat-login', authController.wechatLogin);

/**
 * @route GET /api/auth/me
 * @desc 获取当前用户信息
 * @access Private
 */
router.get('/me', authenticate, authController.getMe);

module.exports = router;
