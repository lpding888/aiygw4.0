import { nanoid } from 'nanoid';
import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import quotaService from './quota.service.js';
import systemConfigService from './systemConfig.service.js';
import pipelineEngine from './pipelineEngine.service.js';
import aiWorkflowPlannerService, { type PlannerResult } from './aiWorkflowPlanner.service.js';

export type PlanOnlyRequest = {
  goal: string;
  inputData: Record<string, unknown>;
  kbId?: string;
  model?: string;
  maxSteps?: number;
  allowedEndpointIds?: string[];
};

export type ExecuteWorkflowRequest = PlanOnlyRequest & {
  // 是否只返回计划，不执行（不扣配额）
  dryRun?: boolean;
};

export type ExecuteWorkflowResult =
  | { dryRun: true; plan: PlannerResult }
  | { dryRun: false; taskId: string; quotaCost: number; plan: PlannerResult };

const parseQuotaCost = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
};

class AIWorkflowOrchestratorService {
  async execute(userId: string, req: ExecuteWorkflowRequest): Promise<ExecuteWorkflowResult> {
    const { goal, inputData, kbId, model, maxSteps, allowedEndpointIds, dryRun } = req;

    if (!goal || goal.trim().length === 0) {
      throw new Error('goal 不能为空');
    }
    if (!inputData || typeof inputData !== 'object') {
      throw new Error('inputData 必须是对象');
    }

    const plan = await aiWorkflowPlannerService.plan({
      userId,
      goal,
      inputData,
      kbId,
      model,
      maxSteps,
      allowedEndpointIds
    });

    if (dryRun) {
      return { dryRun: true, plan };
    }

    const quotaCostRaw = await systemConfigService.get('ai_planner_quota_cost', 1);
    const quotaCost = parseQuotaCost(quotaCostRaw, 1);

    const taskId = nanoid();
    const now = new Date();

    const inputUrl =
      (inputData.imageUrl as string) ||
      (inputData.inputImageUrl as string) ||
      (inputData.inputImage as string) ||
      '';

    await db.transaction(async (trx) => {
      await quotaService.reserve(userId, taskId, quotaCost, trx);

      await trx('tasks').insert({
        id: taskId,
        userId,
        feature_id: null,
        status: 'pending',
        input_data: JSON.stringify(inputData ?? {}),
        eligible_for_refund: true,
        refunded: false,
        created_at: now,
        updated_at: now,
        // 兼容旧字段
        type: 'ai_planner',
        inputUrl,
        params: JSON.stringify({
          goal,
          pipelineSteps: plan.steps,
          planner: {
            summary: plan.summary,
            warnings: plan.warnings,
            usedTools: plan.usedTools,
            model: plan.model,
            createdAt: now.toISOString()
          }
        })
      });
    });

    logger.info('[AIWorkflowOrchestrator] 任务已创建，开始执行', {
      taskId,
      userId,
      quotaCost
    });

    // PipelineEngine 会从 tasks.params 读取 pipelineSteps 作为覆盖步骤
    pipelineEngine.executePipeline(taskId, 'ai_planner', inputData).catch((err: Error) => {
      logger.error('[AIWorkflowOrchestrator] Pipeline执行异常', { taskId, error: err.message });
    });

    return { dryRun: false, taskId, quotaCost, plan };
  }
}

export default new AIWorkflowOrchestratorService();
