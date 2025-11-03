const mcpEndpointService = require('../services/mcpEndpoint.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * MCP Endpoint 控制器
 */
class McpEndpointController {
  /**
   * 获取端点列表
   */
  async getEndpoints(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        server_type,
        status,
        enabled,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const result = await mcpEndpointService.getEndpoints({
        page: parseInt(page),
        limit: parseInt(limit),
        server_type,
        status,
        enabled,
        search,
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        data: result,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[McpEndpointController] Get endpoints failed:', error);
      next(error);
    }
  }

  /**
   * 获取端点详情
   */
  async getEndpointById(req, res, next) {
    try {
      const { id } = req.params;
      const endpoint = await mcpEndpointService.getEndpointById(id);

      res.json({
        success: true,
        data: endpoint,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[McpEndpointController] Get endpoint by ID failed:', error);
      next(error);
    }
  }

  /**
   * 创建端点
   */
  async createEndpoint(req, res, next) {
    try {
      const userId = req.user.id;
      const endpointData = {
        ...req.body,
        created_by: userId
      };

      const endpoint = await mcpEndpointService.createEndpoint(endpointData, userId);

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

  /**
   * 更新端点
   */
  async updateEndpoint(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = {
        ...req.body,
        updated_by: userId
      };

      const endpoint = await mcpEndpointService.updateEndpoint(id, updateData, userId);

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

  /**
   * 删除端点
   */
  async deleteEndpoint(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await mcpEndpointService.deleteEndpoint(id, userId);

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

  /**
   * 测试端点连接
   */
  async testEndpoint(req, res, next) {
    try {
      const { id } = req.params;

      const result = await mcpEndpointService.testEndpoint(id);

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

  /**
   * 连接端点
   */
  async connectEndpoint(req, res, next) {
    try {
      const { id } = req.params;

      const connection = await mcpEndpointService.connectEndpoint(id);

      res.json({
        success: true,
        data: { connection_id: id, connected: true },
        message: '端点连接成功',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[McpEndpointController] Connect endpoint failed:', error);
      next(error);
    }
  }

  /**
   * 断开端点连接
   */
  async disconnectEndpoint(req, res, next) {
    try {
      const { id } = req.params;

      await mcpEndpointService.disconnectEndpoint(id);

      res.json({
        success: true,
        message: '端点连接已断开',
        requestId: req.id
      });

    } catch (error) {
      logger.error('[McpEndpointController] Disconnect endpoint failed:', error);
      next(error);
    }
  }

  /**
   * 发现工具
   */
  async discoverTools(req, res, next) {
    try {
      const { id } = req.params;

      const tools = await mcpEndpointService.discoverTools(id);

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

  /**
   * 执行工具
   */
  async executeTool(req, res, next) {
    try {
      const { id } = req.params;
      const { tool_name, arguments: toolArgs } = req.body;

      if (!tool_name) {
        throw new AppError('工具名称不能为空', 400);
      }

      const result = await mcpEndpointService.executeTool(id, tool_name, toolArgs || {});

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

  /**
   * 批量测试端点
   */
  async batchTestEndpoints(req, res, next) {
    try {
      const { endpoint_ids } = req.body;

      if (!endpoint_ids || !Array.isArray(endpoint_ids)) {
        throw new AppError('请提供端点ID列表', 400);
      }

      const results = [];
      let success_count = 0;
      let failed_count = 0;

      for (const endpointId of endpoint_ids) {
        try {
          const result = await mcpEndpointService.testEndpoint(endpointId);
          results.push({
            endpoint_id: endpointId,
            success: true,
            result: result
          });
          if (result.success) {
            success_count++;
          } else {
            failed_count++;
          }
        } catch (error) {
          results.push({
            endpoint_id: endpointId,
            success: false,
            error: error.message
          });
          failed_count++;
        }
      }

      res.json({
        success: true,
        data: {
          results: results,
          summary: {
            total: endpoint_ids.length,
            success: success_count,
            failed: failed_count
          }
        },
        message: `批量测试完成: ${success_count} 成功, ${failed_count} 失败`,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[McpEndpointController] Batch test endpoints failed:', error);
      next(error);
    }
  }

  /**
   * 获取端点统计
   */
  async getEndpointStats(req, res, next) {
    try {
      const result = await mcpEndpointService.getEndpoints({ limit: 1000 });
      const endpoints = result.endpoints;

      const stats = {
        total_endpoints: endpoints.length,
        by_status: {},
        by_server_type: {},
        enabled_endpoints: 0,
        total_tools: 0,
        last_test_results: {
          passed: 0,
          failed: 0
        }
      };

      for (const endpoint of endpoints) {
        // 按状态统计
        stats.by_status[endpoint.status] = (stats.by_status[endpoint.status] || 0) + 1;

        // 按服务器类型统计
        stats.by_server_type[endpoint.server_type] = (stats.by_server_type[endpoint.server_type] || 0) + 1;

        // 启用的端点数
        if (endpoint.enabled) {
          stats.enabled_endpoints++;
        }

        // 工具总数
        if (endpoint.available_tools && Array.isArray(endpoint.available_tools)) {
          stats.total_tools += endpoint.available_tools.length;
        }

        // 测试结果统计
        if (endpoint.last_test_result) {
          if (endpoint.last_test_result.success) {
            stats.last_test_results.passed++;
          } else {
            stats.last_test_results.failed++;
          }
        }
      }

      res.json({
        success: true,
        data: stats,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[McpEndpointController] Get endpoint stats failed:', error);
      next(error);
    }
  }

  /**
   * 获取服务器类型列表
   */
  async getServerTypes(req, res, next) {
    try {
      const serverTypes = [
        { value: 'stdio', label: 'STDIO', description: '标准输入输出进程通信' },
        { value: 'http', label: 'HTTP', description: 'HTTP REST API' },
        { value: 'websocket', label: 'WebSocket', description: 'WebSocket双向通信' }
      ];

      res.json({
        success: true,
        data: serverTypes,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[McpEndpointController] Get server types failed:', error);
      next(error);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(req, res, next) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'mcp-endpoint',
        active_connections: mcpEndpointService.activeConnections.size,
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      };

      res.json({
        success: true,
        data: health,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[McpEndpointController] Health check failed:', error);
      next(error);
    }
  }

  /**
   * 获取模板配置
   */
  async getTemplates(req, res, next) {
    try {
      const templates = {
        stdio: {
          name: 'Python MCP Server',
          description: '基于Python的MCP服务器',
          server_type: 'stdio',
          connection_string: 'python mcp_server.py',
          connection_config: {
            cwd: '/path/to/server',
            env: {
              PYTHONPATH: '/path/to/lib'
            }
          },
          auth_config: {}
        },
        http: {
          name: 'HTTP MCP Server',
          description: '基于HTTP的MCP服务器',
          server_type: 'http',
          connection_string: 'http://localhost:8080/mcp',
          connection_config: {
            timeout: 30000,
            retries: 3
          },
          auth_config: {
            type: 'bearer',
            token: 'your-api-token'
          }
        },
        websocket: {
          name: 'WebSocket MCP Server',
          description: '基于WebSocket的MCP服务器',
          server_type: 'websocket',
          connection_string: 'ws://localhost:8080/mcp',
          connection_config: {
            timeout: 30000,
            heartbeat: 30000
          },
          auth_config: {
            type: 'api_key',
            key: 'your-api-key'
          }
        }
      };

      res.json({
        success: true,
        data: templates,
        requestId: req.id
      });

    } catch (error) {
      logger.error('[McpEndpointController] Get templates failed:', error);
      next(error);
    }
  }
}

module.exports = new McpEndpointController();