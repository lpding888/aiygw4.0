/**
 * MCP Endpoints服务
 *
 * 管理MCP（Model Context Protocol）连接，支持CRUD、工具发现和测试
 */

import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import { db as knex } from '../db/index.js';
import logger from '../utils/logger.js';
import kmsService from './kms.service.js';
import configCacheService from '../cache/config-cache.js';

interface MCPEndpoint {
  id: string;
  name: string;
  description: string;
  endpointUrl: string;
  apiKeyId: string;
  protocolVersion: string;
  capabilities: string[];
  supportedTools: MCPTool[];
  status: 'active' | 'inactive' | 'error';
  lastSyncAt?: Date;
  lastError?: string;
  healthy: boolean;
  timeoutMs: number;
  maxRetries: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  category: string;
  enabled: boolean;
  parameters: MCPParameter[];
}

interface MCPParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: unknown[];
  };
}

interface MCPTestResult {
  success: boolean;
  latency: number;
  toolsCount: number;
  sampleTools: string[];
  error?: string;
  capabilities: string[];
}

interface MCPInitializeResponse {
  capabilities?: string[];
  [key: string]: unknown;
}

interface MCPToolsResponse {
  tools?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

class MCPEndpointsService {
  private readonly CACHE_SCOPE = 'mcp_endpoints';
  private readonly DEFAULT_VERSION = '1.0.0';

  // In-memory cache for Stdio processes: endpointId -> Process Info
  private static activeProcesses = new Map<string, {
    process: ChildProcess;
    pendingRequests: Map<number, (response: any) => void>;
    requestCounter: number;
    errorHandler: (err: Error) => void;
  }>();

  /**
   * 创建MCP端点
   */
  async createEndpoint(
    endpointData: Partial<MCPEndpoint>,
    secrets: {
      apiKey: string;
    },
    createdBy: string
  ): Promise<MCPEndpoint> {
    this.assertStdioAllowed(endpointData.endpointUrl);
    const endpointId = this.generateId();

    try {
      await knex.transaction(async (trx) => {
        // 加密API密钥
        const encryptedApiKey = await kmsService.encrypt(
          secrets.apiKey,
          `mcp_${endpointId}_api_key`
        );

        const endpoint: MCPEndpoint = {
          id: endpointId,
          name: endpointData.name!,
          description: endpointData.description || '',
          endpointUrl: endpointData.endpointUrl!,
          apiKeyId: encryptedApiKey.id,
          protocolVersion: endpointData.protocolVersion || '2024-11-05',
          capabilities: endpointData.capabilities || [],
          supportedTools: [],
          status: 'inactive',
          healthy: false,
          timeoutMs: endpointData.timeoutMs || 30000,
          maxRetries: endpointData.maxRetries || 3,
          enabled: endpointData.enabled !== false,
          metadata: endpointData.metadata || {},
          createdBy,
          updatedBy: createdBy,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await trx('mcp_endpoints').insert({
          id: endpoint.id,
          name: endpoint.name,
          description: endpoint.description,
          endpoint_url: endpoint.endpointUrl,
          api_key: endpoint.apiKeyId,
          protocol_version: endpoint.protocolVersion,
          capabilities: JSON.stringify(endpoint.capabilities),
          supported_tools: JSON.stringify(endpoint.supportedTools),
          status: endpoint.status,
          healthy: endpoint.healthy,
          timeout_ms: endpoint.timeoutMs,
          max_retries: endpoint.maxRetries,
          enabled: endpoint.enabled,
          metadata: JSON.stringify(endpoint.metadata),
          created_by: endpoint.createdBy,
          updated_by: endpoint.updatedBy,
          created_at: endpoint.createdAt,
          updated_at: endpoint.updatedAt
        });
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('MCP端点已创建', { endpointId, name: endpointData.name, createdBy });
      const endpoint = await this.getEndpoint(endpointId);
      if (!endpoint) {
        throw new Error('创建MCP端点后无法读取');
      }
      return endpoint;
    } catch (error: unknown) {
      logger.error('创建MCP端点失败:', error);
      throw error;
    }
  }

  /**
   * 更新MCP端点
   */
  async updateEndpoint(
    endpointId: string,
    updateData: Partial<MCPEndpoint>,
    updatedBy: string
  ): Promise<MCPEndpoint> {
    const existingEndpoint = await this.getEndpoint(endpointId);
    if (!existingEndpoint) {
      throw new Error('MCP端点不存在');
    }
    if (updateData.endpointUrl) {
      this.assertStdioAllowed(updateData.endpointUrl);
    }

    try {
      const now = new Date();
      const updateFields: Record<string, unknown> = {
        updated_by: updatedBy,
        updated_at: now
      };

      const assignIfPresent = (
        property: keyof MCPEndpoint,
        column: string,
        transform?: (value: unknown) => unknown
      ) => {
        if (Object.prototype.hasOwnProperty.call(updateData, property)) {
          const rawValue = (updateData as Record<string, unknown>)[property];
          updateFields[column] = transform ? transform(rawValue) : rawValue;
        }
      };

      assignIfPresent('name', 'name');
      assignIfPresent('description', 'description');
      assignIfPresent('endpointUrl', 'endpoint_url');
      assignIfPresent('protocolVersion', 'protocol_version');
      assignIfPresent('capabilities', 'capabilities', (value) => JSON.stringify(value || []));
      assignIfPresent('supportedTools', 'supported_tools', (value) => JSON.stringify(value || []));
      assignIfPresent('metadata', 'metadata', (value) => JSON.stringify(value || {}));
      assignIfPresent('status', 'status');
      assignIfPresent('healthy', 'healthy');
      assignIfPresent('timeoutMs', 'timeout_ms');
      assignIfPresent('maxRetries', 'max_retries');
      assignIfPresent('enabled', 'enabled');
      assignIfPresent('lastSyncAt', 'last_sync_at');
      assignIfPresent('lastError', 'last_error');

      await knex('mcp_endpoints').where('id', endpointId).update(updateFields);

      // 失效缓存
      await this.invalidateCache();

      logger.info('MCP端点已更新', { endpointId, updatedBy });
      const endpoint = await this.getEndpoint(endpointId);
      if (!endpoint) {
        throw new Error('更新MCP端点后无法读取');
      }
      return endpoint;
    } catch (error: unknown) {
      logger.error('更新MCP端点失败:', error);
      throw error;
    }
  }

  /**
   * 删除MCP端点
   */
  async deleteEndpoint(endpointId: string, deletedBy: string): Promise<boolean> {
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) {
      throw new Error('MCP端点不存在');
    }

    try {
      await knex.transaction(async (trx) => {
        // 删除相关的API密钥
        // TODO: Fix KMS delete method missing
        // await kmsService.delete(endpoint.apiKeyId);

        // 软删除端点
        await trx('mcp_endpoints').where('id', endpointId).update({
          enabled: false,
          status: 'inactive',
          updated_by: deletedBy,
          updated_at: new Date()
        });
      });

      // 失效缓存
      await this.invalidateCache();

      logger.info('MCP端点已删除', { endpointId, deletedBy });
      return true;
    } catch (error: unknown) {
      logger.error('删除MCP端点失败:', error);
      throw error;
    }
  }

  /**
   * 获取MCP端点
   */
  async getEndpoint(endpointId: string): Promise<MCPEndpoint | null> {
    try {
      const cacheKey = `endpoint:${endpointId}`;

      return await configCacheService.getOrSet(
        {
          scope: this.CACHE_SCOPE,
          key: cacheKey,
          version: this.DEFAULT_VERSION
        },
        async () => {
          const endpoint = await knex('mcp_endpoints').where('id', endpointId).first();

          if (endpoint) {
            return this.mapDbRowToEndpoint(endpoint);
          }

          return null;
        }
      );
    } catch (error: unknown) {
      logger.error(`获取MCP端点失败: ${endpointId}`, error);
      return null;
    }
  }

  /**
   * 获取MCP端点列表
   */
  async getEndpoints(
    filters: {
      status?: string;
      enabled?: boolean;
      healthy?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ endpoints: MCPEndpoint[]; total: number }> {
    const { status, enabled, healthy, page = 1, limit = 20 } = filters;

    try {
      let query = knex('mcp_endpoints').select('*');

      // 应用过滤条件
      if (status) {
        query = query.where('status', status);
      }
      if (enabled !== undefined) {
        query = query.where('enabled', enabled);
      }
      if (healthy !== undefined) {
        query = query.where('healthy', healthy);
      }

      // 获取总数
      const totalQuery = query.clone().clearSelect().count('* as count');
      const [{ count }] = await totalQuery;
      const total = parseInt(String(count));

      // 分页查询
      const offset = (page - 1) * limit;
      const endpoints = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

      const mappedEndpoints = endpoints.map((endpoint) => this.mapDbRowToEndpoint(endpoint));

      return { endpoints: mappedEndpoints, total };
    } catch (error: unknown) {
      logger.error('获取MCP端点列表失败:', error);
      return { endpoints: [], total: 0 };
    }
  }

  /**
   * 测试MCP端点连接
   */
  async testEndpoint(endpointId: string): Promise<MCPTestResult> {
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) {
      throw new Error('MCP端点不存在');
    }

    const startTime = Date.now();

    try {
      // 获取API密钥
      const apiKey = await kmsService.decrypt(endpoint.apiKeyId);

      // Stdio Support
      if (endpoint.endpointUrl.startsWith('stdio:')) {
        return this.testStdioEndpoint(endpoint);
      }

      // 执行MCP协议握手
      const response = await axios.post(
        `${endpoint.endpointUrl}/initialize`,
        {
          protocolVersion: endpoint.protocolVersion,
          capabilities: endpoint.capabilities,
          clientInfo: {
            name: 'CMS System',
            version: '1.0.0'
          }
        },
        {
          timeout: endpoint.timeoutMs,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const latency = Date.now() - startTime;

      if (response.status === 200) {
        const serverInfo = response.data as MCPInitializeResponse;

        // 发现工具
        const tools = await this.discoverTools(endpoint, apiKey);

        // 更新端点状态
        await this.updateEndpointStatus(endpointId, {
          status: 'active',
          healthy: true,
          lastSyncAt: new Date(),
          supportedTools: tools,
          capabilities: serverInfo.capabilities || []
        });

        logger.info('MCP端点测试成功', {
          endpointId,
          latency,
          toolsCount: tools.length,
          capabilities: serverInfo.capabilities?.length || 0
        });

        return {
          success: true,
          latency,
          toolsCount: tools.length,
          sampleTools: tools.slice(0, 5).map((t) => t.name),
          capabilities: serverInfo.capabilities || []
        };
      } else {
        throw new Error(`MCP握手失败: ${response.status}`);
      }
    } catch (error: unknown) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '连接失败';

      // 更新端点错误状态
      await this.updateEndpointStatus(endpointId, {
        status: 'error',
        healthy: false,
        lastError: errorMessage
      });

      logger.warn('MCP端点测试失败', { endpointId, error: errorMessage });

      return {
        success: false,
        latency,
        toolsCount: 0,
        sampleTools: [],
        capabilities: [],
        error: errorMessage
      };
    }
  }

  /**
   * 发现MCP工具
   */
  async discoverTools(endpoint: MCPEndpoint, apiKey: string): Promise<MCPTool[]> {
    try {
      const response = await axios.get(`${endpoint.endpointUrl}/tools`, {
        timeout: endpoint.timeoutMs,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const toolsData = response.data as MCPToolsResponse;
      if (response.status === 200 && toolsData.tools) {
        return toolsData.tools.map((tool: Record<string, unknown>) => ({
          name: tool.name as string,
          description: (tool.description as string) || '',
          inputSchema: (tool.inputSchema as Record<string, unknown>) || {},
          outputSchema: tool.outputSchema as Record<string, unknown> | undefined,
          category: (tool.category as string) || 'general',
          enabled: tool.enabled !== false,
          parameters: this.parseToolParameters((tool.inputSchema as Record<string, unknown>) || {})
        }));
      }

      return [];
    } catch (error: unknown) {
      logger.error(`发现MCP工具失败: ${endpoint.id}`, error);
      return [];
    }
  }

  /**
   * 执行MCP工具
   */
  async executeTool(
    endpointId: string,
    toolName: string,
    parameters: Record<string, unknown>,
    userId: string
  ): Promise<unknown> {
    const startTime = Date.now();
    const endpoint = await this.getEndpoint(endpointId);
    if (!endpoint) {
      throw new Error('MCP端点不存在');
    }

    if (endpoint.status !== 'active' || !endpoint.healthy) {
      throw new Error('MCP端点不可用');
    }

    try {
      // 获取API密钥
      const apiKey = await kmsService.decrypt(endpoint.apiKeyId);

      // Stdio Support
      if (endpoint.endpointUrl.startsWith('stdio:')) {
        return this.executeStdioTool(endpoint, toolName, parameters);
      }

      // 验证工具是否存在
      const tool = endpoint.supportedTools.find((t) => t.name === toolName);
      if (!tool) {
        throw new Error(`工具不存在: ${toolName}`);
      }

      // 验证参数
      this.validateToolParameters(tool, parameters);

      // 执行工具
      const response = await axios.post(
        `${endpoint.endpointUrl}/tools/${toolName}/execute`,
        {
          parameters,
          context: {
            userId,
            timestamp: new Date().toISOString()
          }
        },
        {
          timeout: endpoint.timeoutMs,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        const duration = Date.now() - startTime;
        logger.info('MCP工具执行成功', {
          endpointId,
          toolName,
          userId,
          duration
        });

        return response.data as unknown;
      } else {
        throw new Error(`工具执行失败: ${response.status}`);
      }
    } catch (error: unknown) {
      logger.error(`执行MCP工具失败: ${endpointId}/${toolName}`, {
        error,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * 批量测试所有端点
   */
  async testAllEndpoints(): Promise<{
    results: Array<{ id: string; name: string; result: MCPTestResult }>;
    summary: Record<string, unknown>;
  }> {
    const { endpoints } = await this.getEndpoints({ enabled: true });
    const testPromises: Promise<{ id: string; name: string; result: MCPTestResult }>[] = [];

    for (const endpoint of endpoints) {
      testPromises.push(
        this.testEndpoint(endpoint.id)
          .then((result) => ({ id: endpoint.id, name: endpoint.name, result }))
          .catch((error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : '测试失败';
            return {
              id: endpoint.id,
              name: endpoint.name,
              result: {
                success: false,
                latency: 0,
                toolsCount: 0,
                sampleTools: [],
                capabilities: [],
                error: errorMessage
              }
            };
          })
      );
    }

    const results = await Promise.allSettled(testPromises);
    const testResults = results.map((result) =>
      result.status === 'fulfilled'
        ? result.value
        : {
          id: 'unknown',
          name: 'unknown',
          result: {
            success: false,
            latency: 0,
            toolsCount: 0,
            sampleTools: [],
            capabilities: [],
            error: 'Test failed'
          }
        }
    );

    // 统计结果
    const successCount = testResults.filter((r) => r.result.success).length;
    const totalCount = testResults.length;

    const summary = {
      total: totalCount,
      success: successCount,
      failed: totalCount - successCount,
      successRate: totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(2) : 0,
      totalTools: testResults.reduce((sum, r) => sum + (r.result.toolsCount || 0), 0)
    };

    logger.info('批量MCP端点测试完成', summary);

    return { results: testResults, summary };
  }

  /**
   * 同步所有端点的工具
   */
  async syncAllEndpoints(): Promise<{ updated: number; errors: string[] }> {
    const { endpoints } = await this.getEndpoints({ enabled: true, status: 'active' });
    let updated = 0;
    const errors: string[] = [];

    for (const endpoint of endpoints) {
      try {
        await this.testEndpoint(endpoint.id);
        updated++;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`${endpoint.name}: ${errorMessage}`);
      }
    }

    logger.info('MCP端点同步完成', { updated, errors: errors.length });

    return { updated, errors };
  }

  /**
   * 获取端点统计信息
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalTools: number;
    activeTools: number;
    healthyEndpoints: number;
    enabledEndpoints: number;
  }> {
    try {
      const [statusStats, totalEndpoints] = await Promise.all([
        knex('mcp_endpoints').select('status').count('* as count').groupBy('status'),
        knex('mcp_endpoints').count('* as total').first()
      ]);

      const statusRows = statusStats as Array<{
        status: string;
        count: string | number | bigint | null;
      }>;
      const { endpoints } = await this.getEndpoints();
      const totalTools = endpoints.reduce((sum, ep) => sum + (ep.supportedTools?.length || 0), 0);
      const activeTools = endpoints
        .filter((ep) => ep.status === 'active' && ep.healthy)
        .reduce((sum, ep) => sum + (ep.supportedTools?.length || 0), 0);

      return {
        total: (totalEndpoints?.total as number) || 0,
        byStatus: statusRows.reduce(
          (acc, row) => {
            acc[row.status] = Number(row.count ?? 0);
            return acc;
          },
          {} as Record<string, number>
        ),
        totalTools,
        activeTools,
        healthyEndpoints: endpoints.filter((ep) => ep.healthy).length,
        enabledEndpoints: endpoints.filter((ep) => ep.enabled).length
      };
    } catch (error: unknown) {
      logger.error('获取MCP端点统计失败:', error);
      return {
        total: 0,
        byStatus: {},
        totalTools: 0,
        activeTools: 0,
        healthyEndpoints: 0,
        enabledEndpoints: 0
      };
    }
  }

  /**
   * 更新端点状态
   */
  private async updateEndpointStatus(
    endpointId: string,
    statusUpdate: {
      status?: string;
      healthy?: boolean;
      lastSyncAt?: Date;
      lastError?: string;
      supportedTools?: MCPTool[];
      capabilities?: string[];
    }
  ): Promise<void> {
    const updateFields: Record<string, unknown> = {
      updated_at: new Date()
    };

    if (statusUpdate.status) updateFields.status = statusUpdate.status;
    if (statusUpdate.healthy !== undefined) updateFields.healthy = statusUpdate.healthy;
    if (statusUpdate.lastSyncAt) updateFields.last_sync_at = statusUpdate.lastSyncAt;
    if (statusUpdate.lastError) updateFields.last_error = statusUpdate.lastError;
    if (statusUpdate.supportedTools)
      updateFields.supported_tools = JSON.stringify(statusUpdate.supportedTools);
    if (statusUpdate.capabilities)
      updateFields.capabilities = JSON.stringify(statusUpdate.capabilities);

    await knex('mcp_endpoints').where('id', endpointId).update(updateFields);

    // 失效缓存
    await this.invalidateCache();
  }

  /**
   * 解析工具参数
   */
  private parseToolParameters(inputSchema: Record<string, unknown>): MCPParameter[] {
    const parameters: MCPParameter[] = [];

    if (inputSchema.properties && typeof inputSchema.properties === 'object') {
      for (const [name, schema] of Object.entries(
        inputSchema.properties as Record<string, unknown>
      )) {
        const s = schema as Record<string, unknown>;
        parameters.push({
          name,
          type: (s.type as string) || 'string',
          required: (inputSchema.required as unknown[])?.includes(name) || false,
          description: (s.description as string) || '',
          defaultValue: s.default,
          validation: {
            min: s.minimum as number | undefined,
            max: s.maximum as number | undefined,
            pattern: s.pattern as string | undefined,
            enum: s.enum as unknown[] | undefined
          }
        });
      }
    }

    return parameters;
  }

  /**
   * 验证工具参数
   */
  private validateToolParameters(tool: MCPTool, parameters: Record<string, unknown>): void {
    for (const param of tool.parameters) {
      const value = parameters[param.name];

      // 检查必需参数
      if (param.required && (value === undefined || value === null)) {
        throw new Error(`缺少必需参数: ${param.name}`);
      }

      // 类型检查
      if (value !== undefined && value !== null) {
        if (param.type === 'string' && typeof value !== 'string') {
          throw new Error(`参数类型错误: ${param.name} 应为字符串`);
        }
        if (param.type === 'number' && typeof value !== 'number') {
          throw new Error(`参数类型错误: ${param.name} 应为数字`);
        }
        if (param.type === 'boolean' && typeof value !== 'boolean') {
          throw new Error(`参数类型错误: ${param.name} 应为布尔值`);
        }

        // 数值范围检查
        if (typeof value === 'number') {
          if (param.validation?.min !== undefined && value < param.validation.min) {
            throw new Error(`参数值过小: ${param.name} 最小值为 ${param.validation.min}`);
          }
          if (param.validation?.max !== undefined && value > param.validation.max) {
            throw new Error(`参数值过大: ${param.name} 最大值为 ${param.validation.max}`);
          }
        }

        // 枚举值检查
        if (param.validation?.enum && !param.validation.enum.includes(value)) {
          throw new Error(
            `参数值无效: ${param.name} 必须为 ${param.validation.enum.join(', ')} 之一`
          );
        }

        // 正则表达式检查
        if (typeof value === 'string' && param.validation?.pattern) {
          const regex = new RegExp(param.validation.pattern);
          if (!regex.test(value)) {
            throw new Error(`参数格式错误: ${param.name} 不匹配模式 ${param.validation.pattern}`);
          }
        }
      }
    }
  }

  /**
   * 将数据库行映射为MCPEndpoint对象
   */
  private mapDbRowToEndpoint(row: Record<string, unknown>): MCPEndpoint {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      endpointUrl: row.endpoint_url as string,
      apiKeyId: row.api_key as string,
      protocolVersion: row.protocol_version as string,
      capabilities: row.capabilities ? JSON.parse(row.capabilities as string) : [],
      supportedTools: row.supported_tools ? JSON.parse(row.supported_tools as string) : [],
      status: row.status as 'active' | 'inactive' | 'error',
      lastSyncAt: row.last_sync_at as Date | undefined,
      lastError: row.last_error as string | undefined,
      healthy: Boolean(row.healthy),
      timeoutMs: row.timeout_ms as number,
      maxRetries: row.max_retries as number,
      enabled: Boolean(row.enabled),
      metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
      createdBy: row.created_by as string,
      updatedBy: row.updated_by as string,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date
    };
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * stdio 端点高危：仅在显式允许时才接受
   */
  private assertStdioAllowed(endpointUrl?: string) {
    if (endpointUrl && endpointUrl.startsWith('stdio:')) {
      const allowed = process.env.ALLOW_MCP_STDIO === 'true';
      if (!allowed) {
        throw new Error('Stdio MCP 端点已禁用，请设置 ALLOW_MCP_STDIO=true 后再试');
      }
    }
  }

  /**
   * ==========================================
   * Stdio Transport Support (Local Processes)
   * ==========================================
   */

  private async connectStdio(endpoint: MCPEndpoint): Promise<void> {
    if (MCPEndpointsService.activeProcesses.has(endpoint.id)) return;

    // Format: "stdio:command arg1 arg2"
    const cmdStr = endpoint.endpointUrl.replace('stdio:', '');
    const parts = cmdStr.split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    logger.info(`[MCP] Spawning Stdio process: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32' // Use shell on Windows for npx capability
    });

    const pendingRequests = new Map<number, (response: any) => void>();

    if (!child.stdin || !child.stdout) {
      throw new Error('Failed to spawn process with stdin/stdout');
    }

    const rl = readline.createInterface({ input: child.stdout });

    rl.on('line', (line) => {
      try {
        if (!line.trim()) return;
        const json = JSON.parse(line);

        // Response to request
        if (json.id !== undefined && pendingRequests.has(json.id)) {
          const resolve = pendingRequests.get(json.id);
          pendingRequests.delete(json.id);
          resolve && resolve(json);
        } else if (json.method === 'notifications/message') {
          logger.info('[MCP Notification]', json.params);
        }
      } catch (e) {
        // Ignore JSON parse errors from partial lines or stdout noise
      }
    });

    child.stderr?.on('data', (data) => {
      logger.warn(`[MCP Stderr] (${endpoint.name}): ${data}`);
    });

    child.on('error', (err) => {
      logger.error(`[MCP Process Error] (${endpoint.name}):`, err);
      MCPEndpointsService.activeProcesses.delete(endpoint.id);
    });

    child.on('exit', (code) => {
      logger.info(`[MCP Process Exited] (${endpoint.name}): ${code}`);
      MCPEndpointsService.activeProcesses.delete(endpoint.id);
    });

    MCPEndpointsService.activeProcesses.set(endpoint.id, {
      process: child,
      pendingRequests,
      requestCounter: 0,
      errorHandler: (err) => logger.error('MCP Error', err)
    });

    // Give it a moment to boot
    await new Promise(r => setTimeout(r, 1000));
  }

  private async sendStdioRequest(endpointId: string, method: string, params?: any): Promise<any> {
    const state = MCPEndpointsService.activeProcesses.get(endpointId);
    if (!state) throw new Error('Not connected to Stdio process');

    const id = ++state.requestCounter;
    const request = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        state.pendingRequests.delete(id);
        reject(new Error('MCP Request timeout'));
      }, 30000);

      state.pendingRequests.set(id, (response) => {
        clearTimeout(timeout);
        if (response.error) reject(new Error(response.error.message || 'MCP Error'));
        else resolve(response.result);
      });

      try {
        state.process.stdin!.write(JSON.stringify(request) + '\n');
      } catch (err) {
        reject(err);
      }
    });
  }

  private async testStdioEndpoint(endpoint: MCPEndpoint): Promise<MCPTestResult> {
    const startTime = Date.now();
    try {
      await this.connectStdio(endpoint);

      // 1. Initialize
      await this.sendStdioRequest(endpoint.id, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'AIPlatform', version: '1.0' }
      });

      // 2. Initialized Notification
      const state = MCPEndpointsService.activeProcesses.get(endpoint.id);
      state?.process.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

      // 3. List Tools
      const toolsRes = await this.sendStdioRequest(endpoint.id, 'tools/list');

      const tools = (toolsRes.tools || []).map((t: any) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || {},
        category: 'general', // Default category
        enabled: true,
        parameters: this.parseToolParameters(t.inputSchema || {})
      }));

      await this.updateEndpointStatus(endpoint.id, {
        status: 'active',
        healthy: true,
        lastSyncAt: new Date(),
        supportedTools: tools,
        capabilities: []
      });

      return {
        success: true,
        latency: Date.now() - startTime,
        toolsCount: tools.length,
        sampleTools: tools.slice(0, 5).map((t: any) => t.name),
        capabilities: []
      };

    } catch (error: any) {
      logger.error('Stdio Test Failed', error);

      // Cleanup on failure
      MCPEndpointsService.activeProcesses.get(endpoint.id)?.process.kill();
      MCPEndpointsService.activeProcesses.delete(endpoint.id);

      await this.updateEndpointStatus(endpoint.id, {
        status: 'error',
        healthy: false,
        lastError: error.message
      });

      return {
        success: false,
        latency: 0,
        toolsCount: 0,
        sampleTools: [],
        capabilities: [],
        error: error.message
      };
    }
  }

  private async executeStdioTool(endpoint: MCPEndpoint, toolName: string, args: any): Promise<any> {
    await this.connectStdio(endpoint);
    const res = await this.sendStdioRequest(endpoint.id, 'tools/call', {
      name: toolName,
      arguments: args
    });
    return res;
  }

  /**
   * 失效缓存
   */
  private async invalidateCache(): Promise<void> {
    await configCacheService.invalidate(this.CACHE_SCOPE);
  }
}

const mcpEndpointsService = new MCPEndpointsService();

// 导出类实例的所有方法
export const createEndpoint = mcpEndpointsService.createEndpoint.bind(mcpEndpointsService);
export const updateEndpoint = mcpEndpointsService.updateEndpoint.bind(mcpEndpointsService);
export const deleteEndpoint = mcpEndpointsService.deleteEndpoint.bind(mcpEndpointsService);
export const getEndpoint = mcpEndpointsService.getEndpoint.bind(mcpEndpointsService);
export const getEndpoints = mcpEndpointsService.getEndpoints.bind(mcpEndpointsService);
export const testEndpoint = mcpEndpointsService.testEndpoint.bind(mcpEndpointsService);
export const testAllEndpoints = mcpEndpointsService.testAllEndpoints.bind(mcpEndpointsService);
export const syncAllEndpoints = mcpEndpointsService.syncAllEndpoints.bind(mcpEndpointsService);
export const executeTool = mcpEndpointsService.executeTool.bind(mcpEndpointsService);
export const getStats = mcpEndpointsService.getStats.bind(mcpEndpointsService);

export default mcpEndpointsService;
