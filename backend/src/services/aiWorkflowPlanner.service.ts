import logger from '../utils/logger.js';
import aiGateway from './ai-gateway.service.js';
import mcpEndpointsService from './mcp-endpoints.service.js';
import kbRetrievalService from './kbRetrieval.service.js';
import systemConfigService from './systemConfig.service.js';

type StepRetryPolicy = {
  maxAttempts?: number;
  delayMs?: number;
  exponential?: boolean;
};

export type PlannerPipelineStep = {
  type: 'MCP_TOOL_CALL';
  provider_ref: string; // MCP endpoint id
  toolName: string;
  parameters?: Record<string, unknown>;
  timeout?: number;
  retry_policy?: StepRetryPolicy;
};

export type PlannerResult = {
  summary: string;
  steps: PlannerPipelineStep[];
  warnings: string[];
  usedTools: Array<{ endpointId: string; toolName: string }>;
  kbContexts?: Array<{ title: string; text: string; kbId: string; score?: number }>;
  model?: string;
};

type PlannerInput = {
  userId: string;
  goal: string;
  inputData: Record<string, unknown>;
  kbId?: string;
  model?: string;
  maxSteps?: number;
  allowedEndpointIds?: string[];
};

type ToolCatalogItem = {
  endpointId: string;
  endpointName: string;
  toolName: string;
  description: string;
  inputSchema?: Record<string, unknown>;
};

const DEFAULT_MAX_STEPS = 6;

const extractJsonCandidate = (text: string): string => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text.trim();
};

const safeJsonParse = (text: string): unknown => {
  const candidate = extractJsonCandidate(text);
  return JSON.parse(candidate);
};

class AIWorkflowPlannerService {
  async plan(input: PlannerInput): Promise<PlannerResult> {
    const { userId, goal, inputData, kbId } = input;
    const maxSteps = Math.max(1, input.maxSteps ?? DEFAULT_MAX_STEPS);

    const model =
      (input.model ?? String(await systemConfigService.get('ai_planner_model', 'gpt-4o')).trim()) ||
      'gpt-4o';

    const toolCatalog = await this.getToolCatalog(input.allowedEndpointIds);
    if (toolCatalog.length === 0) {
      throw new Error('当前没有可用的MCP工具，请先在后台配置并测试通过 MCP 端点');
    }

    const kbContexts = await this.getKbContexts(goal, userId, kbId);

    const systemPrompt = this.buildSystemPrompt({
      goal,
      inputData,
      toolCatalog,
      kbContexts,
      maxSteps
    });

    // 最多两轮：第一次规划，失败后带错误信息让模型修复
    const attempts: Array<{ error?: string; responseText?: string }> = [];

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await aiGateway.chat({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content:
                attempt === 1
                  ? `目标：${goal}`
                  : `上一次输出无法解析或校验失败，请只返回符合要求的 JSON。错误信息：${attempts
                      .map((a) => a.error)
                      .filter(Boolean)
                      .join(' | ')}`
            }
          ],
          temperature: 0.2
        });

        const content = response.choices?.[0]?.message?.content ?? '';
        attempts.push({ responseText: content });

        const parsed = safeJsonParse(content) as Record<string, unknown>;
        const normalized = this.normalizePlan(parsed);
        this.validatePlan(normalized, toolCatalog, maxSteps);

        return {
          ...normalized,
          usedTools: normalized.steps.map((s) => ({
            endpointId: s.provider_ref,
            toolName: s.toolName
          })),
          kbContexts,
          model
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        attempts.push({ error: err.message });
        logger.warn('[AIWorkflowPlanner] 规划失败，准备重试', {
          attempt,
          error: err.message
        });
      }
    }

    const lastError =
      attempts
        .map((a) => a.error)
        .filter(Boolean)
        .pop() || '规划失败';
    throw new Error(lastError);
  }

  private async getToolCatalog(allowedEndpointIds?: string[]): Promise<ToolCatalogItem[]> {
    const { endpoints } = await mcpEndpointsService.getEndpoints({
      enabled: true,
      healthy: true,
      limit: 200
    });

    const filteredEndpoints =
      Array.isArray(allowedEndpointIds) && allowedEndpointIds.length > 0
        ? endpoints.filter((e) => allowedEndpointIds.includes(e.id))
        : endpoints;

    const tools: ToolCatalogItem[] = [];

    for (const endpoint of filteredEndpoints) {
      for (const tool of endpoint.supportedTools || []) {
        tools.push({
          endpointId: endpoint.id,
          endpointName: endpoint.name,
          toolName: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema || {}
        });
      }
    }

    // 为了控制 prompt 大小，最多提供 80 个工具
    return tools.slice(0, 80);
  }

  private async getKbContexts(
    goal: string,
    userId: string,
    kbId?: string
  ): Promise<Array<{ title: string; text: string; kbId: string; score?: number }>> {
    try {
      const results = await kbRetrievalService.retrieve({
        query: goal,
        userId,
        kbId,
        topK: 5
      });

      return results.map((r) => ({
        title: r.title,
        text: r.text,
        kbId: r.kbId,
        score: r.score
      }));
    } catch (error) {
      logger.warn('[AIWorkflowPlanner] 获取知识库上下文失败，继续无KB模式', error);
      return [];
    }
  }

  private buildSystemPrompt(args: {
    goal: string;
    inputData: Record<string, unknown>;
    toolCatalog: ToolCatalogItem[];
    kbContexts: Array<{ title: string; text: string; kbId: string; score?: number }>;
    maxSteps: number;
  }): string {
    const { inputData, toolCatalog, kbContexts, maxSteps } = args;

    const toolsText = toolCatalog
      .map((t) => {
        const schemaPreview =
          t.inputSchema && Object.keys(t.inputSchema).length > 0
            ? ` inputSchema=${JSON.stringify(t.inputSchema).slice(0, 600)}`
            : '';
        return `- endpointId=${t.endpointId} endpointName=${t.endpointName} tool=${t.toolName} desc=${t.description}${schemaPreview}`;
      })
      .join('\n');

    const kbText =
      kbContexts.length > 0
        ? kbContexts.map((c, i) => `#${i + 1} [${c.kbId}] ${c.title}\n${c.text}`).join('\n\n')
        : '（无）';

    return `你是一个“AI 工作流规划器”。你要把用户的目标拆成可执行的工作流步骤，后端会按顺序执行。

重要约束：
1) 你只能使用下方“可用MCP工具清单”里的工具（endpointId + toolName 必须匹配）。
2) 输出必须是严格的 JSON（不要输出解释文字、不要Markdown），结构如下：
{
  "summary": "一句话说明要做什么",
  "warnings": ["可选：风险/依赖/需要用户补充的信息"],
  "steps": [
    {
      "type": "MCP_TOOL_CALL",
      "provider_ref": "<endpointId>",
      "toolName": "<toolName>",
      "parameters": { "k": "v" },
      "timeout": 30000,
      "retry_policy": { "maxAttempts": 1, "delayMs": 1000, "exponential": false }
    }
  ]
}
3) steps 数量不能超过 ${maxSteps}，尽量少。
4) parameters 里的值允许使用变量模板 {{path.to.value}} 引用输入/上一步输出。例如：{{imageUrl}}、{{resultUrls.0}}
5) 输入数据 inputData 会作为第一步的可用变量；后续步骤能拿到之前步骤的输出（并保留最初 inputData）。

输入数据示例（inputData）：
${JSON.stringify(inputData).slice(0, 1200)}

知识库上下文（可选，优先参考执行规范/安全约束）：
${kbText}

可用MCP工具清单：
${toolsText}
`;
  }

  private normalizePlan(
    raw: Record<string, unknown>
  ): Omit<PlannerResult, 'usedTools' | 'kbContexts' | 'model'> {
    const summary = typeof raw.summary === 'string' ? raw.summary : '';
    const warnings = Array.isArray(raw.warnings)
      ? raw.warnings.filter((w) => typeof w === 'string').slice(0, 10)
      : [];

    const stepsRaw = raw.steps;
    const steps = Array.isArray(stepsRaw) ? (stepsRaw as Record<string, unknown>[]) : [];

    const normalizedSteps: PlannerPipelineStep[] = steps.map((s) => ({
      type: 'MCP_TOOL_CALL',
      provider_ref: String(s.provider_ref ?? ''),
      toolName: String(s.toolName ?? s.tool_name ?? ''),
      parameters:
        s.parameters && typeof s.parameters === 'object' && !Array.isArray(s.parameters)
          ? (s.parameters as Record<string, unknown>)
          : {},
      timeout: typeof s.timeout === 'number' ? s.timeout : undefined,
      retry_policy:
        s.retry_policy && typeof s.retry_policy === 'object'
          ? (s.retry_policy as StepRetryPolicy)
          : undefined
    }));

    return {
      summary,
      warnings,
      steps: normalizedSteps
    };
  }

  private validatePlan(
    plan: { summary: string; steps: PlannerPipelineStep[] },
    tools: ToolCatalogItem[],
    maxSteps: number
  ): void {
    if (!plan.summary || plan.summary.trim().length === 0) {
      throw new Error('规划结果缺少 summary');
    }

    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
      throw new Error('规划结果缺少 steps');
    }

    if (plan.steps.length > maxSteps) {
      throw new Error(`steps 数量超过限制: ${plan.steps.length}/${maxSteps}`);
    }

    const allowed = new Set(tools.map((t) => `${t.endpointId}::${t.toolName}`));

    for (const [idx, step] of plan.steps.entries()) {
      if (step.type !== 'MCP_TOOL_CALL') {
        throw new Error(`第${idx + 1}步 type 非法`);
      }
      if (!step.provider_ref) {
        throw new Error(`第${idx + 1}步 缺少 provider_ref`);
      }
      if (!step.toolName) {
        throw new Error(`第${idx + 1}步 缺少 toolName`);
      }
      if (!allowed.has(`${step.provider_ref}::${step.toolName}`)) {
        throw new Error(`第${idx + 1}步 工具不存在或不可用: ${step.provider_ref}/${step.toolName}`);
      }
      if (
        step.parameters &&
        (typeof step.parameters !== 'object' || Array.isArray(step.parameters))
      ) {
        throw new Error(`第${idx + 1}步 parameters 必须是对象`);
      }
    }
  }
}

export default new AIWorkflowPlannerService();
