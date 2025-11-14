import type { Request, Response, NextFunction } from 'express';
import { db } from '../../config/database.js';
import logger from '../../utils/logger.js';

type FeatureWizardBody = {
  feature_id?: string;
  feature_key?: string;
  display_name?: string;
  description?: string;
  category?: string;
  icon?: string;
  plan_required?: string;
  access_scope?: string;
  quota_cost?: number;
  rate_limit_policy?: Record<string, unknown> | null;
  form_schema_id?: string;
  pipeline_schema_id?: string;
  pipeline_schema_data?: PipelineSchemaData;
};

type PipelineNode = {
  id: string;
  type?: string;
  data?: {
    providerRef?: string;
    provider_ref?: string;
    timeout?: number;
    retry_policy?: Record<string, unknown>;
    retryPolicy?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

type PipelineEdge = {
  id?: string;
  source: string;
  target: string;
};

type PipelineSchemaData = {
  nodes?: PipelineNode[];
  edges?: PipelineEdge[];
};

type PipelineStep = {
  type: string;
  provider_ref: string;
  timeout: number;
  retry_policy: Record<string, unknown>;
};

async function createFeatureFromWizard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      feature_id,
      feature_key,
      display_name,
      description,
      category,
      icon,
      plan_required,
      access_scope,
      quota_cost,
      rate_limit_policy,
      form_schema_id,
      pipeline_schema_id,
      pipeline_schema_data
    } = req.body as FeatureWizardBody;

    if (!feature_id || !display_name || !pipeline_schema_id || !pipeline_schema_data) {
      res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message:
            '缺少必要参数: feature_id, display_name, pipeline_schema_id, pipeline_schema_data'
        }
      });
      return;
    }

    const normalizedFeatureKey = feature_key ?? feature_id;

    const existingFeature = await db('feature_definitions')
      .where((builder) =>
        builder.where('feature_id', feature_id).orWhere('feature_key', normalizedFeatureKey)
      )
      .whereNull('deleted_at')
      .first();

    if (existingFeature) {
      res.status(409).json({
        success: false,
        error: {
          code: 4009,
          message: `Feature ID或Key已存在: ${feature_id}`
        }
      });
      return;
    }

    if (form_schema_id) {
      const existingFormSchema = await db('form_schemas')
        .where('schema_id', form_schema_id)
        .where('is_current', true)
        .first();

      if (!existingFormSchema) {
        res.status(404).json({
          success: false,
          error: {
            code: 4004,
            message: `Form Schema不存在: ${form_schema_id}`
          }
        });
        return;
      }
    }

    const steps = convertReactFlowToSteps(pipeline_schema_data);

    if (!steps.length) {
      res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: 'Pipeline为空，至少需要一个步骤节点'
        }
      });
      return;
    }

    await db.transaction(async (trx) => {
      await trx('pipeline_schemas').insert({
        pipeline_id: pipeline_schema_id,
        steps: JSON.stringify(steps),
        created_at: new Date(),
        updated_at: new Date()
      });

      await trx('feature_definitions').insert({
        feature_id,
        feature_key: normalizedFeatureKey,
        display_name,
        description,
        category: category ?? '图片处理',
        icon: icon ?? 'picture',
        plan_required: plan_required ?? 'free',
        access_scope: access_scope ?? 'plan',
        quota_cost: quota_cost ?? 1,
        rate_limit_policy: rate_limit_policy ?? null,
        form_schema_ref: form_schema_id ?? null,
        pipeline_schema_ref: pipeline_schema_id,
        is_enabled: false,
        created_at: new Date(),
        updated_at: new Date()
      });
    });

    logger.info(`[FeatureWizard] Feature创建成功 feature_id=${feature_id} steps=${steps.length}`);

    res.json({
      success: true,
      message: 'Feature创建成功',
      data: {
        feature_id,
        pipeline_steps: steps.length
      }
    });
  } catch (error) {
    logger.error(`[FeatureWizard] 创建失败: ${(error as Error).message}`, error);
    next(error);
  }
}

function convertReactFlowToSteps(pipelineData: PipelineSchemaData): PipelineStep[] {
  const { nodes, edges } = pipelineData;

  if (!nodes || !Array.isArray(nodes)) {
    throw new Error('Invalid pipeline_schema_data.nodes');
  }

  const safeEdges = Array.isArray(edges) ? edges : [];

  const startNode = nodes.find((node) => node.type === 'start');
  if (!startNode) {
    throw new Error('Pipeline必须包含一个start节点');
  }

  const adjacencyMap = new Map<string, string[]>();
  safeEdges.forEach((edge) => {
    if (!adjacencyMap.has(edge.source)) {
      adjacencyMap.set(edge.source, []);
    }
    adjacencyMap.get(edge.source)!.push(edge.target);
  });

  const steps: PipelineStep[] = [];
  const visited = new Set<string>();
  let currentNodeId: string | undefined = startNode.id;

  while (currentNodeId) {
    if (visited.has(currentNodeId)) {
      logger.warn(`[FeatureWizard] 检测到循环依赖 node=${currentNodeId}`);
      break;
    }
    visited.add(currentNodeId);

    const currentNode = nodes.find((node) => node.id === currentNodeId);
    if (!currentNode) {
      break;
    }

    if (currentNode.type !== 'start') {
      const step: PipelineStep = {
        type: currentNode.type ?? 'provider',
        provider_ref:
          (currentNode.data?.providerRef as string | undefined) ??
          (currentNode.data?.provider_ref as string | undefined) ??
          '',
        timeout: (currentNode.data?.timeout as number | undefined) ?? 30000,
        retry_policy:
          (currentNode.data?.retry_policy as Record<string, unknown> | undefined) ??
          (currentNode.data?.retryPolicy as Record<string, unknown> | undefined) ??
          {}
      };

      if (step.type === 'provider' && !step.provider_ref) {
        throw new Error(`节点 ${currentNode.id} 缺少provider_ref配置`);
      }

      steps.push(step);
    }

    const nextNodes = adjacencyMap.get(currentNodeId);
    if (!nextNodes || nextNodes.length === 0) {
      break;
    }

    if (nextNodes.length > 1) {
      logger.warn(`[FeatureWizard] 节点 ${currentNodeId} 有多个后续节点，暂不支持并行，只取第一个`);
    }
    currentNodeId = nextNodes[0];
  }

  logger.info(`[FeatureWizard] 转换Pipeline: ${nodes.length}个节点 -> ${steps.length}个步骤`);

  return steps;
}

const featureWizardController = {
  createFeatureFromWizard
};

export { createFeatureFromWizard };
export default featureWizardController;
