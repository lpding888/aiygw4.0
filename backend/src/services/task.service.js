const db = require('../config/database');
const { nanoid } = require('nanoid');
const quotaService = require('./quota.service');
const logger = require('../utils/logger');

/**
 * 任务服务 - 处理AI处理任务的创建、查询和状态管理
 */
class TaskService {
  /**
   * 创建任务
   * @param {string} userId - 用户ID
   * @param {string} type - 任务类型: basic_clean | model_pose12
   * @param {string} inputImageUrl - 输入图片URL
   * @param {Object} params - 任务参数
   */
  async create(userId, type, inputImageUrl, params = {}) {
    try {
      // 1. 验证任务类型
      const validTypes = ['basic_clean', 'model_pose12'];
      if (!validTypes.includes(type)) {
        throw { errorCode: 4001, message: '无效的任务类型' };
      }

      // 2. 检查用户会员状态
      const user = await db('users').where('id', userId).first();
      if (!user) {
        throw { errorCode: 4004, message: '用户不存在' };
      }
      if (!user.isMember) {
        throw { errorCode: 4003, message: '请先开通会员' };
      }

      // 3. 扣减配额(使用事务,确保原子性)
      await quotaService.deduct(userId, 1);

      // 4. 创建任务记录
      const taskId = nanoid();
      const now = new Date();

      await db('tasks').insert({
        id: taskId,
        userId,
        type,
        status: 'pending', // pending -> processing -> success/failed
        inputImageUrl,
        params: JSON.stringify(params),
        created_at: now,
        updated_at: now
      });

      logger.info(`[TaskService] 任务创建成功 taskId=${taskId} userId=${userId} type=${type}`);

      return {
        taskId,
        type,
        status: 'pending',
        createdAt: now.toISOString()
      };

    } catch (error) {
      logger.error(`[TaskService] 创建任务失败: ${error.message}`, { userId, type, error });
      throw error;
    }
  }

  /**
   * 获取任务详情
   * @param {string} taskId - 任务ID
   * @param {string} userId - 用户ID(权限验证)
   */
  async get(taskId, userId) {
    try {
      const task = await db('tasks')
        .where('id', taskId)
        .first();

      if (!task) {
        throw { errorCode: 4004, message: '任务不存在' };
      }

      // 权限检查:只能查看自己的任务
      if (task.userId !== userId) {
        throw { errorCode: 4003, message: '无权访问该任务' };
      }

      // 解析params和resultUrls
      const params = task.params ? JSON.parse(task.params) : {};
      const resultUrls = task.resultUrls ? JSON.parse(task.resultUrls) : [];

      return {
        id: task.id,
        type: task.type,
        status: task.status,
        inputImageUrl: task.inputImageUrl,
        params,
        resultUrls,
        errorMessage: task.errorMessage,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        completedAt: task.completed_at
      };

    } catch (error) {
      logger.error(`[TaskService] 获取任务失败: ${error.message}`, { taskId, userId, error });
      throw error;
    }
  }

  /**
   * 更新任务状态
   * @param {string} taskId - 任务ID
   * @param {string} status - 新状态
   * @param {Object} data - 额外数据(resultUrls, errorMessage等)
   */
  async updateStatus(taskId, status, data = {}) {
    try {
      const updateData = {
        status,
        updated_at: new Date()
      };

      // 如果是完成或失败状态,记录完成时间
      if (status === 'success' || status === 'failed') {
        updateData.completed_at = new Date();
      }

      // 如果有结果URLs
      if (data.resultUrls) {
        updateData.resultUrls = JSON.stringify(data.resultUrls);
      }

      // 如果有错误信息
      if (data.errorMessage) {
        updateData.errorMessage = data.errorMessage;
      }

      await db('tasks')
        .where('id', taskId)
        .update(updateData);

      logger.info(`[TaskService] 任务状态更新 taskId=${taskId} status=${status}`);

      // 如果任务失败,返还配额
      if (status === 'failed') {
        const task = await db('tasks').where('id', taskId).first();
        if (task) {
          await quotaService.refund(task.userId, 1, `任务失败返还:${taskId}`);
          logger.info(`[TaskService] 任务失败,配额已返还 taskId=${taskId} userId=${task.userId}`);
        }
      }

      return true;

    } catch (error) {
      logger.error(`[TaskService] 更新任务状态失败: ${error.message}`, { taskId, status, error });
      throw error;
    }
  }

  /**
   * 获取任务列表
   * @param {string} userId - 用户ID
   * @param {Object} options - 查询选项
   */
  async list(userId, options = {}) {
    try {
      const {
        limit = 10,
        offset = 0,
        status = null,
        type = null
      } = options;

      let query = db('tasks')
        .where('userId', userId)
        .orderBy('created_at', 'desc');

      // 按状态筛选
      if (status) {
        query = query.where('status', status);
      }

      // 按类型筛选
      if (type) {
        query = query.where('type', type);
      }

      // 分页
      const tasks = await query.limit(limit).offset(offset);

      // 获取总数
      let countQuery = db('tasks').where('userId', userId);
      if (status) {
        countQuery = countQuery.where('status', status);
      }
      if (type) {
        countQuery = countQuery.where('type', type);
      }
      const [{ count }] = await countQuery.count('* as count');

      // 格式化任务数据
      const formattedTasks = tasks.map(task => ({
        id: task.id,
        type: task.type,
        status: task.status,
        inputImageUrl: task.inputImageUrl,
        resultUrls: task.resultUrls ? JSON.parse(task.resultUrls) : [],
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        completedAt: task.completed_at
      }));

      return {
        tasks: formattedTasks,
        total: parseInt(count),
        limit,
        offset
      };

    } catch (error) {
      logger.error(`[TaskService] 获取任务列表失败: ${error.message}`, { userId, error });
      throw error;
    }
  }

  /**
   * 删除超时的pending任务
   * (定时任务使用,超过10分钟未处理的任务自动标记为failed)
   */
  async cleanupTimeoutTasks() {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const timeoutTasks = await db('tasks')
        .where('status', 'pending')
        .where('created_at', '<', tenMinutesAgo);

      for (const task of timeoutTasks) {
        await this.updateStatus(task.id, 'failed', {
          errorMessage: '任务超时(10分钟未处理)'
        });
      }

      if (timeoutTasks.length > 0) {
        logger.info(`[TaskService] 清理超时任务完成 count=${timeoutTasks.length}`);
      }

      return timeoutTasks.length;

    } catch (error) {
      logger.error(`[TaskService] 清理超时任务失败: ${error.message}`, error);
      throw error;
    }
  }
}

module.exports = new TaskService();
