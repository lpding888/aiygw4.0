/**
 * MCP工具调用节点执行器
 * 艹，这个憨批节点负责调用MCP工具并合并结果到流程状态！
 *
 * 功能：
 * - 从上下文变量渲染参数
 * - 调用MCP工具
 * - 合并结果到state
 * - 支持重试与超时
 * - 完善的错误处理
 */

import logger from '../../utils/logger.js';
import mcpEndpointsService from '../../services/mcp-endpoints.service.js';
import {
  NodeExecutor,
  NodeExecutionContext,
  NodeExecutionResult,
  NodeConfig,
  NodeError,
  NodeErrorType
} from '../types.js';

/**
 * MCP工具调用配置
 */
interface MCPToolCallConfig {
  mcpEndpointRef: string; // MCP端点引用（使用端点ID）
  toolName: string; // 工具名称
  parameters: Record<string, unknown>; // 工具参数（支持变量模板）
  outputKey?: string; // 输出键名（默认使用工具名称）
  validateSchema?: boolean; // 是否验证参数Schema（默认true）
}

/**
 * MCP端点信息（与 mcp-endpoints.service 输出对齐）
 */
interface MCPEndpoint {
  id: string;
  name: string;
  endpointUrl: string;
  supportedTools: MCPToolSchema[];
  status: 'active' | 'inactive' | 'error';
  healthy: boolean;
  timeoutMs: number;
  maxRetries: number;
  enabled: boolean;
}

/**
 * MCP工具Schema
 */
interface MCPToolSchema {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  parameters?: {
    name: string;
    required?: boolean;
    description?: string;
  }[];
}

/**
 * MCP工具调用节点执行器
 */
class MCPToolCallNodeExecutor implements NodeExecutor {
  /**
   * 执行MCP工具调用节点
   */
  async execute(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      // 1. 解析节点配置
      const config = this.parseConfig(context.node);

      logger.info(
        `[MCPToolCall] 开始执行: flowId=${context.flowContext.flowId} ` +
          `nodeId=${context.node.id} tool=${config.toolName}`
      );

      // 2. 获取并验证MCP端点配置
      const endpoint = await this.ensureEndpointReady(config.mcpEndpointRef);
      if (!endpoint) {
        throw this.createError(
          'MCP_ENDPOINT_NOT_FOUND',
          `MCP endpoint not found or unavailable: ${config.mcpEndpointRef}`,
          NodeErrorType.INVALID_CONFIG
        );
      }

      // 3. 渲染参数（解析变量模板）
      const resolvedParams = this.resolveParameters(config.parameters, context.flowContext.state);

      // 4. 验证参数Schema（可选）
      if (config.validateSchema) {
        await this.validateParameters(endpoint, config.toolName, resolvedParams);
      }

      // 5. 调用MCP工具
      const result = await this.callMCPTool(endpoint, config.toolName, resolvedParams, context);

      // 6. 合并结果到流程状态
      const outputKey = config.outputKey || config.toolName;
      context.flowContext.state[outputKey] = result;

      const duration = Date.now() - startTime;

      logger.info(
        `[MCPToolCall] 执行成功: nodeId=${context.node.id} ` +
          `tool=${config.toolName} duration=${duration}ms`
      );

      return {
        success: true,
        outputs: {
          [outputKey]: result
        },
        duration,
        metadata: {
          toolName: config.toolName,
          endpoint: endpoint.name
        }
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;

      logger.error(`[MCPToolCall] 执行失败: nodeId=${context.node.id}`, error);

      return {
        success: false,
        error: this.handleError(error),
        duration
      };
    }
  }

  /**
   * 验证节点配置
   */
  validate(config: NodeConfig): boolean {
    try {
      this.parseConfig(config);
      return true;
    } catch (error) {
      logger.error('[MCPToolCall] 配置验证失败:', error);
      return false;
    }
  }

  /**
   * 解析节点配置
   * @private
   */

  /**
   * 获取MCP端点配置（若状态不可用则尝试测试刷新）
   * @private
   */
  private async ensureEndpointReady(endpointRef: string): Promise<MCPEndpoint | null> {
    const endpoint = await this.getMCPEndpoint(endpointRef);
    if (!endpoint) return null;

    if (endpoint.enabled && endpoint.status === 'active' && endpoint.healthy) {
      return endpoint;
    }

    // 尝试执行一次测试刷新状态
    await mcpEndpointsService.testEndpoint(endpoint.id);
    return await this.getMCPEndpoint(endpointRef);
  }

  /**
   * 获取MCP端点配置
   * @private
   */
  private async getMCPEndpoint(endpointRef: string): Promise<MCPEndpoint | null> {
    try {
      const endpoint = await mcpEndpointsService.getEndpoint(endpointRef);
      if (!endpoint) return null;
      return {
        id: endpoint.id,
        name: endpoint.name,
        endpointUrl: endpoint.endpointUrl,
        supportedTools: endpoint.supportedTools as unknown as MCPToolSchema[],
        status: endpoint.status,
        healthy: endpoint.healthy,
        timeoutMs: endpoint.timeoutMs,
        maxRetries: endpoint.maxRetries,
        enabled: endpoint.enabled
      };
    } catch (error) {
      logger.error('[MCPToolCall] 获取MCP端点失败:', error);
      throw error;
    }
  }

  /**
   * 解析参数（变量模板）
   * @private
   */
  private resolveParameters(
    params: Record<string, unknown>,
    state: Record<string, unknown>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      resolved[key] = this.resolveValue(value, state);
    }

    return resolved;
  }

  /**
   * 解析单个值（支持变量模板）
   * @private
   */
  private resolveValue(value: unknown, state: Record<string, unknown>): unknown {
    if (typeof value === 'string') {
      // 解析 {{variable}} 模板
      return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const resolved = this.getNestedValue(state, path.trim());
        const replacement = resolved !== undefined ? resolved : match;
        if (replacement === null || replacement === undefined) {
          return '';
        }
        return typeof replacement === 'string' ? replacement : String(replacement);
      });
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, state));
    }

    if (typeof value === 'object' && value !== null) {
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        resolved[k] = this.resolveValue(v, state);
      }
      return resolved;
    }

    return value;
  }

  private parseConfig(node: NodeConfig): MCPToolCallConfig {
    const rawConfig = node.config as Record<string, unknown> | undefined;
    if (!rawConfig || typeof rawConfig !== 'object') {
      throw this.createError('INVALID_CONFIG', 'MCP工具配置不能为空', NodeErrorType.INVALID_CONFIG);
    }

    const mcpEndpointRef = rawConfig.mcpEndpointRef;
    if (typeof mcpEndpointRef !== 'string' || mcpEndpointRef.trim().length === 0) {
      throw this.createError(
        'MISSING_ENDPOINT_REF',
        '缺少mcpEndpointRef配置',
        NodeErrorType.INVALID_CONFIG
      );
    }

    const toolName = rawConfig.toolName;
    if (typeof toolName !== 'string' || toolName.trim().length === 0) {
      throw this.createError('MISSING_TOOL_NAME', '缺少toolName配置', NodeErrorType.INVALID_CONFIG);
    }

    const parameters =
      rawConfig.parameters && typeof rawConfig.parameters === 'object'
        ? (rawConfig.parameters as Record<string, unknown>)
        : {};

    const outputKey = typeof rawConfig.outputKey === 'string' ? rawConfig.outputKey : undefined;
    const validateSchema =
      rawConfig.validateSchema === undefined ? true : Boolean(rawConfig.validateSchema);

    return {
      mcpEndpointRef,
      toolName,
      parameters,
      outputKey,
      validateSchema
    };
  }

  /**
   * 获取嵌套对象值
   * @private
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let value: unknown = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * 验证参数Schema
   * @private
   */
  private async validateParameters(
    endpoint: MCPEndpoint,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<void> {
    try {
      const schema = await this.getToolSchema(endpoint, toolName);

      if (!schema || !schema.parameters) {
        logger.warn(`[MCPToolCall] 工具Schema不存在: ${toolName}`);
        return;
      }

      // 验证必需参数
      const reqFields: string[] = Array.isArray((schema as any)?.inputSchema?.required)
        ? ((schema as any).inputSchema.required as string[])
        : (schema.parameters || []).filter((p) => p.required).map((p) => p.name);

      for (const field of reqFields) {
        if (!(field in params) || params[field] === undefined) {
          throw this.createError(
            'MISSING_REQUIRED_PARAM',
            `Missing required parameter: ${field}`,
            NodeErrorType.MISSING_INPUT
          );
        }
      }
    } catch (error) {
      logger.error('[MCPToolCall] 参数验证失败:', error);
      throw error;
    }
  }

  /**
   * 获取工具Schema
   * @private
   */
  private async getToolSchema(
    endpoint: MCPEndpoint,
    toolName: string
  ): Promise<MCPToolSchema | null> {
    try {
      const tool = endpoint.supportedTools?.find((t) => t.name === toolName);
      if (!tool) return null;
      return tool;
    } catch (error) {
      logger.error('[MCPToolCall] 获取工具Schema失败:', error);
      return null;
    }
  }

  /**
   * 调用MCP工具
   * @private
   */
  private async callMCPTool(
    endpoint: MCPEndpoint,
    toolName: string,
    params: Record<string, unknown>,
    context: NodeExecutionContext
  ): Promise<unknown> {
    const maxRetries = context.node.retryPolicy?.maxRetries || endpoint.maxRetries || 0;
    const retryDelay = context.node.retryPolicy?.retryDelay || 1000;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(
            `[MCPToolCall] 重试调用: attempt=${attempt}/${maxRetries} ` + `tool=${toolName}`
          );
          await this.sleep(retryDelay * attempt);
        }

        const result = await mcpEndpointsService.executeTool(
          endpoint.id,
          toolName,
          params,
          context.flowContext.userId || 'system'
        );

        return result;
      } catch (error: unknown) {
        lastError = error as Error;

        // 判断是否可重试
        if (!this.isRetryableError(error) || attempt >= maxRetries) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * 判断是否可重试的错误
   * @private
   */
  private isRetryableError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const err = error as Record<string, unknown>;

    // 网络错误可重试
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      return true;
    }

    // 5xx服务器错误可重试
    if (err.response) {
      const response = err.response as Record<string, unknown>;
      if (typeof response.status === 'number' && response.status >= 500) {
        return true;
      }
    }

    // 429 Too Many Requests可重试
    if (err.response) {
      const response = err.response as Record<string, unknown>;
      if (response.status === 429) {
        return true;
      }
    }

    return false;
  }

  /**
   * 创建错误对象
   * @private
   */
  private createError(
    code: string,
    message: string,
    type: NodeErrorType,
    details?: Record<string, unknown>
  ): NodeError {
    return {
      code,
      message,
      type,
      details
    };
  }

  /**
   * 处理错误
   * @private
   */
  private handleError(error: unknown): NodeError {
    if (typeof error === 'object' && error !== null && 'code' in error && 'type' in error) {
      return error as NodeError; // 已经是NodeError
    }

    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;

      if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
        return this.createError('MCP_TIMEOUT', 'MCP tool call timeout', NodeErrorType.TIMEOUT);
      }

      if (err.response) {
        const response = err.response as Record<string, unknown>;
        return this.createError(
          'MCP_TOOL_ERROR',
          `MCP tool error: ${response.status} ${response.statusText}`,
          NodeErrorType.MCP_TOOL_ERROR,
          {
            status: response.status,
            data: response.data
          }
        );
      }

      if ('message' in err && typeof err.message === 'string') {
        return this.createError('EXECUTION_FAILED', err.message, NodeErrorType.EXECUTION_FAILED);
      }
    }

    return this.createError(
      'EXECUTION_FAILED',
      'MCP tool call failed',
      NodeErrorType.EXECUTION_FAILED
    );
  }

  /**
   * 延迟函数
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 导出单例
export const mcpToolCallExecutor = new MCPToolCallNodeExecutor();

export default mcpToolCallExecutor;
