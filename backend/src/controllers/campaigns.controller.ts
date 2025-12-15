/**
 * 活动页控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as campaignsRepo from '../repositories/campaigns.repo.js';
import aiContentService from '../services/ai-content.service.js';

class CampaignsController {
  async listCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, type, limit = 50, offset = 0 } = req.query;
      const campaigns = await campaignsRepo.listCampaigns({
        status: status as string,
        type: type as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      res.json({ success: true, data: { items: campaigns, limit, offset } });
    } catch (error) {
      next(error);
    }
  }

  async getCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaign = await campaignsRepo.getCampaignById(parseInt(req.params.id));
      if (!campaign) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '活动不存在' } });
        return;
      }
      res.json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  }

  async createCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaign = await campaignsRepo.createCampaign({
        ...req.body,
        created_by: req.user?.id
      });
      res.status(201).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  }

  async updateCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaign = await campaignsRepo.updateCampaign(parseInt(req.params.id), req.body);
      res.json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  }

  async deleteCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await campaignsRepo.deleteCampaign(parseInt(req.params.id));
      if (!deleted) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '活动不存在' } });
        return;
      }
      res.json({ success: true, message: '活动已删除' });
    } catch (error) {
      next(error);
    }
  }

  async getActiveCampaigns(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaigns = await campaignsRepo.getActiveCampaigns();
      res.json({ success: true, data: campaigns });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaign = await campaignsRepo.getCampaignBySlug(req.params.slug);
      if (!campaign || campaign.status === 'draft') {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '活动不存在' } });
        return;
      }
      await campaignsRepo.incrementViewCount(campaign.id);
      res.json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  }

  async aiGenerateContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, type } = req.body;
      const result = await aiContentService.generateText(
        'campaign_content',
        `为"${name}"${type || '促销'}活动生成吸引人的宣传文案，包括标题和描述`,
        ['zh-CN'],
        'marketing',
        300
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new CampaignsController();
