const db = require('../config/database');
const logger = require('../utils/logger');
const quotaService = require('./quota.service');

/**
 * PipelineEngine - 核心编排引擎
 * 负责按照Pipeline Schema执行多步骤任务流程
 */
class PipelineEngine {
  /**
   * 执行Pipeline
   * @param {string} taskId - 任务ID
   * @param {string} featureId - 功能ID
   * @param {Object} inputData - 用户输入数据
   */
  async executePipeline(taskId, featureId, inputData) {
    try {
      logger.info(`[PipelineEngine] 开始执行Pipeline taskId=${taskId} featureId=${featureId}`);

      // 1. 获取功能定义和Pipeline Schema
      const feature = await db('feature_definitions')
        .where('feature_id', featureId)
        .first();

      if (!feature || !feature.pipeline_schema_ref) {
        throw new Error('功能配置错误:缺少pipeline_schema_ref');
      }

      const pipelineSchema = await db('pipeline_schemas')
        .where('pipeline_id', feature.pipeline_schema_ref)
        .first();

      if (!pipelineSchema) {
        throw new Error(`Pipeline Schema不存在: ${feature.pipeline_schema_ref}`);
      }

      const steps = JSON.parse(pipelineSchema.steps);
      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error('Pipeline Schema steps配置错误');
      }

      // 2. 更新任务状态为processing
      await db('tasks')
        .where('id', taskId)
        .update({
          status: 'processing',
          updated_at: new Date()
        });

      // 3. 创建task_steps记录
      const taskSteps = steps.map((step, index) => ({
        task_id: taskId,
        step_index: index,
        type: step.type,
        provider_ref: step.provider_ref,
        status: 'pending',
        input: JSON.stringify(index === 0 ? inputData : {}), // 第一步使用inputData
        created_at: new Date()
      }));

      await db('task_steps').insert(taskSteps);
      logger.info(`[PipelineEngine] 创建${steps.length}个步骤记录 taskId=${taskId}`);

      // 4. 按顺序执行各个步骤
      let previousOutput = inputData; // 第一步的input

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepConfig = {
          taskId,
          stepIndex: i,
          type: step.type,
          providerRef: step.provider_ref,
          timeout: step.timeout || 30000,
          retryPolicy: step.retry_policy || {}
        };

        logger.info(
          `[PipelineEngine] 执行步骤${i + 1}/${steps.length} ` +
          `taskId=${taskId} type=${step.type} provider=${step.provider_ref}`
        );

        // 执行步骤
        const stepResult = await this.executeStep(stepConfig, previousOutput);

        if (!stepResult.success) {
          // 步骤失败,终止Pipeline
          await this.handlePipelineFailure(
            taskId,
            featureId,
            i,
            stepResult.error
          );
          return;
        }

        // 步骤成功,输出作为下一步的输入
        previousOutput = stepResult.output;
      }

      // 5. 所有步骤成功,更新任务状态为success
      await this.handlePipelineSuccess(taskId, previousOutput);

      logger.info(`[PipelineEngine] Pipeline执行成功 taskId=${taskId}`);

    } catch (error) {
      logger.error(
        `[PipelineEngine] Pipeline执行异常 taskId=${taskId} error=${error.message}`,
        { taskId, featureId, error }
      );

      // 处理异常
      await this.handlePipelineFailure(taskId, featureId, -1, error.message);
    }
  }

  /**
   * 执行单个步骤
   * @param {Object} stepConfig - 步骤配置
   * @param {Object} input - 输入数据
   * @returns {Promise<Object>} {success, output, error}
   */
  async executeStep(stepConfig, input) {
    const { taskId, stepIndex, type, providerRef, timeout, retryPolicy } = stepConfig;

    try {
      // 更新步骤状态为processing
      await db('task_steps')
        .where({ task_id: taskId, step_index: stepIndex })
        .update({
          status: 'processing',
          input: JSON.stringify(input),
          started_at: new Date()
        });

      // 根据type调用对应的provider
      let provider;
      try {
        provider = this.getProvider(type, providerRef);
      } catch (error) {
        logger.error(`[PipelineEngine] Provider加载失败 type=${type} ref=${providerRef}`);
        throw error;
      }

      // 执行provider(带重试机制)
      const maxRetries = retryPolicy.max_retries || 0;
      const retryDelay = retryPolicy.retry_delay_ms || 1000;

      let lastError;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            logger.info(
              `[PipelineEngine] 重试步骤 attempt=${attempt}/${maxRetries} ` +
              `taskId=${taskId} stepIndex=${stepIndex}`
            );
            await this.sleep(retryDelay);
          }

          const output = await Promise.race([
            provider.execute(input, taskId),
            this.timeout(timeout, `步骤执行超时(${timeout}ms)`)
          ]);

          // 成功,更新步骤状态
          await db('task_steps')
            .where({ task_id: taskId, step_index: stepIndex })
            .update({
              status: 'completed',
              output: JSON.stringify(output),
              completed_at: new Date()
            });

          return { success: true, output };

        } catch (error) {
          lastError = error;
          logger.warn(
            `[PipelineEngine] 步骤执行失败 attempt=${attempt} ` +
            `taskId=${taskId} stepIndex=${stepIndex} error=${error.message}`
          );
        }
      }

      // 所有重试都失败
      throw lastError;

    } catch (error) {
      // 更新步骤状态为failed
      await db('task_steps')
        .where({ task_id: taskId, step_index: stepIndex })
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date()
        });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取Provider实例
   * @param {string} type - Provider类型
   * @param {string} providerRef - Provider引用
   * @returns {Object} Provider实例
   */
  getProvider(type, providerRef) {
    // 根据type动态加载provider模块
    // 例如: SYNC_IMAGE_PROCESS -> ./providers/syncImageProcess.provider.js

    const providerMap = {
      'SYNC_IMAGE_PROCESS': './providers/syncImageProcess.provider',
      'RUNNINGHUB_WORKFLOW': './providers/runninghubWorkflow.provider',
      'SCF_POST_PROCESS': './providers/scfPostProcess.provider'
    };

    const providerPath = providerMap[type];
    if (!providerPath) {
      throw new Error(`未知的Provider类型: ${type}`);
    }

    try {
      const ProviderClass = require(providerPath);
      return new ProviderClass(providerRef);
    } catch (error) {
      logger.error(`[PipelineEngine] 加载Provider失败 type=${type} path=${providerPath}`);
      throw new Error(`Provider加载失败: ${type}`);
    }
  }

  /**
   * 处理Pipeline成功
   * @param {string} taskId - 任务ID
   * @param {Object} finalOutput - 最终输出结果
   */
  async handlePipelineSuccess(taskId, finalOutput) {
    try {
      const updateData = {
        status: 'success',
        artifacts: JSON.stringify(finalOutput),
        completed_at: new Date(),
        updated_at: new Date()
      };

      // 如果final output包含resultUrls,保存到旧字段兼容
      if (finalOutput.resultUrls) {
        updateData.resultUrls = JSON.stringify(finalOutput.resultUrls);
      }

      await db('tasks')
        .where('id', taskId)
        .update(updateData);

      logger.info(`[PipelineEngine] 任务成功完成 taskId=${taskId}`);

    } catch (error) {
      logger.error(`[PipelineEngine] 更新任务成功状态失败 taskId=${taskId}`, error);
    }
  }

  /**
   * 处理Pipeline失败
   * @param {string} taskId - 任务ID
   * @param {string} featureId - 功能ID
   * @param {number} failedStepIndex - 失败的步骤索引
   * @param {string} errorMessage - 错误信息
   */
  async handlePipelineFailure(taskId, featureId, failedStepIndex, errorMessage) {
    try {
      // 1. 更新任务状态为failed
      await db('tasks')
        .where('id', taskId)
        .update({
          status: 'failed',
          error_message: errorMessage,
          errorReason: `步骤${failedStepIndex + 1}执行失败`,
          completed_at: new Date(),
          updated_at: new Date()
        });

      // 2. 获取任务信息用于返还配额
      const task = await db('tasks').where('id', taskId).first();
      if (!task) {
        logger.error(`[PipelineEngine] 任务不存在 taskId=${taskId}`);
        return;
      }

      // 3. 获取功能定义,返还配额
      const feature = await db('feature_definitions')
        .where('feature_id', featureId)
        .first();

      if (feature && task.userId) {
        await quotaService.refund(
          task.userId,
          feature.quota_cost,
          `Pipeline失败返还:${taskId}`
        );

        logger.info(
          `[PipelineEngine] 配额已返还 taskId=${taskId} ` +
          `userId=${task.userId} amount=${feature.quota_cost}`
        );
      }

      logger.error(
        `[PipelineEngine] Pipeline执行失败 taskId=${taskId} ` +
        `failedStep=${failedStepIndex} error=${errorMessage}`
      );

    } catch (error) {
      logger.error(`[PipelineEngine] 处理Pipeline失败异常 taskId=${taskId}`, error);
    }
  }

  /**
   * 超时Promise辅助函数
   * @param {number} ms - 超时毫秒数
   * @param {string} message - 超时错误信息
   */
  timeout(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new PipelineEngine();
