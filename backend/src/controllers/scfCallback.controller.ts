import type { Request, Response } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import { db } from '../config/database.js';

interface ScfCallbackPayload extends Record<string, unknown> {
  taskId?: string | unknown;
  stepIndex?: number | unknown;
  status?: string | unknown;
  output?: unknown;
  errorMessage?: string | unknown;
  timestamp?: number | string | unknown;
  signature?: string | unknown;
}

class ScfCallbackController {
  async handleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { taskId, stepIndex, status, output, errorMessage, timestamp, signature } = (req.body ??
        {}) as ScfCallbackPayload;

      logger.info(
        `[ScfCallbackController] 收到SCF回调 taskId=${taskId} stepIndex=${stepIndex} status=${status}`
      );

      if (!taskId || stepIndex === undefined || !status || !timestamp || !signature) {
        res.status(400).json({ success: false, error: { code: 4001, message: '缺少必要参数' } });
        return;
      }

      if (!this.verifySignature(req.body)) {
        logger.warn(`[ScfCallbackController] HMAC签名验证失败 taskId=${taskId}`, {
          body: req.body
        });
        res.status(403).json({ success: false, error: { code: 4003, message: '签名验证失败' } });
        return;
      }

      const now = Date.now();
      const callbackTimestamp = Number.parseInt(String(timestamp), 10);
      const timeDiff = Math.abs(now - callbackTimestamp);
      if (Number.isNaN(callbackTimestamp) || timeDiff > 5 * 60 * 1000) {
        logger.warn(`[ScfCallbackController] 回调时间戳过期 taskId=${taskId} diff=${timeDiff}ms`);
        res.status(400).json({ success: false, error: { code: 4002, message: '回调时间戳过期' } });
        return;
      }

      const task = await db('tasks').where('id', taskId).first();
      if (!task) {
        logger.warn(`[ScfCallbackController] 任务不存在 taskId=${taskId}`);
        res.status(404).json({ success: false, error: { code: 4004, message: '任务不存在' } });
        return;
      }

      const taskStep = await db('task_steps')
        .where({ task_id: taskId, step_index: stepIndex })
        .first();
      if (!taskStep) {
        logger.warn(
          `[ScfCallbackController] 任务步骤不存在 taskId=${taskId} stepIndex=${stepIndex}`
        );
        res.status(404).json({ success: false, error: { code: 4004, message: '任务步骤不存在' } });
        return;
      }

      if (taskStep.status === 'completed' || taskStep.status === 'failed') {
        logger.info(
          `[ScfCallbackController] 步骤已处理,跳过 taskId=${taskId} stepIndex=${stepIndex} currentStatus=${taskStep.status}`
        );
        res.json({ success: true, message: '步骤已处理' });
        return;
      }

      await db('task_steps')
        .where({ task_id: taskId, step_index: stepIndex })
        .update({
          status,
          output: output ? JSON.stringify(output) : null,
          error_message: errorMessage || null,
          completed_at: new Date()
        });

      logger.info(
        `[ScfCallbackController] 步骤状态已更新 taskId=${taskId} stepIndex=${stepIndex} newStatus=${status}`
      );

      const totalSteps = await db('task_steps')
        .where('task_id', taskId)
        .count('* as count')
        .first();
      const completedSteps = await db('task_steps')
        .where('task_id', taskId)
        .where('status', 'completed')
        .count('* as count')
        .first();

      if (
        status === 'completed' &&
        Number(completedSteps?.count ?? 0) === Number(totalSteps?.count ?? 0)
      ) {
        await db('tasks')
          .where('id', taskId)
          .update({
            status: 'success',
            artifacts: output ? JSON.stringify(output) : null,
            completed_at: new Date(),
            updated_at: new Date()
          });
        logger.info(`[ScfCallbackController] 任务全部完成 taskId=${taskId}`);
      } else if (status === 'failed') {
        await db('tasks')
          .where('id', taskId)
          .update({
            status: 'failed',
            errorMessage: errorMessage || '步骤执行失败',
            errorReason: `步骤${stepIndex}执行失败`,
            completed_at: new Date(),
            updated_at: new Date()
          });
        logger.error(
          `[ScfCallbackController] 任务失败 taskId=${taskId} stepIndex=${stepIndex} error=${errorMessage}`
        );
      }

      res.json({ success: true, message: '回调处理成功' });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ScfCallbackController] 处理回调失败: ${err.message}`, {
        error,
        body: req.body
      });
      res.status(500).json({ success: false, error: { code: 5000, message: '服务器内部错误' } });
    }
  }

  verifySignature(data: ScfCallbackPayload): boolean {
    try {
      const { signature, ...payload } = data || {};
      const hmacSecret = process.env.INTERNAL_CALLBACK_SECRET || 'default_secret';
      const sortedKeys = Object.keys(payload).sort();
      const signatureData = sortedKeys.map((key) => `${key}=${String(payload[key])}`).join('&');
      const expectedSignature = crypto
        .createHmac('sha256', hmacSecret)
        .update(signatureData)
        .digest('hex');
      return signature === expectedSignature;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ScfCallbackController] 签名验证异常: ${err.message}`, error);
      return false;
    }
  }
}

export default new ScfCallbackController();
