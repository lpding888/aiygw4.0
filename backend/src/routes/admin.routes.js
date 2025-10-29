const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const assetController = require('../controllers/asset.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/adminAuth.middleware');

/**
 * 管理后台路由
 * 所有路由都需要 admin 角色权限
 */

// 系统概览
router.get('/overview', authenticate, requireAdmin, adminController.getOverview);

// 用户管理
router.get('/users', authenticate, requireAdmin, adminController.getUsers);

// 任务管理
router.get('/tasks', authenticate, requireAdmin, adminController.getTasks);

// 失败任务列表
router.get('/failed-tasks', authenticate, requireAdmin, adminController.getFailedTasks);

// ========== 功能卡片管理 ==========

// 获取所有功能卡片（包括禁用的）
router.get('/features', authenticate, requireAdmin, adminController.getFeatures);

// 创建新功能卡片
router.post('/features', authenticate, requireAdmin, adminController.createFeature);

// 更新功能卡片
router.put('/features/:featureId', authenticate, requireAdmin, adminController.updateFeature);

// 快速切换功能启用状态
router.patch('/features/:featureId', authenticate, requireAdmin, adminController.toggleFeature);

// 软删除功能卡片
router.delete('/features/:featureId', authenticate, requireAdmin, adminController.deleteFeature);

// ========== 素材库管理 ==========

// 管理员查看所有用户素材
router.get('/assets', authenticate, requireAdmin, assetController.getAllAssets);

module.exports = router;
