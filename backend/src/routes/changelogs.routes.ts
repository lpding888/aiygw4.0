/**
 * 更新日志路由
 */

import { Router } from 'express';
import changelogsController from '../controllers/changelogs.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// ============ 管理端路由 ============

router.get(
  '/admin/changelogs',
  authenticate,
  requireAdmin,
  changelogsController.listChangelogs.bind(changelogsController)
);
router.post(
  '/admin/changelogs',
  authenticate,
  requireAdmin,
  changelogsController.createChangelog.bind(changelogsController)
);
router.get(
  '/admin/changelogs/:id',
  authenticate,
  requireAdmin,
  changelogsController.getChangelog.bind(changelogsController)
);
router.put(
  '/admin/changelogs/:id',
  authenticate,
  requireAdmin,
  changelogsController.updateChangelog.bind(changelogsController)
);
router.delete(
  '/admin/changelogs/:id',
  authenticate,
  requireAdmin,
  changelogsController.deleteChangelog.bind(changelogsController)
);
router.patch(
  '/admin/changelogs/:id/publish',
  authenticate,
  requireAdmin,
  changelogsController.publishChangelog.bind(changelogsController)
);

// AI功能
router.post(
  '/admin/changelogs/ai-summary',
  authenticate,
  requireAdmin,
  changelogsController.aiGenerateSummary.bind(changelogsController)
);

// ============ 前台路由 ============

router.get('/changelogs', changelogsController.getPublishedChangelogs.bind(changelogsController));
router.get(
  '/changelogs/latest',
  changelogsController.getLatestChangelog.bind(changelogsController)
);
router.get(
  '/changelogs/:version',
  changelogsController.getChangelogByVersion.bind(changelogsController)
);

export default router;
