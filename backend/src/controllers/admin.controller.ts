import type { Request, Response, NextFunction } from 'express';
import type { Knex } from 'knex';
import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import encryptionUtils from '../utils/encryption.js';

type CountValue = string | number | bigint | null | undefined;

type DistributionSettingsUpdate = {
  commission_rate?: number;
  freeze_days?: number;
  min_withdrawal_amount?: number;
  auto_approve?: boolean;
  updated_at?: Date;
};

const firstValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : undefined;
  }
  return value;
};

const toSafeInteger = (value: unknown, fallback = 0): number => {
  const target = firstValue(value);
  if (typeof target === 'number' && Number.isFinite(target)) {
    return Math.trunc(target);
  }
  if (typeof target === 'string' && target.trim() !== '') {
    const parsed = Number.parseInt(target, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  if (typeof target === 'bigint') {
    return Number(target);
  }
  return fallback;
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  const target = firstValue(value);
  if (typeof target === 'boolean') {
    return target;
  }
  if (typeof target === 'string') {
    if (target === 'true') return true;
    if (target === 'false') return false;
  }
  return undefined;
};

const normalizeCount = (value: CountValue): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const toError = (error: unknown): Error =>
  error instanceof Error
    ? error
    : new Error(typeof error === 'string' ? error : JSON.stringify(error));

const fetchCount = async (query: Knex.QueryBuilder): Promise<number> => {
  const rows = (await query.count('* as count')) as Array<{ count: CountValue }>;
  return rows.length > 0 ? normalizeCount(rows[0]?.count) : 0;
};

const toStringValue = (value: unknown): string | undefined => {
  const target = firstValue(value);
  return typeof target === 'string' ? target : undefined;
};

const logAndNext = (next: NextFunction, error: unknown, context: string): void => {
  const err = toError(error);
  logger.error(`${context}: ${err.message}`, err);
  next(err);
};

const isSuperAdminUser = (req: Request): boolean => {
  const role = (req.user as { role?: string } | undefined)?.role;
  return role === 'super_admin';
};

/**
 * 管理后台控制器 - 处理管理相关请求
 */
class AdminController {
  /**
   * 获取用户列表
   * GET /api/admin/users?limit=10&offset=0&isMember=true
   */
  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 20, offset = 0, isMember } = req.query as Record<string, unknown>;
      const limitValue = toSafeInteger(limit, 20);
      const offsetValue = toSafeInteger(offset, 0);
      const memberFilter = toOptionalBoolean(isMember);

      let query = db('users')
        .select(
          'id',
          'phone',
          'isMember',
          'quota_remaining',
          'quota_expireAt',
          'created_at',
          'updated_at'
        )
        .orderBy('created_at', 'desc');

      // 按会员状态筛选
      if (memberFilter !== undefined) {
        query = query.where('isMember', memberFilter);
      }

      const users = await query.limit(limitValue).offset(offsetValue);

      // 获取总数
      let countQuery = db('users');
      if (memberFilter !== undefined) {
        countQuery = countQuery.where('isMember', memberFilter);
      }
      const total = await fetchCount(countQuery);

      // 获取统计信息
      const stats = await this.getUserStats();

      res.json({
        success: true,
        data: {
          users,
          total,
          limit: limitValue,
          offset: offsetValue,
          stats
        }
      });
    } catch (error) {
      const err = toError(error);
      logger.error(`[AdminController] 获取用户列表失败: ${err.message}`, err);
      next(err);
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    memberUsers: number;
    activeMembers: number;
    memberRate: string;
  }> {
    const totalUsersCount = await fetchCount(db('users'));
    const memberUsersCount = await fetchCount(db('users').where('isMember', true));
    const activeMembersCount = await fetchCount(
      db('users').where('isMember', true).where('quota_expireAt', '>', new Date())
    );

    return {
      totalUsers: totalUsersCount,
      memberUsers: memberUsersCount,
      activeMembers: activeMembersCount,
      memberRate:
        totalUsersCount > 0 ? ((memberUsersCount / totalUsersCount) * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * 获取任务列表
   * GET /api/admin/tasks?limit=20&offset=0&status=success&type=basic_clean
   */
  async getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 20, offset = 0, status, type, userId } = req.query as Record<string, unknown>;
      const limitValue = toSafeInteger(limit, 20);
      const offsetValue = toSafeInteger(offset, 0);

      let query = db('tasks')
        .select('tasks.*', 'users.phone as userPhone')
        .leftJoin('users', 'tasks.userId', 'users.id')
        .orderBy('tasks.created_at', 'desc');

      // 筛选条件
      const statusValue = toStringValue(status);
      if (statusValue) {
        query = query.where('tasks.status', statusValue);
      }
      const typeValue = toStringValue(type);
      if (typeValue) {
        query = query.where('tasks.type', typeValue);
      }
      const userIdValue = toStringValue(userId);
      if (userIdValue) {
        query = query.where('tasks.userId', userIdValue);
      }

      const tasks = await query.limit(limitValue).offset(offsetValue);

      // 获取总数
      let countQuery = db('tasks');
      if (statusValue) countQuery = countQuery.where('status', statusValue);
      if (typeValue) countQuery = countQuery.where('type', typeValue);
      if (userIdValue) countQuery = countQuery.where('userId', userIdValue);
      const total = await fetchCount(countQuery);

      // 获取任务统计
      const stats = await this.getTaskStats();

      res.json({
        success: true,
        data: {
          tasks,
          total,
          limit: limitValue,
          offset: offsetValue,
          stats
        }
      });
    } catch (error) {
      const err = toError(error);
      logger.error(`[AdminController] 获取任务列表失败: ${err.message}`, err);
      next(err);
    }
  }

  /**
   * 获取任务统计信息
   */
  async getTaskStats(): Promise<{
    totalTasks: number;
    successTasks: number;
    failedTasks: number;
    processingTasks: number;
    successRate: string;
  }> {
    const totalTasksCount = await fetchCount(db('tasks'));
    const successTasksCount = await fetchCount(db('tasks').where('status', 'success'));
    const failedTasksCount = await fetchCount(db('tasks').where('status', 'failed'));
    const processingTasksCount = await fetchCount(
      db('tasks').whereIn('status', ['pending', 'processing'])
    );

    return {
      totalTasks: totalTasksCount,
      successTasks: successTasksCount,
      failedTasks: failedTasksCount,
      processingTasks: processingTasksCount,
      successRate:
        totalTasksCount > 0 ? ((successTasksCount / totalTasksCount) * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * 获取失败任务列表
   * GET /api/admin/failed-tasks?limit=20&offset=0
   */
  async getFailedTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 20, offset = 0 } = req.query;

      const limitValue = toSafeInteger(limit);
      const offsetValue = toSafeInteger(offset);

      const baseQuery = db('tasks')
        .select('tasks.*', 'users.phone as userPhone')
        .leftJoin('users', 'tasks.userId', 'users.id')
        .where('tasks.status', 'failed')
        .orderBy('tasks.updated_at', 'desc');

      const tasks = await baseQuery.clone().limit(limitValue).offset(offsetValue);
      const total = await fetchCount(baseQuery.clone());

      res.json({
        success: true,
        data: {
          tasks,
          total,
          limit: limitValue,
          offset: offsetValue
        }
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 获取失败任务列表失败');
    }
  }

  /**
   * 获取系统概览统计
   * GET /api/admin/overview
   */
  async getOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userStats = await this.getUserStats();
      const taskStats = await this.getTaskStats();

      // 获取订单统计
      const totalOrders = await fetchCount(db('orders'));
      const paidOrders = await fetchCount(db('orders').where('status', 'paid'));

      // 计算总收入(简化,实际应从orders表的amount字段累加)
      const revenue = paidOrders * 99;

      // 今日新增用户
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayUsers = await fetchCount(db('users').where('created_at', '>=', todayStart));

      // 今日新增任务
      const todayTasks = await fetchCount(db('tasks').where('created_at', '>=', todayStart));

      res.json({
        success: true,
        data: {
          userStats,
          taskStats,
          orderStats: {
            totalOrders,
            paidOrders,
            revenue
          },
          todayStats: {
            newUsers: todayUsers,
            newTasks: todayTasks
          }
        }
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 获取系统概览失败');
    }
  }

  /**
   * 获取所有功能卡片（包括禁用的,但不包括软删除的）
   * GET /api/admin/features
   */
  async getFeatures(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const features = await db('feature_definitions')
        .whereNull('deleted_at')
        .select('*')
        .orderBy('created_at', 'desc');

      // 反序列化 allowed_accounts 为数组
      features.forEach((f) => {
        if (f.allowed_accounts) {
          try {
            f.allowed_accounts = JSON.parse(f.allowed_accounts);
          } catch (e) {
            f.allowed_accounts = [];
          }
        }
      });

      res.json({
        success: true,
        features
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 获取功能列表失败');
    }
  }

  /**
   * 创建新功能卡片
   * POST /api/admin/features
   */
  async createFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { feature_definition, form_schema, pipeline_schema } = req.body;

      if (!feature_definition || !form_schema || !pipeline_schema) {
        res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '缺少必要参数：feature_definition, form_schema, pipeline_schema'
          }
        });
        return;
      }

      // 规范化 allowed_accounts 字段
      let allowedAccounts = feature_definition.allowed_accounts;
      if (allowedAccounts) {
        if (typeof allowedAccounts === 'string') {
          // 多行文本转数组
          const accountArray = allowedAccounts
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .filter((value, index, self) => self.indexOf(value) === index); // 去重
          allowedAccounts = JSON.stringify(accountArray);
        } else if (Array.isArray(allowedAccounts)) {
          allowedAccounts = JSON.stringify(allowedAccounts);
        }
      }

      // 在事务中插入
      await db.transaction(async (trx) => {
        // 插入 form_schema
        await trx('form_schemas').insert({
          schema_id: form_schema.schema_id,
          fields: JSON.stringify(form_schema.fields),
          created_at: new Date(),
          updated_at: new Date()
        });

        // 插入 pipeline_schema
        await trx('pipeline_schemas').insert({
          pipeline_id: pipeline_schema.pipeline_id,
          steps: JSON.stringify(pipeline_schema.steps),
          created_at: new Date(),
          updated_at: new Date()
        });

        // 插入 feature_definition
        await trx('feature_definitions').insert({
          ...feature_definition,
          allowed_accounts: allowedAccounts,
          form_schema_ref: form_schema.schema_id,
          pipeline_schema_ref: pipeline_schema.pipeline_id,
          created_at: new Date(),
          updated_at: new Date()
        });
      });

      logger.info(`[AdminController] 功能创建成功 featureId=${feature_definition.feature_id}`);

      res.json({
        success: true,
        message: '功能创建成功',
        feature_id: feature_definition.feature_id
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 创建功能失败');
    }
  }

  /**
   * 更新功能卡片
   * PUT /api/admin/features/:featureId
   */
  async updateFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { featureId } = req.params;
      const { feature_definition, form_schema, pipeline_schema } = req.body;

      // 检查功能是否存在
      const existing = await db('feature_definitions')
        .where('feature_id', featureId)
        .whereNull('deleted_at')
        .first();

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 4004, message: '功能不存在' }
        });
        return;
      }

      // 规范化 allowed_accounts 字段
      let allowedAccounts = feature_definition?.allowed_accounts;
      if (allowedAccounts) {
        if (typeof allowedAccounts === 'string') {
          const accountArray = allowedAccounts
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .filter((value, index, self) => self.indexOf(value) === index);
          allowedAccounts = JSON.stringify(accountArray);
        } else if (Array.isArray(allowedAccounts)) {
          allowedAccounts = JSON.stringify(allowedAccounts);
        }
      }

      // 在事务中更新
      await db.transaction(async (trx) => {
        // 更新 form_schema（如果提供）
        if (form_schema) {
          await trx('form_schemas')
            .where('schema_id', existing.form_schema_ref)
            .update({
              fields: JSON.stringify(form_schema.fields),
              updated_at: new Date()
            });
        }

        // 更新 pipeline_schema（如果提供）
        if (pipeline_schema) {
          await trx('pipeline_schemas')
            .where('pipeline_id', existing.pipeline_schema_ref)
            .update({
              steps: JSON.stringify(pipeline_schema.steps),
              updated_at: new Date()
            });
        }

        // 更新 feature_definition（如果提供）
        if (feature_definition) {
          await trx('feature_definitions')
            .where('feature_id', featureId)
            .update({
              ...feature_definition,
              allowed_accounts: allowedAccounts,
              updated_at: new Date()
            });
        }
      });

      logger.info(`[AdminController] 功能更新成功 featureId=${featureId}`);

      res.json({
        success: true,
        message: '功能更新成功'
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 更新功能失败');
    }
  }

  /**
   * 快速切换功能启用状态
   * PATCH /api/admin/features/:featureId
   */
  async toggleFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { featureId } = req.params;
      const { is_enabled } = req.body;

      if (typeof is_enabled !== 'boolean') {
        res.status(400).json({
          success: false,
          error: { code: 4001, message: 'is_enabled 必须为布尔值' }
        });
        return;
      }

      // 检查功能
      const feature = await db('feature_definitions')
        .where('feature_id', featureId)
        .whereNull('deleted_at')
        .first();

      if (!feature) {
        res.status(404).json({
          success: false,
          error: { code: 4004, message: '功能不存在' }
        });
        return;
      }

      // 风险提示：配额为0的功能不建议上线
      if (is_enabled && feature.quota_cost === 0) {
        res.status(400).json({
          success: false,
          error: { code: 4001, message: '配额为0的功能不建议上线' },
          warning: '该功能不扣费,可能导致滥用和成本失控'
        });
        return;
      }

      // 更新状态
      await db('feature_definitions').where('feature_id', featureId).update({
        is_enabled,
        updated_at: new Date()
      });

      logger.info(
        `[AdminController] 功能状态切换成功 featureId=${featureId} is_enabled=${is_enabled}`
      );

      res.json({
        success: true,
        message: `功能已${is_enabled ? '启用' : '禁用'}`
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 切换功能状态失败');
    }
  }

  /**
   * 软删除功能卡片
   * DELETE /api/admin/features/:featureId
   */
  async deleteFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { featureId } = req.params;

      // 检查功能是否存在
      const feature = await db('feature_definitions')
        .where('feature_id', featureId)
        .whereNull('deleted_at')
        .first();

      if (!feature) {
        res.status(404).json({
          success: false,
          error: { code: 4004, message: '功能不存在' }
        });
        return;
      }

      // 软删除（设置 deleted_at）
      await db('feature_definitions').where('feature_id', featureId).update({
        deleted_at: new Date(),
        updated_at: new Date()
      });

      logger.info(`[AdminController] 功能软删除成功 featureId=${featureId}`);

      res.json({
        success: true,
        message: '功能已删除'
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 删除功能失败');
    }
  }

  // ============ 分销代理管理接口 ============

  /**
   * 获取分销员列表
   * GET /api/admin/distributors
   */
  async getDistributors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, keyword, limit = 20, offset = 0 } = req.query;

      let query = db('distributors as d')
        .join('users as u', 'd.user_id', 'u.id')
        .select('d.*', 'u.phone')
        .orderBy('d.created_at', 'desc');

      // 状态筛选
      if (status) {
        query = query.where('d.status', status);
      }

      // 关键词搜索
      if (keyword) {
        query = query.where(function () {
          this.where('d.real_name', 'like', `%${keyword}%`)
            .orWhere('u.phone', 'like', `%${keyword}%`)
            .orWhere('d.invite_code', 'like', `%${keyword}%`);
        });
      }

      // 获取总数
      const countQuery = query.clone();
      const total = await fetchCount(countQuery);

      // 分页查询
      const distributors = await query.limit(toSafeInteger(limit)).offset(toSafeInteger(offset));

      // 查询每个分销员的推荐人数
      const isSuperAdmin = isSuperAdminUser(req);
      for (const dist of distributors) {
        const referralTotal = await fetchCount(
          db('referral_relationships').where('referrer_distributor_id', dist.id)
        );
        dist.totalReferrals = referralTotal;

        // 🔥 身份证号脱敏（法律合规）
        if (isSuperAdmin) {
          // super_admin: 解密后显示完整身份证
          dist.id_card = encryptionUtils.decryptIdCard(dist.id_card);
        } else {
          // 普通admin: 解密后脱敏显示
          dist.id_card = encryptionUtils.decryptAndMaskIdCard(dist.id_card);
        }
      }

      res.json({
        success: true,
        data: {
          distributors,
          total
        }
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 获取分销员列表失败');
    }
  }

  /**
   * 获取分销员详细信息（管理端）
   * GET /api/admin/distributors/:id
   */
  async getDistributorDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const distributor = await db('distributors').where({ id }).first();

      if (!distributor) {
        res.status(404).json({
          success: false,
          error: { code: 6007, message: '分销员不存在' }
        });
        return;
      }

      // 查询用户信息
      const user = await db('users')
        .where({ id: distributor.user_id })
        .select('id', 'phone', 'created_at')
        .first();

      // 查询推荐用户总数
      const totalReferralsRows = (await db('referral_relationships')
        .where({ referrer_distributor_id: distributor.id })
        .count('* as count')) as Array<{ count: CountValue }>;
      const totalReferralsCount = normalizeCount(totalReferralsRows[0]?.count);

      // 查询已付费推荐用户数
      const paidReferralsRows = (await db('referral_relationships as rr')
        .join('orders as o', 'rr.referred_user_id', 'o.userId')
        .where({ 'rr.referrer_distributor_id': distributor.id, 'o.status': 'paid' })
        .countDistinct('rr.referred_user_id as count')) as Array<{ count: CountValue }>;
      const paidReferralsCount = normalizeCount(paidReferralsRows[0]?.count);

      // 查询冻结佣金
      const [{ total: frozenCommission }] = await db('commissions')
        .where({ distributor_id: distributor.id, status: 'frozen' })
        .sum('commission_amount as total');

      // 查询待审核提现
      const [{ total: pendingWithdrawal }] = await db('withdrawals')
        .where({ distributor_id: distributor.id, status: 'pending' })
        .sum('amount as total');

      // 查询历史提现记录数
      const withdrawalCount = await fetchCount(
        db('withdrawals').where({ distributor_id: distributor.id })
      );

      const baseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
      const inviteLink = `${baseUrl}/register?ref=${distributor.user_id}`;

      // 🔥 身份证号权限控制（法律合规）
      // 只有super_admin能查看完整身份证，普通admin只能看脱敏版本
      const isSuperAdmin = isSuperAdminUser(req);
      let idCard;
      if (isSuperAdmin) {
        // super_admin: 解密后显示完整身份证
        idCard = encryptionUtils.decryptIdCard(distributor.id_card);
      } else {
        // 普通admin: 解密后脱敏显示
        idCard = encryptionUtils.decryptAndMaskIdCard(distributor.id_card);
      }

      res.json({
        success: true,
        data: {
          // 基本信息
          id: distributor.id,
          userId: distributor.user_id,
          phone: user.phone,
          realName: distributor.real_name,
          idCard: idCard, // 🔥 根据权限返回完整或脱敏的身份证号
          contact: distributor.contact,
          channel: distributor.channel,
          status: distributor.status,
          inviteCode: distributor.invite_code,
          inviteLink: inviteLink,

          // 申请与审核信息
          appliedAt: distributor.created_at,
          approvalTime: distributor.approval_time,
          updatedAt: distributor.updated_at,

          // 推广数据
          totalReferrals: totalReferralsCount,
          paidReferrals: paidReferralsCount,

          // 佣金数据
          totalCommission: parseFloat(distributor.total_commission) || 0,
          availableCommission: parseFloat(distributor.available_commission) || 0,
          frozenCommission: parseFloat(frozenCommission) || 0,
          withdrawnCommission: parseFloat(distributor.withdrawn_commission) || 0,
          pendingWithdrawal: parseFloat(pendingWithdrawal) || 0,

          // 提现记录数
          withdrawalCount
        }
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 获取分销员详情失败');
    }
  }

  /**
   * 获取分销员推广用户列表（管理端）
   * GET /api/admin/distributors/:id/referrals
   */
  async getDistributorReferrals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status = 'all', limit = 20, offset = 0 } = req.query;
      const limitValue = toSafeInteger(limit, 20);
      const offsetValue = toSafeInteger(offset, 0);
      const statusValue = toStringValue(status);

      // 检查分销员是否存在
      const distributor = await db('distributors').where({ id }).first();

      if (!distributor) {
        res.status(404).json({
          success: false,
          error: { code: 6007, message: '分销员不存在' }
        });
        return;
      }

      // 构建查询
      let query = db('referral_relationships as rr')
        .join('users as u', 'rr.referred_user_id', 'u.id')
        .leftJoin('orders as o', function () {
          this.on('u.id', 'o.userId').andOn('o.status', db.raw('?', ['paid']));
        })
        .leftJoin('commissions as c', function () {
          this.on('rr.referred_user_id', 'c.referred_user_id').andOn(
            'c.distributor_id',
            db.raw('?', [distributor.id])
          );
        })
        .where('rr.referrer_distributor_id', distributor.id)
        .select(
          'u.id as userId',
          'u.phone',
          'rr.created_at as registeredAt',
          db.raw('IF(o.id IS NOT NULL, true, false) as hasPaid'),
          db.raw('MAX(o.paidAt) as paidAt'),
          db.raw('SUM(c.commission_amount) as commissionAmount')
        )
        .groupBy('u.id', 'u.phone', 'rr.created_at');

      // 状态过滤
      if (statusValue === 'paid') {
        query = query.havingRaw('hasPaid = true');
      } else if (statusValue === 'unpaid') {
        query = query.havingRaw('hasPaid = false');
      }

      // 获取总数
      const countQuery = query.clone();
      const total = await fetchCount(countQuery);

      // 分页查询
      const referrals = await query
        .orderBy('rr.created_at', 'desc')
        .limit(limitValue)
        .offset(offsetValue);

      // 格式化结果（管理端不脱敏手机号）
      const formattedReferrals = referrals.map((r) => ({
        userId: r.userId,
        phone: r.phone, // 管理端显示完整手机号
        registeredAt: r.registeredAt,
        hasPaid: r.hasPaid,
        paidAt: r.paidAt,
        commissionAmount: parseFloat(r.commissionAmount) || 0
      }));

      res.json({
        success: true,
        data: {
          referrals: formattedReferrals,
          total
        }
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 获取分销员推广用户列表失败');
    }
  }

  /**
   * 获取分销员佣金记录（管理端）
   * GET /api/admin/distributors/:id/commissions
   */
  async getDistributorCommissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status = 'all', limit = 20, offset = 0 } = req.query;
      const limitValue = toSafeInteger(limit, 20);
      const offsetValue = toSafeInteger(offset, 0);
      const statusValue = toStringValue(status);

      // 检查分销员是否存在
      const distributor = await db('distributors').where({ id }).first();

      if (!distributor) {
        res.status(404).json({
          success: false,
          error: { code: 6007, message: '分销员不存在' }
        });
        return;
      }

      // 构建查询
      let query = db('commissions as c')
        .join('users as u', 'c.referred_user_id', 'u.id')
        .where('c.distributor_id', distributor.id)
        .select(
          'c.id',
          'c.order_id as orderId',
          'u.id as userId',
          'u.phone',
          'c.order_amount as orderAmount',
          'c.commission_amount as commissionAmount',
          'c.commission_rate as commissionRate',
          'c.status',
          'c.freeze_until as freezeUntil',
          'c.created_at as createdAt',
          'c.settled_at as settledAt'
        );

      // 状态过滤
      if (statusValue && statusValue !== 'all') {
        query = query.where('c.status', statusValue);
      }

      // 获取总数
      const total = await fetchCount(query.clone());

      // 分页查询
      const commissions = await query
        .orderBy('c.created_at', 'desc')
        .limit(limitValue)
        .offset(offsetValue);

      // 格式化结果（管理端不脱敏手机号）
      const formattedCommissions = commissions.map((c) => ({
        id: c.id,
        orderId: c.orderId,
        userId: c.userId,
        referredUserPhone: c.phone, // 管理端显示完整手机号
        orderAmount: parseFloat(c.orderAmount),
        commissionAmount: parseFloat(c.commissionAmount),
        commissionRate: parseFloat(c.commissionRate),
        status: c.status,
        freezeUntil: c.freezeUntil,
        createdAt: c.createdAt,
        settledAt: c.settledAt
      }));

      res.json({
        success: true,
        data: {
          commissions: formattedCommissions,
          total
        }
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 获取分销员佣金记录失败');
    }
  }

  /**
   * 审核分销员申请
   * PATCH /api/admin/distributors/:id/approve
   */
  async approveDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const distributor = await db('distributors').where({ id }).first();

      if (!distributor) {
        res.status(404).json({
          success: false,
          error: { code: 6011, message: '分销员不存在' }
        });
        return;
      }

      if (distributor.status !== 'pending') {
        res.status(400).json({
          success: false,
          error: { code: 6012, message: '该申请已处理' }
        });
        return;
      }

      await db('distributors').where({ id }).update({
        status: 'active',
        approval_time: new Date(),
        updated_at: new Date()
      });

      logger.info(`[AdminController] 分销员审核通过: id=${id}`);

      res.json({
        success: true,
        message: '审核通过'
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 审核分销员失败');
    }
  }

  /**
   * 禁用分销员
   * PATCH /api/admin/distributors/:id/disable
   */
  async disableDistributor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const distributor = await db('distributors').where({ id }).first();

      if (!distributor) {
        res.status(404).json({
          success: false,
          error: { code: 6011, message: '分销员不存在' }
        });
        return;
      }

      await db('distributors').where({ id }).update({
        status: 'disabled',
        updated_at: new Date()
      });

      logger.info(`[AdminController] 分销员已禁用: id=${id}`);

      res.json({
        success: true,
        message: '分销员已禁用'
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 禁用分销员失败');
    }
  }

  /**
   * 获取提现申请列表
   * GET /api/admin/withdrawals
   */
  async getWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, limit = 20, offset = 0 } = req.query;
      const limitValue = toSafeInteger(limit, 20);
      const offsetValue = toSafeInteger(offset, 0);
      const statusValue = toStringValue(status);

      let query = db('withdrawals as w')
        .join('distributors as d', 'w.distributor_id', 'd.id')
        .join('users as u', 'd.user_id', 'u.id')
        .select('w.*', 'd.real_name', 'u.phone')
        .orderBy('w.created_at', 'desc');

      // 状态筛选
      if (statusValue) {
        query = query.where('w.status', statusValue);
      }

      // 获取总数
      const countQuery = query.clone();
      const total = await fetchCount(countQuery);

      // 分页查询
      const withdrawals = await query.limit(limitValue).offset(offsetValue);

      // 解析 account_info
      withdrawals.forEach((w) => {
        w.account_info = JSON.parse(w.account_info);
      });

      res.json({
        success: true,
        data: {
          withdrawals,
          total
        }
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 获取提现列表失败');
    }
  }

  /**
   * 审核通过提现
   * PATCH /api/admin/withdrawals/:id/approve
   */
  async approveWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      await db.transaction(async (trx) => {
        // 使用行锁查询提现记录（防止并发重复审核）
        const withdrawal = await trx('withdrawals').where({ id }).forUpdate().first();

        if (!withdrawal) {
          throw {
            statusCode: 404,
            errorCode: 6013,
            message: '提现记录不存在'
          };
        }

        if (withdrawal.status !== 'pending') {
          throw {
            statusCode: 400,
            errorCode: 6014,
            message: '该提现申请已处理'
          };
        }

        // 更新提现状态
        await trx('withdrawals').where({ id }).update({
          status: 'approved',
          approved_at: new Date()
        });

        // 更新分销员已提现金额
        await trx('distributors')
          .where({ id: withdrawal.distributor_id })
          .increment('withdrawn_commission', withdrawal.amount);
      });

      logger.info(`[AdminController] 提现审核通过: id=${id}`);

      res.json({
        success: true,
        message: '审核通过，请尽快打款'
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 审核提现失败');
    }
  }

  /**
   * 拒绝提现
   * PATCH /api/admin/withdrawals/:id/reject
   */
  async rejectWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { rejectReason } = req.body;

      if (!rejectReason) {
        res.status(400).json({
          success: false,
          error: { code: 6015, message: '请填写拒绝原因' }
        });
        return;
      }

      await db.transaction(async (trx) => {
        // 使用行锁查询提现记录（防止并发重复退款）
        const withdrawal = await trx('withdrawals').where({ id }).forUpdate().first();

        if (!withdrawal) {
          throw {
            statusCode: 404,
            errorCode: 6013,
            message: '提现记录不存在'
          };
        }

        if (withdrawal.status !== 'pending') {
          throw {
            statusCode: 400,
            errorCode: 6014,
            message: '该提现申请已处理'
          };
        }

        // 更新提现状态为已拒绝
        await trx('withdrawals').where({ id }).update({
          status: 'rejected',
          reject_reason: rejectReason,
          approved_at: new Date()
        });

        // 退还可提现余额
        await trx('distributors')
          .where({ id: withdrawal.distributor_id })
          .increment('available_commission', withdrawal.amount);
      });

      logger.info(`[AdminController] 提现已拒绝: id=${id}`);

      res.json({
        success: true,
        message: '已拒绝提现申请'
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 拒绝提现失败');
    }
  }

  /**
   * 分销数据统计
   * GET /api/admin/distribution/stats
   */
  async getDistributionStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 分销员统计
      const totalDistributors = await fetchCount(db('distributors'));
      const activeDistributors = await fetchCount(db('distributors').where('status', 'active'));

      // 推荐用户统计
      const totalReferrals = await fetchCount(db('referral_relationships'));
      const paidReferralsRows = (await db('referral_relationships as rr')
        .join('orders as o', 'rr.referred_user_id', 'o.userId')
        .where('o.status', 'paid')
        .countDistinct('rr.referred_user_id as count')) as Array<{ count: CountValue }>;
      const paidReferrals = normalizeCount(paidReferralsRows[0]?.count);

      // 佣金统计
      const commissionStats =
        (await db('commissions')
          .sum('commission_amount as totalCommissionPaid')
          .first<{ totalCommissionPaid?: string | number | null }>()) ?? {};

      // 待审核提现统计
      const pendingStats = await db('withdrawals')
        .where('status', 'pending')
        .select(db.raw('COUNT(*) as count'), db.raw('SUM(amount) as amount'))
        .first<{ count?: CountValue; amount?: string | number | null }>();
      const pendingWithdrawalsCount = pendingStats ? normalizeCount(pendingStats.count) : 0;
      const pendingWithdrawalAmount = pendingStats?.amount ? Number(pendingStats.amount) : 0;

      res.json({
        success: true,
        data: {
          totalDistributors,
          activeDistributors,
          totalReferrals,
          paidReferrals,
          totalCommissionPaid: Number(commissionStats.totalCommissionPaid ?? 0),
          pendingWithdrawals: pendingWithdrawalsCount,
          pendingWithdrawalAmount
        }
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 获取分销统计失败');
    }
  }

  /**
   * 获取佣金设置
   * GET /api/admin/distribution/settings
   */
  async getDistributionSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await db('distribution_settings').where({ id: 1 }).first();

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 获取佣金设置失败');
    }
  }

  /**
   * 更新佣金设置
   * PUT /api/admin/distribution/settings
   */
  async updateDistributionSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commission_rate, freeze_days, min_withdrawal_amount, auto_approve } = req.body;

      const updateData: DistributionSettingsUpdate = {};
      if (commission_rate !== undefined) updateData.commission_rate = commission_rate;
      if (freeze_days !== undefined) updateData.freeze_days = freeze_days;
      if (min_withdrawal_amount !== undefined)
        updateData.min_withdrawal_amount = min_withdrawal_amount;
      if (auto_approve !== undefined) updateData.auto_approve = auto_approve;

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 6016, message: '没有需要更新的字段' }
        });
        return;
      }

      updateData.updated_at = new Date();

      await db('distribution_settings').where({ id: 1 }).update(updateData);

      logger.info(`[AdminController] 佣金设置已更新:`, updateData);

      res.json({
        success: true,
        message: '设置已更新'
      });
    } catch (error) {
      logAndNext(next, error, '[AdminController] 更新佣金设置失败');
    }
  }
}

const adminController = new AdminController();
export default adminController;
