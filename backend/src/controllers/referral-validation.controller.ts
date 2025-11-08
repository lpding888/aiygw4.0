import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import referralValidationService from '../services/referral-validation.service.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import { db } from '../config/database.js';

class ReferralValidationController {
  /**
   * 通用推荐验证
   * 支持两种输入：
   * - referralCode：直接校验推荐码有效性（基于 referrals 表）
   * - referrerId + refereeId：调用服务进行关系校验
   */
  async validateReferral(req: Request, res: Response, next: NextFunction) {
    try {
      const { referralCode, referrerId, refereeId, referralData = {} } = (req.body ?? {}) as any;

      // 优先使用 referrerId + refereeId 的关系验证
      if (referrerId && refereeId) {
        const dataWithMeta = {
          ...referralData,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        };
        const result = await referralValidationService.validateReferralRelationship(
          referrerId,
          refereeId,
          dataWithMeta
        );
        res.json({ success: true, data: result });
        return;
      }

      // 否则使用 referralCode 的直接校验
      if (!referralCode || typeof referralCode !== 'string') {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'referralCode',
          message: 'referralCode不能为空'
        });
      }

      const referral = await db('referrals').where('referral_code', referralCode).first();
      if (!referral) {
        res.status(404).json({
          success: false,
          error: { code: ERROR_CODES.USER_NOT_FOUND as any, message: '推荐码不存在' }
        });
        return;
      }

      const now = new Date();
      const expired = referral.expires_at
        ? now.getTime() > new Date(referral.expires_at).getTime()
        : false;
      const validStatus = ['pending', 'validated'];
      const isValid = validStatus.includes(referral.status) && !expired;

      res.json({
        success: true,
        data: {
          valid: isValid,
          status: referral.status,
          expired,
          referrerId: referral.referrer_id,
          refereeId: referral.referee_id,
          referralId: referral.id
        }
      });
    } catch (error) {
      logger.error('[ReferralValidationController] validateReferral failed:', error as any);
      next(error);
    }
  }

  /**
   * 推荐统计
   * 若提供 date（YYYY-MM-DD），返回该日统计；否则返回总体按状态聚合
   */
  async getReferralStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { date } = (req.query ?? {}) as any;

      if (date) {
        // 尝试读取 referral_statistics 表（若存在），否则退化到 referrals 聚合
        let stats: any = null;
        try {
          stats = await db('referral_statistics').where('date', date).first();
        } catch {
          // ignore, fall back below
        }
        if (!stats) {
          const rows = await db('referrals')
            .whereRaw('DATE(created_at) = ?', [date])
            .select('status')
            .count('* as cnt')
            .groupBy('status');
          res.json({ success: true, data: { date, byStatus: rows } });
          return;
        }
        res.json({ success: true, data: stats });
        return;
      }

      const rows = await db('referrals').select('status').count('* as cnt').groupBy('status');
      const total = await db('referrals').count('* as cnt').first();
      res.json({
        success: true,
        data: { total: Number((total as any)?.cnt ?? 0), byStatus: rows }
      });
    } catch (error) {
      logger.error('[ReferralValidationController] getReferralStats failed:', error as any);
      next(error);
    }
  }
}

export default new ReferralValidationController();
