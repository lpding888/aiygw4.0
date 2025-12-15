/**
 * 定价配置控制器
 */

import { Request, Response, NextFunction } from 'express';
import * as pricingConfigsRepo from '../repositories/pricingConfigs.repo.js';

class PricingConfigsController {
  async listPricingConfigs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, type, limit = 50, offset = 0 } = req.query;
      const configs = await pricingConfigsRepo.listPricingConfigs({
        status: status as string,
        type: type as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      res.json({ success: true, data: { items: configs, limit, offset } });
    } catch (error) {
      next(error);
    }
  }

  async getPricingConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await pricingConfigsRepo.getPricingConfigById(parseInt(req.params.id));
      if (!config) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '配置不存在' } });
        return;
      }
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async createPricingConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await pricingConfigsRepo.createPricingConfig({
        ...req.body,
        created_by: req.user?.id
      });
      res.status(201).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async updatePricingConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await pricingConfigsRepo.updatePricingConfig(
        parseInt(req.params.id),
        req.body
      );
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async deletePricingConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleted = await pricingConfigsRepo.deletePricingConfig(parseInt(req.params.id));
      if (!deleted) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: '配置不存在' } });
        return;
      }
      res.json({ success: true, message: '配置已删除' });
    } catch (error) {
      next(error);
    }
  }

  async getActivePricingConfigs(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configs = await pricingConfigsRepo.getActivePricingConfigs();
      res.json({ success: true, data: configs });
    } catch (error) {
      next(error);
    }
  }

  async validateCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, orderAmount } = req.body;
      const result = await pricingConfigsRepo.validatePricingConfig(code, orderAmount);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new PricingConfigsController();
