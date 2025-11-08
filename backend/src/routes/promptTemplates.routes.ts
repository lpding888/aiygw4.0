import { Router } from 'express';
import promptTemplateController from '../controllers/promptTemplate.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/require-permission.middleware.js';

const router = Router();
router.use(authenticate);

const PROMPTS = 'prompt_templates';

router.get(
  '/',
  requirePermission({ resource: PROMPTS, actions: ['read'] }),
  promptTemplateController.getTemplates
);
router.get(
  '/stats',
  requirePermission({ resource: PROMPTS, actions: ['read'] }),
  promptTemplateController.getTemplateStats
);
router.get(
  '/categories',
  requirePermission({ resource: PROMPTS, actions: ['read'] }),
  promptTemplateController.getTemplateCategories
);
router.get(
  '/examples',
  requirePermission({ resource: PROMPTS, actions: ['read'] }),
  promptTemplateController.getTemplateExamples
);
router.post(
  '/batch-preview',
  requirePermission({ resource: PROMPTS, actions: ['update'] }),
  promptTemplateController.batchPreviewTemplates
);
router.get(
  '/health',
  requirePermission({ resource: PROMPTS, actions: ['read'] }),
  promptTemplateController.healthCheck
);
router.get(
  '/key/:key',
  requirePermission({ resource: PROMPTS, actions: ['read'] }),
  promptTemplateController.getTemplateByKey
);
router.get(
  '/:id',
  requirePermission({ resource: PROMPTS, actions: ['read'] }),
  promptTemplateController.getTemplateById
);
router.get(
  '/:id/versions',
  requirePermission({ resource: PROMPTS, actions: ['read'] }),
  promptTemplateController.getTemplateVersions
);
router.post(
  '/:id/preview',
  requirePermission({ resource: PROMPTS, actions: ['update'] }),
  promptTemplateController.previewTemplate
);
router.post(
  '/:id/validate',
  requirePermission({ resource: PROMPTS, actions: ['update'] }),
  promptTemplateController.validateTemplate
);
router.post(
  '/:id/publish',
  requirePermission({ resource: PROMPTS, actions: ['update'] }),
  promptTemplateController.publishTemplate
);
router.post(
  '/:id/archive',
  requirePermission({ resource: PROMPTS, actions: ['update'] }),
  promptTemplateController.archiveTemplate
);
router.post(
  '/:id/rollback',
  requirePermission({ resource: PROMPTS, actions: ['update'] }),
  promptTemplateController.rollbackToVersion
);
router.post(
  '/:id/duplicate',
  requirePermission({ resource: PROMPTS, actions: ['create'] }),
  promptTemplateController.duplicateTemplate
);
router.post(
  '/',
  requirePermission({ resource: PROMPTS, actions: ['create'] }),
  promptTemplateController.createTemplate
);
router.put(
  '/:id',
  requirePermission({ resource: PROMPTS, actions: ['update'] }),
  promptTemplateController.updateTemplate
);
router.delete(
  '/:id',
  requirePermission({ resource: PROMPTS, actions: ['delete'] }),
  promptTemplateController.deleteTemplate
);

export default router;
