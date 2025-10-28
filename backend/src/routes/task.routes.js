const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * 任务路由 - 处理AI处理任务相关请求
 * 所有接口都需要登录
 */

// 创建任务
router.post('/create', authMiddleware, taskController.create.bind(taskController));

// 获取任务详情
router.get('/:taskId', authMiddleware, taskController.get.bind(taskController));

// 获取任务列表
router.get('/list', authMiddleware, taskController.list.bind(taskController));

// 更新任务状态(内部使用)
router.put('/:taskId/status', authMiddleware, taskController.updateStatus.bind(taskController));

module.exports = router;
