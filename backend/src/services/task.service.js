const db = require('../config/database');
const { nanoid } = require('nanoid');
const quotaService = require('./quota.service');
const videoGenerateService = require('./videoGenerate.service');
const featureService = require('./feature.service');
const pipelineEngine = require('./pipelineEngine.service');
const { checkFeatureRateLimit } = require('../middlewares/rateLimiter.middleware');
const logger = require('../utils/logger');

/**
 * 任务服务 - 处理AI处理任务的创建、查询和状态管理
 */
class TaskService {
  /**
   * 创建任务
   * @param {string} userId - 用户ID
   * @param {string} type - 任务类型: basic_clean | model_pose12 | video_generate
   * @param {string} inputImageUrl - 输入图片URL
   * @param {Object} params - 任务参数
   */
  async create(userId, type, inputImageUrl, params = {}) {
    let taskId;
    try {
      const validTypes = ['basic_clean', 'model_pose12', 'video_generate'];
      if (!validTypes.includes(type)) {
        throw { errorCode: 4001, message: '无效的任务类型' };
      }

      const quotaCost = this.getQuotaCost(type);

      const result = await db.transaction(async (trx) => {
        // 1. 扣减配额(在事务中)
        await quotaService.deduct(userId, quotaCost, trx);

        // 2. 创建任务记录(在事务中)
        taskId = nanoid();
        const now = new Date();
        await trx('tasks').insert({
          id: taskId,
          userId,
          type,
          status: 'pending',
          inputUrl: inputImageUrl,
          params: JSON.stringify(params),
          created_at: now,
          updated_at: now,
        });

        return {
          taskId,
          type,
          status: 'pending',
          createdAt: now.toISOString(),
        };
      });

      logger.info(`[TaskService] 任务创建成功 taskId=${taskId} userId=${userId} type=${type} quotaCost=${quotaCost}`);

      // 3. 异步处理视频生成任务(在事务成功后)
      if (type === 'video_generate') {
        this.processVideoGenerateTask(taskId, inputImageUrl, params)
          .catch(err => {
            logger.error(`[TaskService] 视频任务异步处理失败: ${err.message}`, { taskId });
            this.handleVideoTaskFailure(taskId, userId, err.message);
          });
      }

      return result;
    } catch (error) {
      logger.error(`[TaskService] 创建任务失败: ${error.message}`, { userId, type, error });
      // 如果事务失败且是视频任务，确保不会触发异步处理
      if (type === 'video_generate' && taskId) {
        // 任务创建失败，但ID已生成，可能需要额外清理逻辑
      }
      throw error;
    }
  }

  /**
   * 基于功能卡片创建任务（新架构）
   * @param {string} userId - 用户ID
   * @param {string} featureId - 功能ID
   * @param {Object} inputData - 输入数据（由前端表单提交）
   * @returns {Promise<Object>} 创建的任务信息
   */
  async createByFeature(userId, featureId, inputData = {}) {
    let taskId;
    try {
      // 1. 获取功能定义
      const feature = await db('feature_definitions')
        .where('feature_id', featureId)
        .whereNull('deleted_at')
        .first();

      if (!feature) {
        throw { errorCode: 4004, message: '功能不存在' };
      }

      if (!feature.is_enabled) {
        throw { errorCode: 4003, message: '功能已禁用' };
      }

      // 2. 检查用户权限
      const hasAccess = await featureService.checkUserAccess(userId, feature);
      if (!hasAccess) {
        throw { errorCode: 4003, message: '无权使用该功能' };
      }

      // 3. 检查限流
      const rateLimitResult = await checkFeatureRateLimit(
        featureId,
        feature.rate_limit_policy,
        userId
      );

      if (!rateLimitResult.allowed) {
        throw {
          errorCode: 4029,
          message: '请求过于频繁，请稍后再试',
          rateLimitInfo: {
            resetAt: rateLimitResult.resetAt,
            remaining: rateLimitResult.remaining
          }
        };
      }

      // 4. 在事务中扣配额并创建任务
      const result = await db.transaction(async (trx) => {
        // 扣减配额
        await quotaService.deduct(userId, feature.quota_cost, trx);

        // 创建任务记录
        taskId = nanoid();
        const now = new Date();

        await trx('tasks').insert({
          id: taskId,
          userId,
          feature_id: featureId,
          status: 'pending',
          input_data: JSON.stringify(inputData),
          created_at: now,
          updated_at: now,
          // 保留旧字段兼容性（type是NOT NULL字段，用feature_id作为type的占位值）
          type: featureId,
          inputUrl: inputData.imageUrl || '',
          params: null
        });

        return {
          taskId,
          featureId,
          status: 'pending',
          createdAt: now.toISOString(),
          quotaCost: feature.quota_cost
        };
      });

      logger.info(
        `[TaskService] Feature任务创建成功 taskId=${taskId} userId=${userId} ` +
        `featureId=${featureId} quotaCost=${feature.quota_cost}`
      );

      // 异步执行Pipeline（不阻塞响应）
      pipelineEngine.executePipeline(taskId, featureId, inputData)
        .catch(err => {
          logger.error(
            `[TaskService] Pipeline执行异常 taskId=${taskId} error=${err.message}`,
            { taskId, featureId, error: err }
          );
        });

      return result;

    } catch (error) {
      logger.error(
        `[TaskService] 创建Feature任务失败: ${error.message}`,
        { userId, featureId, error }
      );
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
        vendorTaskId: task.vendorTaskId,
        coverUrl: task.coverUrl,
        thumbnailUrl: task.thumbnailUrl,
        errorMessage: task.errorMessage,
        errorReason: task.errorReason,
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
          const refundAmount = this.getQuotaCost(task.type);
          await quotaService.refund(task.userId, refundAmount, `任务失败返还:${taskId}`);
          logger.info(`[TaskService] 任务失败,配额已返还 taskId=${taskId} userId=${task.userId} amount=${refundAmount}`);
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
   * 处理视频生成任务
   * @param {string} taskId - 任务ID
   * @param {string} inputImageUrl - 输入图片URL
   * @param {Object} params - 任务参数
   */
  async processVideoGenerateTask(taskId, inputImageUrl, params) {
    try {
      logger.info(`[TaskService] 开始处理视频生成任务 taskId=${taskId}`);

      // 更新任务状态为processing
      await this.updateStatus(taskId, 'processing');

      // 调用视频生成服务
      const videoResult = await videoGenerateService.processVideoTask(
        taskId,
        inputImageUrl,
        params
      );

      // 保存vendorTaskId到数据库
      await db('tasks')
        .where('id', taskId)
        .update({
          vendorTaskId: videoResult.vendorTaskId,
          updated_at: new Date()
        });

      logger.info(`[TaskService] 视频生成任务处理完成 taskId=${taskId} vendorTaskId=${videoResult.vendorTaskId}`);

    } catch (error) {
      logger.error(`[TaskService] 视频生成任务处理失败 taskId=${taskId} error=${error.message}`);
      throw error;
    }
  }

  /**
   * 处理视频任务失败
   * @param {string} taskId - 任务ID
   * @param {string} userId - 用户ID
   * @param {string} errorMessage - 错误信息
   */
  async handleVideoTaskFailure(taskId, userId, errorMessage) {
    try {
      // 更新任务状态为失败
      await this.updateStatus(taskId, 'failed', {
        errorMessage: errorMessage
      });

      const refundAmount = this.getQuotaCost('video_generate');
      await quotaService.refund(userId, refundAmount, `视频任务失败返还:${taskId}`);

      logger.info(`[TaskService] 视频任务失败处理完成 taskId=${taskId} userId=${userId} 已返还配额`);

    } catch (error) {
      logger.error(`[TaskService] 视频任务失败处理异常 taskId=${taskId} error=${error.message}`);
    }
  }

  /**
   * 获取任务类型的配额消耗
   * @param {string} type - 任务类型
   * @returns {number} 配额消耗数量
   */
  getQuotaCost(type) {
    const key = `QUOTA_COST_${type.toUpperCase()}`;
    return parseInt(process.env[key] || '1', 10);
  }

  /**
   * 获取任务类型的中文名称
   * @param {string} type - 任务类型
   * @returns {string} 中文名称
   */
  getTaskTypeLabel(type) {
    const labels = {
      'basic_clean': '基础修图',
      'model_pose12': 'AI模特12分镜',
      'video_generate': '服装视频生成'
    };
    return labels[type] || type;
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

  /**
   * 返还配额
   * @param {string} userId - 用户ID
   * @param {number} amount - 返还数量
   * @param {string} reason - 返还原因
   */
  async refundQuota(userId, amount, reason) {
    return await quotaService.refund(userId, amount, reason);
  }
}

module.exports = new TaskService();
