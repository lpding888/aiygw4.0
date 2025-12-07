import type { Request, Response, NextFunction } from 'express';
import mcpEndpointsService from '../services/mcp-endpoints.service.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import type {
  EndpointQueryOptions,
  McpEndpoint,
  EndpointTestResult,
  BatchTestRequest,
  BatchTestSummary,
  ExecuteToolRequest,
  EndpointStats,
  EndpointStatus
} from '../types/mcp-endpoint.types.js';

const parseEndpointStatus = (value: unknown): EndpointStatus | undefined => {
  if (value === 'active' || value === 'inactive' || value === 'error') {
    return value;
  }
  return undefined;
};

const parseBooleanFlag = (value: unknown): boolean | undefined => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (typeof value === 'boolean') return value;
  return undefined;
};

const requireUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权操作');
  }
  return userId;
};

class McpEndpointController {
  async getEndpointStats(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const stats: EndpointStats = await mcpEndpointsService.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      res.json({
        success: true,
        data: {
          total: 0,
          byStatus: {},
          totalTools: 0,
          activeTools: 0,
          healthyEndpoints: 0,
          enabledEndpoints: 0
        }
      });
    }
  }

  async getServerTypes(_req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: ['stdio', 'http', 'websocket'] });
  }

  async getTemplates(_req: Request, res: Response): Promise<void> {
    // 预留：返回空列表占位，避免前端报错
    res.json({ success: true, data: [] });
  }

  async healthCheck(_req: Request, res: Response): Promise<void> {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  }

  async getEndpoints(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as Record<string, string | undefined>;
      const sortOrderParam = (query.sortOrder ?? 'desc').toLowerCase();
      const options: EndpointQueryOptions = {
        page: Number.parseInt(query.page ?? '1', 10) || 1,
        limit: Number.parseInt(query.limit ?? '20', 10) || 20,
        status: parseEndpointStatus(query.status),
        enabled: parseBooleanFlag(query.enabled),
        healthy: parseBooleanFlag(query.healthy)
      };
      // 排序目前由DB默认 created_at desc
      const result = await mcpEndpointsService.getEndpoints(options);
      res.json({ success: true, data: result, requestId: req.id, sortOrder: sortOrderParam });
    } catch (error) {
      logger.error('[McpEndpointController] Get endpoints failed:', error);
      next(error);
    }
  }

  async getEndpointById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const endpoint = await mcpEndpointsService.getEndpoint(id);
      if (!endpoint) {
        throw AppError.custom(ERROR_CODES.RESOURCE_NOT_FOUND, 'MCP端点不存在');
      }
      res.json({ success: true, data: endpoint, requestId: req.id });
    } catch (error) {
      logger.error('[McpEndpointController] Get endpoint by ID failed:', error);
      next(error);
    }
  }

  async createEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const {
        name,
        endpointUrl,
        apiKey,
        description,
        protocolVersion,
        capabilities,
        timeoutMs,
        maxRetries,
        enabled
      } = req.body ?? {};

      if (!name || !endpointUrl || !apiKey) {
        throw AppError.custom(ERROR_CODES.INVALID_PARAMETERS, '缺少必要参数: name/endpointUrl/apiKey');
      }

      const endpoint = await mcpEndpointsService.createEndpoint(
        {
          name,
          endpointUrl,
          description,
          protocolVersion,
          capabilities,
          timeoutMs,
          maxRetries,
          enabled
        },
        { apiKey },
        userId
      );
      res.status(201).json({
        success: true,
        data: endpoint,
        message: 'MCP端点创建成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Create endpoint failed:', error);
      next(error);
    }
  }

  async updateEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = requireUserId(req);
      const updateData = { ...(req.body ?? {}), updatedBy: userId };
      const endpoint = await mcpEndpointsService.updateEndpoint(id, updateData, userId);
      res.json({
        success: true,
        data: endpoint,
        message: 'MCP端点更新成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Update endpoint failed:', error);
      next(error);
    }
  }

  async deleteEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = requireUserId(req);
      await mcpEndpointsService.deleteEndpoint(id, userId);
      res.json({
        success: true,
        message: 'MCP端点删除成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Delete endpoint failed:', error);
      next(error);
    }
  }

  async testEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const result: EndpointTestResult = await mcpEndpointsService.testEndpoint(id);
      res.json({
        success: true,
        data: result,
        message: result.success ? '端点连接测试成功' : '端点连接测试失败',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Test endpoint failed:', error);
      next(error);
    }
  }

  async connectEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      // 新版服务不维护持久连接，兼容性实现：执行一次测试作为连接校验
      await mcpEndpointsService.testEndpoint(id);
      res.json({
        success: true,
        data: { connection_id: id, connected: true },
        message: '端点连接成功（已完成连通性测试）',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Connect endpoint failed:', error);
      next(error);
    }
  }

  async disconnectEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      res.json({
        success: true,
        message: '端点连接已断开（无持久连接可释放）',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Disconnect endpoint failed:', error);
      next(error);
    }
  }

  async discoverTools(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      // 使用测试动作触发工具刷新，然后读取最新工具列表
      await mcpEndpointsService.testEndpoint(id);
      const endpoint = await mcpEndpointsService.getEndpoint(id);
      const tools = endpoint?.supportedTools ?? [];
      res.json({
        success: true,
        data: tools,
        message: `发现 ${tools.length} 个工具`,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Discover tools failed:', error);
      next(error);
    }
  }

  async executeTool(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { tool_name, toolName, arguments: toolArgs } = (req.body ?? {}) as ExecuteToolRequest & {
        toolName?: string;
      };
      const resolvedTool = tool_name || toolName;
      if (!resolvedTool) {
        throw AppError.custom(ERROR_CODES.INVALID_PARAMETERS, '工具名称不能为空');
      }
      const userId = requireUserId(req);
      const result = await mcpEndpointsService.executeTool(id, resolvedTool, toolArgs || {}, userId);
      res.json({
        success: true,
        data: result,
        message: '工具执行成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Execute tool failed:', error);
      next(error);
    }
  }

  async batchTestEndpoints(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { endpoint_ids } = (req.body ?? {}) as BatchTestRequest;
      if (!endpoint_ids || !Array.isArray(endpoint_ids)) {
        throw AppError.custom(ERROR_CODES.INVALID_PARAMETERS, '请提供端点ID列表');
      }
      const results = await Promise.allSettled(
        endpoint_ids.map((id) => mcpEndpointsService.testEndpoint(id))
      );
      const summary: BatchTestSummary = results.reduce(
        (acc, r) => {
          if (r.status === 'fulfilled' && (r.value as EndpointTestResult)?.success) {
            acc.success += 1;
          } else {
            acc.failed += 1;
          }
          acc.total += 1;
          return acc;
        },
        { total: 0, success: 0, failed: 0 }
      );
      res.json({
        success: true,
        data: { results, summary },
        requestId: req.id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Batch test endpoints failed:', error);
      next(error);
    }
  }
}

export default new McpEndpointController();
