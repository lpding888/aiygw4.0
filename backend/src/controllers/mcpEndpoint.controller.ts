import type { Request, Response, NextFunction } from 'express';
import mcpEndpointService from '../services/mcpEndpoint.service.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';

class McpEndpointController {
  async getEndpointStats(_req: Request, res: Response, _next: NextFunction) {
    try {
      // 简单聚合：返回内存/DB中的统计（以 service 常量为依据）
      const stats = {
        total: undefined as any,
        active: undefined as any,
        inactive: undefined as any,
        error: undefined as any
      };
      const list = await mcpEndpointService.getEndpoints({ page: 1, limit: 1000 });
      const endpoints = (list?.endpoints ?? []) as any[];
      stats.total = endpoints.length;
      stats.active = endpoints.filter((e) => e.status === 'active').length;
      stats.inactive = endpoints.filter((e) => e.status === 'inactive').length;
      stats.error = endpoints.filter((e) => e.status === 'error').length;
      res.json({ success: true, data: stats });
    } catch (error) {
      res.json({ success: true, data: { total: 0, active: 0, inactive: 0, error: 0 } });
    }
  }

  async getServerTypes(_req: Request, res: Response) {
    res.json({ success: true, data: ['stdio', 'http', 'websocket'] });
  }

  async getTemplates(_req: Request, res: Response) {
    // 预留：返回空列表占位，避免前端报错
    res.json({ success: true, data: [] });
  }

  async healthCheck(_req: Request, res: Response) {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  }
  async getEndpoints(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page = '1',
        limit = '20',
        server_type,
        status,
        enabled,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = (req.query ?? {}) as any;
      const result = await mcpEndpointService.getEndpoints({
        page: Number.parseInt(String(page), 10),
        limit: Number.parseInt(String(limit), 10),
        server_type,
        status,
        enabled,
        search,
        sortBy,
        sortOrder
      });
      res.json({ success: true, data: result, requestId: (req as any).id });
    } catch (error) {
      logger.error('[McpEndpointController] Get endpoints failed:', error as any);
      next(error);
    }
  }

  async getEndpointById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const endpoint = await mcpEndpointService.getEndpointById(id);
      res.json({ success: true, data: endpoint, requestId: (req as any).id });
    } catch (error) {
      logger.error('[McpEndpointController] Get endpoint by ID failed:', error as any);
      next(error);
    }
  }

  async createEndpoint(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id as string;
      const endpointData = { ...(req.body ?? {}), created_by: userId };
      const endpoint = await mcpEndpointService.createEndpoint(endpointData, userId);
      res.status(201).json({
        success: true,
        data: endpoint,
        message: 'MCP端点创建成功',
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Create endpoint failed:', error as any);
      next(error);
    }
  }

  async updateEndpoint(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const userId = (req as any).user?.id as string;
      const updateData = { ...(req.body ?? {}), updated_by: userId };
      const endpoint = await mcpEndpointService.updateEndpoint(id, updateData, userId);
      res.json({
        success: true,
        data: endpoint,
        message: 'MCP端点更新成功',
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Update endpoint failed:', error as any);
      next(error);
    }
  }

  async deleteEndpoint(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const userId = (req as any).user?.id as string;
      await mcpEndpointService.deleteEndpoint(id, userId);
      res.json({ success: true, message: 'MCP端点删除成功', requestId: (req as any).id });
    } catch (error) {
      logger.error('[McpEndpointController] Delete endpoint failed:', error as any);
      next(error);
    }
  }

  async testEndpoint(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const result = await mcpEndpointService.testEndpoint(id);
      res.json({
        success: true,
        data: result,
        message: result.success ? '端点连接测试成功' : '端点连接测试失败',
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Test endpoint failed:', error as any);
      next(error);
    }
  }

  async connectEndpoint(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      await mcpEndpointService.connectEndpoint(id);
      res.json({
        success: true,
        data: { connection_id: id, connected: true },
        message: '端点连接成功',
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Connect endpoint failed:', error as any);
      next(error);
    }
  }

  async disconnectEndpoint(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      await mcpEndpointService.disconnectEndpoint(id);
      res.json({ success: true, message: '端点连接已断开', requestId: (req as any).id });
    } catch (error) {
      logger.error('[McpEndpointController] Disconnect endpoint failed:', error as any);
      next(error);
    }
  }

  async discoverTools(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const tools = await mcpEndpointService.discoverTools(id);
      res.json({
        success: true,
        data: tools,
        message: `发现 ${tools.length} 个工具`,
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Discover tools failed:', error as any);
      next(error);
    }
  }

  async executeTool(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const { tool_name, arguments: toolArgs } = (req.body ?? {}) as any;
      if (!tool_name)
        throw AppError.custom(ERROR_CODES.INVALID_PARAMETERS as any, '工具名称不能为空');
      const result = await mcpEndpointService.executeTool(id, tool_name, toolArgs || {});
      res.json({
        success: true,
        data: result,
        message: '工具执行成功',
        requestId: (req as any).id
      });
    } catch (error) {
      logger.error('[McpEndpointController] Execute tool failed:', error as any);
      next(error);
    }
  }

  async batchTestEndpoints(req: Request, res: Response, next: NextFunction) {
    try {
      const { endpoint_ids } = (req.body ?? {}) as { endpoint_ids?: string[] };
      if (!endpoint_ids || !Array.isArray(endpoint_ids))
        throw AppError.custom(ERROR_CODES.INVALID_PARAMETERS as any, '请提供端点ID列表');
      const results = await Promise.allSettled(
        endpoint_ids.map((id) => mcpEndpointService.testEndpoint(id))
      );
      const summary = results.reduce(
        (acc, r) => {
          if (r.status === 'fulfilled' && (r.value as any)?.success) acc.success += 1;
          else acc.failed += 1;
          acc.total += 1;
          return acc;
        },
        { total: 0, success: 0, failed: 0 }
      );
      res.json({ success: true, data: { results, summary }, requestId: (req as any).id });
    } catch (error) {
      logger.error('[McpEndpointController] Batch test endpoints failed:', error as any);
      next(error);
    }
  }
}

export default new McpEndpointController();
