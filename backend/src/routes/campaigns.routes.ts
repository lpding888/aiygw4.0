/**
 * 活动页路由
 */

import { Router } from 'express';
import campaignsController from '../controllers/campaigns.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/adminAuth.middleware.js';

const router = Router();

// 管理端
router.get(
  '/admin/campaigns',
  authenticate,
  requireAdmin,
  campaignsController.listCampaigns.bind(campaignsController)
);
router.post(
  '/admin/campaigns',
  authenticate,
  requireAdmin,
  campaignsController.createCampaign.bind(campaignsController)
);
router.get(
  '/admin/campaigns/:id',
  authenticate,
  requireAdmin,
  campaignsController.getCampaign.bind(campaignsController)
);
router.put(
  '/admin/campaigns/:id',
  authenticate,
  requireAdmin,
  campaignsController.updateCampaign.bind(campaignsController)
);
router.delete(
  '/admin/campaigns/:id',
  authenticate,
  requireAdmin,
  campaignsController.deleteCampaign.bind(campaignsController)
);
router.post(
  '/admin/campaigns/ai-content',
  authenticate,
  requireAdmin,
  campaignsController.aiGenerateContent.bind(campaignsController)
);

// 前台
router.get('/campaigns/active', campaignsController.getActiveCampaigns.bind(campaignsController));
router.get('/campaigns/:slug', campaignsController.getCampaignBySlug.bind(campaignsController));

export default router;
