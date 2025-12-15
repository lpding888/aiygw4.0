/**
 * 租户路由
 * 艹！多租户API端点！
 */

import { Router } from 'express';
import tenantController from '../controllers/tenant.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// 所有租户路由都需要认证
router.use(authenticate);

// 租户CRUD
router.get('/', tenantController.list.bind(tenantController));
router.post('/', tenantController.create.bind(tenantController));
router.get('/:id', tenantController.get.bind(tenantController));
router.put('/:id', tenantController.update.bind(tenantController));
router.delete('/:id', tenantController.delete.bind(tenantController));

// 成员管理
router.get('/:id/members', tenantController.listMembers.bind(tenantController));
router.post('/:id/members', tenantController.addMember.bind(tenantController));
router.put('/:id/members/:memberId', tenantController.updateMember.bind(tenantController));
router.delete('/:id/members/:memberId', tenantController.removeMember.bind(tenantController));

// 离开租户
router.post('/:id/leave', tenantController.leave.bind(tenantController));

export default router;
