const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/media.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * 媒体路由 - 处理COS上传相关请求
 * 所有接口都需要登录
 */

// 获取STS临时密钥
router.get('/sts', authMiddleware, mediaController.getSTS.bind(mediaController));

// 验证文件上传参数
router.post('/validate', authMiddleware, mediaController.validateUpload.bind(mediaController));

module.exports = router;
