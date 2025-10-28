const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * 管理后台路由
 * 
 * 注意: 实际生产环境中应该添加管理员权限验证中间件
 * 这里简化处理,仅验证登录状态
 */

// 系统概览
router.get('/overview', authMiddleware, adminController.getOverview.bind(adminController));

// 用户管理
router.get('/users', authMiddleware, adminController.getUsers.bind(adminController));

// 任务管理
router.get('/tasks', authMiddleware, adminController.getTasks.bind(adminController));

// 失败任务列表
router.get('/failed-tasks', authMiddleware, adminController.getFailedTasks.bind(adminController));

module.exports = router;
