import { Router } from 'express';
import tenantsController from '../controllers/tenants.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// 所有租户接口都需要登录
router.use(authenticate);

// 路由定义
router.get('/', tenantsController.list);
router.get('/:tenantId', tenantsController.get);

export default router;
