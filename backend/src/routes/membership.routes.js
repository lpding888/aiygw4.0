const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membership.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * @route POST /api/membership/purchase
 * @desc 购买会员
 * @access Private
 */
router.post('/purchase', authenticate, membershipController.purchase);

/**
 * @route POST /api/membership/payment-callback
 * @desc 支付回调(支付平台调用)
 * @access Public
 */
router.post('/payment-callback', membershipController.paymentCallback);

/**
 * @route GET /api/membership/status
 * @desc 获取会员状态
 * @access Private
 */
router.get('/status', authenticate, membershipController.getStatus);

module.exports = router;
