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
}

module.exports = new AdminController();
