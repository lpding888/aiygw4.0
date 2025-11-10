import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import inviteCodeService from '../services/invite-code.service.js';

interface GenerateCodesBody {
  count?: number;
  type?: string;
  maxUses?: number;
  validDays?: number;
  batchName?: string | null;
  description?: string | null;
}

interface CodeItem {
  expires_at?: unknown;
}

/**
 * 邀请码控制器（TS版）
 */
class InviteCodeController {
  async generateInviteCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        count = 10,
        type = 'general',
        maxUses = 1,
        validDays = 30,
        batchName = null,
        description = null
      } = (req.body ?? {}) as GenerateCodesBody;

      if (!Number.isInteger(count) || count < 1 || count > 1000) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'count',
          message: '生成数量必须在1-1000之间'
        });
      }
      if (!['general', 'vip', 'special', 'limited'].includes(String(type))) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'type',
          message: '无效的邀请码类型'
        });
      }
      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'maxUses',
          message: '最大使用次数必须在1-100之间'
        });
      }
      if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'validDays',
          message: '有效天数必须在1-365之间'
        });
      }

      const user = req.user as { id?: string } | undefined;
      const createdBy = user?.id || 'system';

      const options = {
        count: Number(count),
        type: String(type),
        maxUses: Number(maxUses),
        validDays: Number(validDays),
        batchName: batchName as string | null,
        description: description as string | null,
        createdBy
      };

      const codes = await inviteCodeService.generateInviteCodes(options);
      logger.info(
        `[InviteCodeController] User ${createdBy} generated ${codes.length} invite codes`
      );

      const firstCode = codes?.[0] as CodeItem | undefined;
      res.json({
        success: true,
        message: `成功生成${codes.length}个邀请码`,
        data: {
          codes,
          summary: {
            total: codes.length,
            type: options.type,
            maxUses: options.maxUses,
            validDays: options.validDays,
            expiresAt: firstCode?.expires_at
          }
        }
      });
    } catch (error) {
      logger.error('[InviteCodeController] Failed to generate invite codes:', error);
      next(error);
    }
  }

  async validateInviteCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.body ?? {};
      if (!code || typeof code !== 'string') {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'code',
          message: '邀请码不能为空'
        });
      }
      const result = await inviteCodeService.validateInviteCode(code);
      logger.info(`[InviteCodeController] Invite code validation: ${code} -> ${(result as { valid?: unknown })?.valid}`);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('[InviteCodeController] Failed to validate invite code:', error);
      next(error);
    }
  }

  async useInviteCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, inviterId, inviteeEmail, inviteePhone } = req.body ?? {};
      if (!code || typeof code !== 'string') {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'code',
          message: '邀请码不能为空'
        });
      }
      const user = req.user as { id?: string } | undefined;
      const usageData = {
        userId: user?.id,
        inviterId,
        inviteeEmail,
        inviteePhone
      };
      const result = await inviteCodeService.useInviteCode(code, usageData);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('[InviteCodeController] Failed to use invite code:', error);
      next(error);
    }
  }

  async getInviteCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const options = {
        type: req.query.type as string | undefined,
        status: req.query.status as string | undefined,
        creatorId: req.query.creatorId as string | undefined,
        inviterId: req.query.inviterId as string | undefined,
        inviteeId: req.query.inviteeId as string | undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        sortBy: (req.query.sortBy as string | undefined) ?? 'created_at',
        sortOrder: (req.query.sortOrder as string | undefined) ?? 'desc'
      };
      const codes = await inviteCodeService.getInviteCodes(options);
      res.json({ success: true, data: codes });
    } catch (error) {
      logger.error('[InviteCodeController] Failed to get invite codes:', error);
      next(error);
    }
  }

  async getUserInviteStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { id?: string } | undefined;
      const targetUserId = (req.params?.userId as string | undefined) ?? user?.id;
      const stats = await inviteCodeService.getUserInviteStats(targetUserId);
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('[InviteCodeController] Failed to get user invite stats:', error);
      next(error);
    }
  }

  async getInviteUsageLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sortBy = (req.query.sortBy as string | undefined)?.toLowerCase();
      const sortOrderParam = (req.query.sortOrder as string | undefined)?.toLowerCase();
      const normalizedSortBy: 'created_at' | 'updated_at' =
        sortBy === 'updated_at' ? 'updated_at' : 'created_at';
      const normalizedSortOrder: 'asc' | 'desc' = sortOrderParam === 'asc' ? 'asc' : 'desc';

      const options = {
        inviteCodeId: req.query.inviteCodeId as string | undefined,
        inviterId: req.query.inviterId as string | undefined,
        inviteeId: req.query.inviteeId as string | undefined,
        status: req.query.status as string | undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        sortBy: normalizedSortBy,
        sortOrder: normalizedSortOrder
      };
      const logs = await inviteCodeService.getInviteUsageLogs(options);
      res.json({ success: true, data: logs });
    } catch (error) {
      logger.error('[InviteCodeController] Failed to get invite usage logs:', error);
      next(error);
    }
  }

  async disableInviteCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.params as { code: string };
      const success = await inviteCodeService.disableInviteCode(code);
      res.json({ success, message: success ? '禁用成功' : '禁用失败' });
    } catch (error) {
      logger.error('[InviteCodeController] Failed to disable invite code:', error);
      next(error);
    }
  }

  async getInviteCodeStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await inviteCodeService.getInviteCodeStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('[InviteCodeController] Failed to get invite code stats:', error);
      next(error);
    }
  }

  async cleanupExpiredCodes(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await inviteCodeService.cleanupExpiredCodes();
      res.json({ success: true, message: '清理完成' });
    } catch (error) {
      logger.error('[InviteCodeController] Failed to cleanup expired codes:', error);
      next(error);
    }
  }
}

export default new InviteCodeController();
