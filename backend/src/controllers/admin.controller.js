const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * 管理后台控制器 - 处理管理相关请求
 */
class AdminController {
  /**
   * 获取用户列表
   * GET /api/admin/users?limit=10&offset=0&isMember=true
   */
  async getUsers(req, res, next) {
    try {
      const { limit = 20, offset = 0, isMember } = req.query;

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
      if (isMember !== undefined) {
        query = query.where('isMember', isMember === 'true');
      }

      const users = await query.limit(parseInt(limit)).offset(parseInt(offset));

      // 获取总数
      let countQuery = db('users');
      if (isMember !== undefined) {
        countQuery = countQuery.where('isMember', isMember === 'true');
      }
      const [{ count }] = await countQuery.count('* as count');

      // 获取统计信息
      const stats = await this.getUserStats();

      res.json({
        success: true,
        data: {
          users,
          total: parseInt(count),
          limit: parseInt(limit),
          offset: parseInt(offset),
          stats
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取用户列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats() {
    const [totalUsers] = await db('users').count('* as count');
    const [memberUsers] = await db('users').where('isMember', true).count('* as count');
    const [activeMembers] = await db('users')
      .where('isMember', true)
      .where('quota_expireAt', '>', new Date())
      .count('* as count');

    return {
      totalUsers: parseInt(totalUsers.count),
      memberUsers: parseInt(memberUsers.count),
      activeMembers: parseInt(activeMembers.count),
      memberRate: totalUsers.count > 0
        ? ((memberUsers.count / totalUsers.count) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * 获取任务列表
   * GET /api/admin/tasks?limit=20&offset=0&status=success&type=basic_clean
   */
  async getTasks(req, res, next) {
    try {
      const { limit = 20, offset = 0, status, type, userId } = req.query;

      let query = db('tasks')
        .select(
          'tasks.*',
          'users.phone as userPhone'
        )
        .leftJoin('users', 'tasks.userId', 'users.id')
        .orderBy('tasks.created_at', 'desc');

      // 筛选条件
      if (status) {
        query = query.where('tasks.status', status);
      }
      if (type) {
        query = query.where('tasks.type', type);
      }
      if (userId) {
        query = query.where('tasks.userId', userId);
      }

      const tasks = await query.limit(parseInt(limit)).offset(parseInt(offset));

      // 获取总数
      let countQuery = db('tasks');
      if (status) countQuery = countQuery.where('status', status);
      if (type) countQuery = countQuery.where('type', type);
      if (userId) countQuery = countQuery.where('userId', userId);
      const [{ count }] = await countQuery.count('* as count');

      // 获取任务统计
      const stats = await this.getTaskStats();

      res.json({
        success: true,
        data: {
          tasks,
          total: parseInt(count),
          limit: parseInt(limit),
          offset: parseInt(offset),
          stats
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取任务列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取任务统计信息
   */
  async getTaskStats() {
    const [totalTasks] = await db('tasks').count('* as count');
    const [successTasks] = await db('tasks').where('status', 'success').count('* as count');
    const [failedTasks] = await db('tasks').where('status', 'failed').count('* as count');
    const [processingTasks] = await db('tasks')
      .whereIn('status', ['pending', 'processing'])
      .count('* as count');

    return {
      totalTasks: parseInt(totalTasks.count),
      successTasks: parseInt(successTasks.count),
      failedTasks: parseInt(failedTasks.count),
      processingTasks: parseInt(processingTasks.count),
      successRate: totalTasks.count > 0
        ? ((successTasks.count / totalTasks.count) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * 获取失败任务列表
   * GET /api/admin/failed-tasks?limit=20&offset=0
   */
  async getFailedTasks(req, res, next) {
    try {
      const { limit = 20, offset = 0 } = req.query;

      const tasks = await db('tasks')
        .select(
          'tasks.*',
          'users.phone as userPhone'
        )
        .leftJoin('users', 'tasks.userId', 'users.id')
        .where('tasks.status', 'failed')
        .orderBy('tasks.updated_at', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      const [{ count }] = await db('tasks')
        .where('status', 'failed')
        .count('* as count');

      res.json({
        success: true,
        data: {
          tasks,
          total: parseInt(count),
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取失败任务列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取系统概览统计
   * GET /api/admin/overview
   */
  async getOverview(req, res, next) {
    try {
      const userStats = await this.getUserStats();
      const taskStats = await this.getTaskStats();

      // 获取订单统计
      const [totalOrders] = await db('orders').count('* as count');
      const [paidOrders] = await db('orders').where('status', 'paid').count('* as count');
      
      // 计算总收入(简化,实际应从orders表的amount字段累加)
      const revenue = parseInt(paidOrders.count) * 99;

      // 今日新增用户
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [todayUsers] = await db('users')
        .where('created_at', '>=', todayStart)
        .count('* as count');

      // 今日新增任务
      const [todayTasks] = await db('tasks')
        .where('created_at', '>=', todayStart)
        .count('* as count');

      res.json({
        success: true,
        data: {
          userStats,
          taskStats,
          orderStats: {
            totalOrders: parseInt(totalOrders.count),
            paidOrders: parseInt(paidOrders.count),
            revenue
          },
          todayStats: {
            newUsers: parseInt(todayUsers.count),
            newTasks: parseInt(todayTasks.count)
          }
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取系统概览失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取所有功能卡片（包括禁用的,但不包括软删除的）
   * GET /api/admin/features
   */
  async getFeatures(req, res, next) {
    try {
      const features = await db('feature_definitions')
        .whereNull('deleted_at')
        .select('*')
        .orderBy('created_at', 'desc');

      // 反序列化 allowed_accounts 为数组
      features.forEach(f => {
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
      logger.error(`[AdminController] 获取功能列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 创建新功能卡片
   * POST /api/admin/features
   */
  async createFeature(req, res, next) {
    try {
      const { feature_definition, form_schema, pipeline_schema } = req.body;

      if (!feature_definition || !form_schema || !pipeline_schema) {
        return res.status(400).json({
          success: false,
          error: { code: 4001, message: '缺少必要参数：feature_definition, form_schema, pipeline_schema' }
        });
      }

      // 规范化 allowed_accounts 字段
      let allowedAccounts = feature_definition.allowed_accounts;
      if (allowedAccounts) {
        if (typeof allowedAccounts === 'string') {
          // 多行文本转数组
          const accountArray = allowedAccounts
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
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
      logger.error(`[AdminController] 创建功能失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 更新功能卡片
   * PUT /api/admin/features/:featureId
   */
  async updateFeature(req, res, next) {
    try {
      const { featureId } = req.params;
      const { feature_definition, form_schema, pipeline_schema } = req.body;

      // 检查功能是否存在
      const existing = await db('feature_definitions')
        .where('feature_id', featureId)
        .whereNull('deleted_at')
        .first();

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { code: 4004, message: '功能不存在' }
        });
      }

      // 规范化 allowed_accounts 字段
      let allowedAccounts = feature_definition?.allowed_accounts;
      if (allowedAccounts) {
        if (typeof allowedAccounts === 'string') {
          const accountArray = allowedAccounts
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
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
      logger.error(`[AdminController] 更新功能失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 快速切换功能启用状态
   * PATCH /api/admin/features/:featureId
   */
  async toggleFeature(req, res, next) {
    try {
      const { featureId } = req.params;
      const { is_enabled } = req.body;

      if (typeof is_enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: { code: 4001, message: 'is_enabled 必须为布尔值' }
        });
      }

      // 检查功能
      const feature = await db('feature_definitions')
        .where('feature_id', featureId)
        .whereNull('deleted_at')
        .first();

      if (!feature) {
        return res.status(404).json({
          success: false,
          error: { code: 4004, message: '功能不存在' }
        });
      }

      // 风险提示：配额为0的功能不建议上线
      if (is_enabled && feature.quota_cost === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 4001, message: '配额为0的功能不建议上线' },
          warning: '该功能不扣费,可能导致滥用和成本失控'
        });
      }

      // 更新状态
      await db('feature_definitions')
        .where('feature_id', featureId)
        .update({
          is_enabled,
          updated_at: new Date()
        });

      logger.info(`[AdminController] 功能状态切换成功 featureId=${featureId} is_enabled=${is_enabled}`);

      res.json({
        success: true,
        message: `功能已${is_enabled ? '启用' : '禁用'}`
      });

    } catch (error) {
      logger.error(`[AdminController] 切换功能状态失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 软删除功能卡片
   * DELETE /api/admin/features/:featureId
   */
  async deleteFeature(req, res, next) {
    try {
      const { featureId } = req.params;

      // 检查功能是否存在
      const feature = await db('feature_definitions')
        .where('feature_id', featureId)
        .whereNull('deleted_at')
        .first();

      if (!feature) {
        return res.status(404).json({
          success: false,
          error: { code: 4004, message: '功能不存在' }
        });
      }

      // 软删除（设置 deleted_at）
      await db('feature_definitions')
        .where('feature_id', featureId)
        .update({
          deleted_at: new Date(),
          updated_at: new Date()
        });

      logger.info(`[AdminController] 功能软删除成功 featureId=${featureId}`);

      res.json({
        success: true,
        message: '功能已删除'
      });

    } catch (error) {
      logger.error(`[AdminController] 删除功能失败: ${error.message}`, error);
      next(error);
    }
  }
}

module.exports = new AdminController();
