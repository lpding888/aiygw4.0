import { db } from '../db';
import { logger } from '../utils/logger';
import { quotaService } from './quota.service';

export interface StepConfig {
  taskId: string;
  stepIndex: number;
  type: string;
  providerRef: string;
  timeout?: number;
  retryPolicy?: {
    max_retries?: number;
    retry_delay_ms?: number;
  };
}

export interface StepResult {
  success: boolean;
  output?: any;
  error?: string;
}

export interface Provider {
  execute(input: any, taskId: string): Promise<any>;
}

/**
 * PipelineEngine - 核心编排引擎
 * 负责按照Pipeline Schema执行多步骤任务流程
 * 集成Saga模式的配额管理
 */
export class PipelineEngine {
  private providers: Map<string, Provider> = new Map();

  /**
   * 注册Provider
   * @param type - 步骤类型
   * @param provider - Provider实例
   */
  registerProvider(type: string, provider: Provider): void {
    this.providers.set(type, provider);
  }

  /**
   * 获取Provider
   * @param type - 步骤类型
   * @param providerRef - Provider引用
   * @returns Provider实例
   */
  getProvider(type: string, providerRef?: string): Provider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`未找到Provider type=${type}`);
    }
    return provider;
  }

  /**
   * 执行Pipeline
   * @param taskId - 任务ID
   * @param featureId - 功能ID
   * @param inputData - 用户输入数据
   */
  async executePipeline(taskId: string, featureId: string, inputData: Record<string, any>): Promise<void> {
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
      const taskSteps = steps.map((step: any, index: number) => ({
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
        const stepConfig: StepConfig = {
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
            stepResult.error || '未知错误'
          );
          return;
        }

        // 步骤成功,输出作为下一步的输入
        previousOutput = stepResult.output;
      }

      // 5. 所有步骤成功,更新任务状态为success
      await this.handlePipelineSuccess(taskId, previousOutput);

      logger.info(`[PipelineEngine] Pipeline执行成功 taskId=${taskId}`);

    } catch (error: any) {
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
   * @param stepConfig - 步骤配置
   * @param input - 输入数据
   * @returns {Promise<StepResult>} 执行结果
   */
  async executeStep(stepConfig: StepConfig, input: any): Promise<StepResult> {
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
      let provider: Provider;
      try {
        provider = this.getProvider(type, providerRef);
      } catch (error: any) {
        logger.error(`[PipelineEngine] Provider加载失败 type=${type} ref=${providerRef}`);
        throw error;
      }

      // 执行provider(带重试机制)
      const maxRetries = retryPolicy?.max_retries || 0;
      const retryDelay = retryPolicy?.retry_delay_ms || 1000;

      let lastError: Error | undefined;
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
            this.timeout(timeout || 30000, `步骤执行超时(${timeout}ms)`)
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

        } catch (error: any) {
          lastError = error;
          logger.warn(
            `[PipelineEngine] 步骤执行失败 attempt=${attempt} ` +
            `taskId=${taskId} stepIndex=${stepIndex} error=${error.message}`
          );
        }
      }

      // 所有重试都失败
      throw lastError || new Error('未知错误');

    } catch (error: any) {
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
   * 处理Pipeline成功
   * @param taskId - 任务ID
   * @param output - 最终输出
   */
  private async handlePipelineSuccess(taskId: string, output: any): Promise<void> {
    await db('tasks')
      .where('id', taskId)
      .update({
        status: 'success',
        resultUrls: JSON.stringify(output),
        completed_at: new Date(),
        updated_at: new Date()
      });
  }

  /**
   * 处理Pipeline失败
   * @param taskId - 任务ID
   * @param featureId - 功能ID
   * @param stepIndex - 失败步骤索引(-1表示异常)
   * @param errorMessage - 错误信息
   */
  private async handlePipelineFailure(
    taskId: string,
    featureId: string,
    stepIndex: number,
    errorMessage: string
  ): Promise<void> {
    try {
      // 1. 更新任务状态为failed
      await db('tasks')
        .where('id', taskId)
        .update({
          status: 'failed',
          errorMessage,
          completed_at: new Date(),
          updated_at: new Date()
        });

      // 2. 使用Saga模式退还配额
      await quotaService.cancel(taskId);

      logger.info(
        `[PipelineEngine] Pipeline失败,配额已退还 taskId=${taskId} ` +
        `featureId=${featureId} stepIndex=${stepIndex} error=${errorMessage}`
      );
    } catch (error: any) {
      logger.error(
        `[PipelineEngine] 处理Pipeline失败异常 taskId=${taskId} error=${error.message}`,
        { taskId, featureId, stepIndex, error }
      );
    }
  }

  /**
   * 超时Promise
   * @param ms - 超时毫秒数
   * @param message - 超时信息
   * @returns Promise
   */
  private timeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * 睡眠函数
   * @param ms - 毫秒数
   * @returns Promise
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const pipelineEngine = new PipelineEngine();