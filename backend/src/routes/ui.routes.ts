import { Router } from 'express';
import uiSchemaController from '../controllers/uiSchema.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/require-permission.middleware.js';

const router = Router();

// 菜单与UI schema 可匿名（根据角色 viewer 过滤）
router.get('/menus', uiSchemaController.getMenus);
router.get('/schema', uiSchemaController.getUiSchema);
router.get('/schema/:featureKey', uiSchemaController.getFeatureUiConfig);

// 用户角色信息需认证
router.get('/role', authenticate, uiSchemaController.getUserRole);

// 失效UI缓存 需要系统更新权限
router.post(
  '/invalidate',
  authenticate,
  requirePermission({ resource: 'system', actions: ['update'] }),
  uiSchemaController.invalidateCache
);

// 健康检查
router.get('/health', uiSchemaController.healthCheck);

export default router;
