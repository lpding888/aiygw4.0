import logger from '../../utils/logger.js';
import mcpEndpointsService from '../mcp-endpoints.service.js';
import { db } from '../../config/database.js';

type McpToolCallProviderRef = string; // MCP 端点 ID

/**
 * MCP 工具调用 Provider
 *
 * 约定：
 * - Pipeline step 的 provider_ref = MCP 端点 id
 * - step 上可附加 toolName/tool_name + parameters 字段
 * - PipelineEngine 会把 step 注入到 input.__step
 */
class McpToolCallProvider {
  constructor(private readonly providerRef: McpToolCallProviderRef) {
    logger.info(`[McpToolCallProvider] 初始化 providerRef=${providerRef}`);
  }

  async execute(input: Record<string, unknown>, taskId: string): Promise<Record<string, unknown>> {
    const step = (input.__step as Record<string, unknown> | undefined) ?? {};

    const toolName = (step.toolName ?? step.tool_name) as string | undefined;
    const rawParameters = (step.parameters as Record<string, unknown> | undefined) ?? {};

    if (!toolName || toolName.trim().length === 0) {
      throw new Error('缺少必要参数: toolName');
    }

    // 执行参数允许引用上一步输出（{{path.to.value}}）
    const contextData: Record<string, unknown> = { ...input };
    delete contextData.__step;
    const parameters = this.resolveParameters(rawParameters, contextData);

    // MCP 工具执行需要 userId，用 task 反查
    const task = await db('tasks').where('id', taskId).first();
    const userId = String(task?.userId ?? 'system');

    const result = await mcpEndpointsService.executeTool(
      this.providerRef,
      toolName,
      parameters,
      userId
    );

    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return result as Record<string, unknown>;
    }

    return { result };
  }

  private resolveParameters(
    params: Record<string, unknown>,
    context: Record<string, unknown>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      resolved[key] = this.resolveValue(value, context);
    }
    return resolved;
  }

  private resolveValue(value: unknown, context: Record<string, unknown>): unknown {
    if (typeof value === 'string') {
      // 仅当字符串包含 {{ }} 时尝试解析
      return value.replace(/{{\s*([^}]+)\s*}}/g, (_m, path) => {
        const v = this.getNestedValue(context, String(path).trim());
        if (v === undefined || v === null) return '';
        return typeof v === 'string' ? v : JSON.stringify(v);
      });
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, context));
    }

    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const nested: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        nested[k] = this.resolveValue(v, context);
      }
      return nested;
    }

    return value;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}

export default McpToolCallProvider;
