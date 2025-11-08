import type { Request, Response, NextFunction } from 'express';
import distributionService from '../services/distribution.service.js';

/**
 * 分销代理控制器（TS版）
 */
class DistributionController {
  async apply(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId ?? (req as any).user?.id;
      const { realName, idCard, contact, channel } = req.body ?? {};
      if (!realName || !idCard || !contact) {
        res
          .status(400)
          .json({ success: false, error: { code: 6000, message: '请填写完整的申请资料' } });
        return;
      }
      const result = await distributionService.applyDistributor(userId, {
        realName,
        idCard,
        contact,
        channel
      });
      res.json({ success: true, data: result, message: '申请已提交，请等待审核' });
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId ?? (req as any).user?.id;
      const status = await distributionService.getDistributorStatus(userId);
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  async getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId ?? (req as any).user?.id;
      const detail = await distributionService.getDistributorDetail(userId);
      res.json({ success: true, data: detail });
    } catch (error) {
      next(error);
    }
  }

  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId ?? (req as any).user?.id;
      const dashboard = await distributionService.getDashboard(userId);
      res.json({ success: true, data: dashboard });
    } catch (error) {
      next(error);
    }
  }

  async getReferrals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId ?? (req as any).user?.id;
      const { status = 'all', limit = 20, offset = 0 } = req.query as any;
      const result = await distributionService.getReferrals(userId, {
        status,
        limit: Number(limit),
        offset: Number(offset)
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getCommissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId ?? (req as any).user?.id;
      const { status = 'all', limit = 20, offset = 0 } = req.query as any;
      const result = await distributionService.getCommissions(userId, {
        status,
        limit: Number(limit),
        offset: Number(offset)
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId ?? (req as any).user?.id;
      const { limit = 20, offset = 0 } = req.query as any;
      const result = await distributionService.getWithdrawals(userId, {
        limit: Number(limit),
        offset: Number(offset)
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async createWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId ?? (req as any).user?.id;
      const { amount, method, accountInfo } = req.body ?? {};
      if (!amount || !method || !accountInfo) {
        res
          .status(400)
          .json({ success: false, error: { code: 6000, message: '请填写完整的提现信息' } });
        return;
      }
      const withdrawalId = await distributionService.createWithdrawal(userId, {
        amount: Number(amount),
        method,
        accountInfo
      });
      res.json({ success: true, data: { withdrawalId }, message: '提现申请已提交，请等待审核' });
    } catch (error) {
      next(error);
    }
  }
}

export default new DistributionController();
