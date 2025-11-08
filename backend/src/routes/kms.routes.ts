import { Router } from 'express';
import kmsController from '../controllers/kms.controller.js';
import { authenticate as authenticateToken } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { body, param } from 'express-validator';

const router = Router();

// Auth + Admin guard
router.use(authenticateToken);
router.use(requireAdmin);

const idParam = [param('id').notEmpty().withMessage('ID不能为空')];

// 具体的路由映射保持与 JS 版本一致（最小替换）
router.get('/', kmsController.listKeys);
router.get('/:id', idParam, validate, kmsController.getKey);
router.post(
  '/',
  [body('name').notEmpty().withMessage('名称不能为空')],
  validate,
  kmsController.createKey
);
router.put('/:id', idParam.concat([body('name').optional()]), validate, kmsController.updateKey);
router.delete('/:id', idParam, validate, kmsController.deleteKey);

export default router;
