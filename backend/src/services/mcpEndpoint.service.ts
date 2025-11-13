// @ts-nocheck
import { spawn } from 'child_process';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';

/**
 * MCP Endpoint 服务
 * 支持多种连接方式：stdio、http、websocket
 */
class McpEndpointService {
  constructor() {
    this.SERVER_TYPES = {
      STDIO: 'stdio',
      HTTP: 'http',
      WEBSOCKET: 'websocket'
    };

    this.ENDPOINT_STATUS = {
      INACTIVE: 'inactive',
      ACTIVE: 'active',
      ERROR: 'error'
    };

    this.TOOL_STATUS = {
      ACTIVE: 'active',
      INACTIVE: 'inactive',
      ERROR: 'error'
    };

    // 存储活跃连接
    this.activeConnections = new Map();
    this.connectionTimeouts = new Map();
  }

  /**
   * 创建MCP端点
   */
  async createEndpoint(endpointData, userId) {
    try {
      const endpoint = {
        id: this.generateId(),
        ...endpointData,
        enabled: endpointData.enabled !== false,
        status: this.ENDPOINT_STATUS.INACTIVE,
        timeout: endpointData.timeout || 30000,
        retry_count: endpointData.retry_count || 3,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 验证配置
      this.validateEndpointConfig(endpoint);

      // 如果数据库不可用，暂时存储在内存中
      if (!this.isDatabaseAvailable()) {
        logger.warn('[McpEndpointService] Database not available, storing in memory');
        this.storeEndpointInMemory(endpoint);
      } else {
        // 存储到数据库
        const db = require('../config/database');
        await db('mcp_endpoints').insert(endpoint);
      }

      logger.info(`[McpEndpointService] Created MCP endpoint: ${endpoint.id}`, {
        name: endpoint.name,
        type: endpoint.server_type
      });

      return endpoint;
    } catch (error) {
      logger.error('[McpEndpointService] Create endpoint failed:', error);
      throw new AppError('创建MCP端点失败', 500);
    }
  }

  /**
   * 获取端点列表
   */
  async getEndpoints(options = {}) {
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
      } = options;

      if (!this.isDatabaseAvailable()) {
        return this.getEndpointsFromMemory(options);
      }

      const db = require('../config/database');
      let query = db('mcp_endpoints').select([
        'id',
        'name',
        'description',
        'server_type',
        'connection_string',
        'enabled',
        'status',
        'timeout',
        'retry_count',
        'last_connected_at',
        'last_tested_at',
        'server_info',
        'available_tools',
        'created_at',
        'updated_at'
      ]);

      // 过滤条件
      if (server_type) {
        query = query.where('server_type', server_type);
      }
      if (status) {
        query = query.where('status', status);
      }
      if (enabled !== undefined) {
        query = query.where('enabled', enabled === 'true');
      }
      if (search) {
        query = query.where(function () {
          this.where('name', 'like', `%${search}%`).orWhere('description', 'like', `%${search}%`);
        });
      }

      // 排序
      query = query.orderBy(sortBy, sortOrder);

      // 分页
      const offset = (page - 1) * limit;
      const results = await query.limit(limit).offset(offset);

      // 获取总数
      const totalCount = await db('mcp_endpoints')
        .where(function () {
          if (server_type) this.where('server_type', server_type);
          if (status) this.where('status', status);
          if (enabled !== undefined) this.where('enabled', enabled === 'true');
          if (search) {
            this.where('name', 'like', `%${search}%`).orWhere('description', 'like', `%${search}%`);
          }
        })
        .count('* as total')
        .first();

      return {
        endpoints: results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount.total,
          pages: Math.ceil(totalCount.total / limit)
        }
      };
    } catch (error) {
      logger.error('[McpEndpointService] Get endpoints failed:', error);
      // 如果数据库失败，返回内存中的数据
      return this.getEndpointsFromMemory(options);
    }
  }

  /**
   * 根据ID获取端点
   */
  async getEndpointById(id) {
    try {
      if (!this.isDatabaseAvailable()) {
        return this.getEndpointFromMemory(id);
      }

      const db = require('../config/database');
      const endpoint = await db('mcp_endpoints').where('id', id).first();

      if (!endpoint) {
        throw new AppError('MCP端点不存在', 404);
      }

      return endpoint;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('[McpEndpointService] Get endpoint by ID failed:', error);
      // 尝试从内存获取
      return this.getEndpointFromMemory(id);
    }
  }

  /**
   * 更新端点
   */
  async updateEndpoint(id, updateData, userId) {
    try {
      const endpoint = await this.getEndpointById(id);

      const updatedData = {
        ...updateData,
        updated_by: userId,
        updated_at: new Date().toISOString()
      };

      if (updateData.connection_config || updateData.connection_string) {
        // 更新连接配置时，需要重新连接
        await this.disconnectEndpoint(id);
        endpoint.status = this.ENDPOINT_STATUS.INACTIVE;
      }

      if (!this.isDatabaseAvailable()) {
        return this.updateEndpointInMemory(id, updatedData);
      }

      const db = require('../config/database');
      await db('mcp_endpoints').where('id', id).update(updatedData);

      const updatedEndpoint = await this.getEndpointById(id);
      logger.info(`[McpEndpointService] Updated endpoint: ${id}`);

      return updatedEndpoint;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('[McpEndpointService] Update endpoint failed:', error);
      throw new AppError('更新MCP端点失败', 500);
    }
  }

  /**
   * 删除端点
   */
  async deleteEndpoint(id, userId) {
    try {
      const endpoint = await this.getEndpointById(id);

      // 断开连接
      await this.disconnectEndpoint(id);

      if (!this.isDatabaseAvailable()) {
        return this.deleteEndpointFromMemory(id);
      }

      const db = require('../config/database');
      await db('mcp_endpoints').where('id', id).del();

      logger.info(`[McpEndpointService] Deleted endpoint: ${id}`);
      return true;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('[McpEndpointService] Delete endpoint failed:', error);
      throw new AppError('删除MCP端点失败', 500);
    }
  }

  /**
   * 测试端点连接
   */
  async testEndpoint(id) {
    try {
      const endpoint = await this.getEndpointById(id);
      const startTime = Date.now();

      let testResult;
      switch (endpoint.server_type) {
        case this.SERVER_TYPES.STDIO:
          testResult = await this.testStdioEndpoint(endpoint);
          break;
        case this.SERVER_TYPES.HTTP:
          testResult = await this.testHttpEndpoint(endpoint);
          break;
        case this.SERVER_TYPES.WEBSOCKET:
          testResult = await this.testWebSocketEndpoint(endpoint);
          break;
        default:
          throw new AppError(`不支持的端点类型: ${endpoint.server_type}`, 400);
      }

      const executionTime = Date.now() - startTime;

      const result = {
        success: testResult.success,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
        error_message: testResult.error,
        server_info: testResult.serverInfo,
        available_tools: testResult.tools
      };

      // 更新测试结果
      await this.updateTestResult(id, result);

      logger.info(`[McpEndpointService] Tested endpoint: ${id}`, {
        success: result.success,
        execution_time: executionTime
      });

      return result;
    } catch (error) {
      logger.error('[McpEndpointService] Test endpoint failed:', error);
      throw error;
    }
  }

  /**
   * 连接端点
   */
  async connectEndpoint(id) {
    try {
      const endpoint = await this.getEndpointById(id);

      if (!endpoint.enabled) {
        throw new AppError('端点已禁用', 400);
      }

      if (this.activeConnections.has(id)) {
        return this.activeConnections.get(id);
      }

      let connection;
      switch (endpoint.server_type) {
        case this.SERVER_TYPES.STDIO:
          connection = await this.connectStdioEndpoint(endpoint);
          break;
        case this.SERVER_TYPES.HTTP:
          connection = await this.connectHttpEndpoint(endpoint);
          break;
        case this.SERVER_TYPES.WEBSOCKET:
          connection = await this.connectWebSocketEndpoint(endpoint);
          break;
        default:
          throw new AppError(`不支持的端点类型: ${endpoint.server_type}`, 400);
      }

      this.activeConnections.set(id, connection);

      // 设置连接超时
      const timeoutId = setTimeout(() => {
        this.disconnectEndpoint(id);
      }, endpoint.timeout || 30000);
      this.connectionTimeouts.set(id, timeoutId);

      // 更新端点状态
      await this.updateEndpointStatus(id, this.ENDPOINT_STATUS.ACTIVE, new Date().toISOString());

      logger.info(`[McpEndpointService] Connected to endpoint: ${id}`);
      return connection;
    } catch (error) {
      logger.error('[McpEndpointService] Connect endpoint failed:', error);
      await this.updateEndpointStatus(id, this.ENDPOINT_STATUS.ERROR, null, error.message);
      throw error;
    }
  }

  /**
   * 断开端点连接
   */
  async disconnectEndpoint(id) {
    try {
      const connection = this.activeConnections.get(id);
      if (connection) {
        // 根据连接类型断开
        if (connection.process) {
          connection.process.kill();
        } else if (connection.ws) {
          connection.ws.close();
        } else if (connection.close) {
          connection.close();
        }

        this.activeConnections.delete(id);
      }

      // 清除超时
      const timeoutId = this.connectionTimeouts.get(id);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.connectionTimeouts.delete(id);
      }

      // 更新端点状态
      await this.updateEndpointStatus(id, this.ENDPOINT_STATUS.INACTIVE);

      logger.info(`[McpEndpointService] Disconnected from endpoint: ${id}`);
      return true;
    } catch (error) {
      logger.error('[McpEndpointService] Disconnect endpoint failed:', error);
      return false;
    }
  }

  /**
   * 发现工具
   */
  async discoverTools(id) {
    try {
      const connection = await this.connectEndpoint(id);
      const endpoint = await this.getEndpointById(id);

      let tools;
      if (endpoint.server_type === this.SERVER_TYPES.STDIO) {
        tools = await this.discoverStdioTools(connection, endpoint);
      } else {
        tools = await this.discoverHttpOrWsTools(connection, endpoint);
      }

      // 保存发现的工具
      await this.saveDiscoveredTools(id, tools);

      // 更新端点的工具列表
      await this.updateEndpointTools(id, tools);

      logger.info(`[McpEndpointService] Discovered ${tools.length} tools for endpoint: ${id}`);
      return tools;
    } catch (error) {
      logger.error('[McpEndpointService] Discover tools failed:', error);
      throw error;
    }
  }

  /**
   * 执行工具
   */
  async executeTool(endpointId, toolName, args) {
    try {
      const connection = await this.connectEndpoint(endpointId);
      const endpoint = await this.getEndpointById(endpointId);

      let result;
      if (endpoint.server_type === this.SERVER_TYPES.STDIO) {
        result = await this.executeStdioTool(connection, toolName, args);
      } else {
        result = await this.executeHttpOrWsTool(connection, toolName, args);
      }

      logger.info(`[McpEndpointService] Executed tool: ${toolName} on endpoint: ${endpointId}`);
      return result;
    } catch (error) {
      logger.error('[McpEndpointService] Execute tool failed:', error);
      throw error;
    }
  }

  /**
   * 测试Stdio端点
   */
  async testStdioEndpoint(endpoint) {
    return new Promise((resolve) => {
      const args = endpoint.connection_string.split(' ');
      const process = spawn(args[0], args.slice(1));

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      const timeout = setTimeout(() => {
        process.kill();
        resolve({
          success: false,
          error: 'Connection timeout'
        });
      }, endpoint.timeout || 10000);

      process.on('exit', (code) => {
        clearTimeout(timeout);

        if (code === 0) {
          try {
            const response = JSON.parse(output);
            resolve({
              success: true,
              serverInfo: response.result?.serverInfo,
              tools: response.result?.tools || []
            });
          } catch (e) {
            resolve({
              success: false,
              error: 'Invalid JSON response'
            });
          }
        } else {
          resolve({
            success: false,
            error: errorOutput || `Process exited with code ${code}`
          });
        }
      });

      // 发送初始化消息
      process.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'AI Photo Backend',
              version: '1.0.0'
            }
          }
        })
      );
    });
  }

  /**
   * 测试HTTP端点
   */
  async testHttpEndpoint(endpoint) {
    try {
      const response = await fetch(endpoint.connection_string, {
        method: 'GET',
        timeout: endpoint.timeout || 10000,
        headers: {
          'Content-Type': 'application/json',
          ...(endpoint.auth_config || {})
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        serverInfo: data.serverInfo,
        tools: data.tools || []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 测试WebSocket端点
   */
  async testWebSocketEndpoint(endpoint) {
    return new Promise((resolve) => {
      const ws = new WebSocket(endpoint.connection_string);

      const timeout = setTimeout(() => {
        ws.close();
        resolve({
          success: false,
          error: 'Connection timeout'
        });
      }, endpoint.timeout || 10000);

      ws.on('open', () => {
        clearTimeout(timeout);

        // 发送初始化消息
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: {
                name: 'AI Photo Backend',
                version: '1.0.0'
              }
            }
          })
        );
      });

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === 1) {
            ws.close();
            resolve({
              success: true,
              serverInfo: response.result?.serverInfo,
              tools: response.result?.tools || []
            });
          }
        } catch (e) {
          ws.close();
          resolve({
            success: false,
            error: 'Invalid JSON response'
          });
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: error.message
        });
      });
    });
  }

  // 辅助方法
  validateEndpointConfig(endpoint) {
    if (!endpoint.name) {
      throw new AppError('端点名称不能为空', 400);
    }
    if (!endpoint.server_type) {
      throw new AppError('服务器类型不能为空', 400);
    }
    if (!endpoint.connection_string) {
      throw new AppError('连接字符串不能为空', 400);
    }

    const validTypes = Object.values(this.SERVER_TYPES);
    if (!validTypes.includes(endpoint.server_type)) {
      throw new AppError(`无效的服务器类型: ${endpoint.server_type}`, 400);
    }
  }

  generateId() {
    return 'mcp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  isDatabaseAvailable() {
    try {
      require('../config/database');
      return true;
    } catch (error) {
      return false;
    }
  }

  // 内存存储方法（当数据库不可用时）
  storeEndpointInMemory(endpoint) {
    if (!this.memoryEndpoints) {
      this.memoryEndpoints = new Map();
    }
    this.memoryEndpoints.set(endpoint.id, endpoint);
  }

  getEndpointFromMemory(id) {
    if (!this.memoryEndpoints) {
      throw new AppError('MCP端点不存在', 404);
    }
    const endpoint = this.memoryEndpoints.get(id);
    if (!endpoint) {
      throw new AppError('MCP端点不存在', 404);
    }
    return endpoint;
  }

  getEndpointsFromMemory(options) {
    if (!this.memoryEndpoints) {
      return { endpoints: [], pagination: { total: 0, pages: 0 } };
    }

    let endpoints = Array.from(this.memoryEndpoints.values());

    // 应用过滤
    if (options.server_type) {
      endpoints = endpoints.filter((e) => e.server_type === options.server_type);
    }
    if (options.status) {
      endpoints = endpoints.filter((e) => e.status === options.status);
    }
    if (options.enabled !== undefined) {
      endpoints = endpoints.filter((e) => e.enabled === (options.enabled === 'true'));
    }
    if (options.search) {
      endpoints = endpoints.filter(
        (e) => e.name.includes(options.search) || e.description.includes(options.search)
      );
    }

    // 排序
    endpoints.sort(
      (a, b) =>
        new Date(b[options.sortBy || 'created_at']) - new Date(a[options.sortBy || 'created_at'])
    );

    // 分页
    const page = parseInt(options.page) || 1;
    const limit = parseInt(options.limit) || 20;
    const offset = (page - 1) * limit;
    const paginatedEndpoints = endpoints.slice(offset, offset + limit);

    return {
      endpoints: paginatedEndpoints,
      pagination: {
        page,
        limit,
        total: endpoints.length,
        pages: Math.ceil(endpoints.length / limit)
      }
    };
  }

  updateEndpointInMemory(id, updateData) {
    const endpoint = this.getEndpointFromMemory(id);
    Object.assign(endpoint, updateData);
    return endpoint;
  }

  deleteEndpointFromMemory(id) {
    if (!this.memoryEndpoints) return false;
    return this.memoryEndpoints.delete(id);
  }

  async updateEndpointStatus(id, status, lastConnectedAt = null, errorMessage = null) {
    try {
      if (!this.isDatabaseAvailable()) {
        const endpoint = this.getEndpointFromMemory(id);
        endpoint.status = status;
        if (lastConnectedAt) endpoint.last_connected_at = lastConnectedAt;
        return;
      }

      const db = require('../config/database');
      const updateData = { status };
      if (lastConnectedAt) updateData.last_connected_at = lastConnectedAt;
      if (errorMessage) updateData.error_message = errorMessage;

      await db('mcp_endpoints').where('id', id).update(updateData);
    } catch (error) {
      logger.error('[McpEndpointService] Update endpoint status failed:', error);
    }
  }

  async updateTestResult(id, result) {
    try {
      if (!this.isDatabaseAvailable()) {
        const endpoint = this.getEndpointFromMemory(id);
        endpoint.last_tested_at = result.timestamp;
        endpoint.last_test_result = result;
        return;
      }

      const db = require('../config/database');
      await db('mcp_endpoints')
        .where('id', id)
        .update({
          last_tested_at: result.timestamp,
          last_test_result: result,
          status: result.success ? this.ENDPOINT_STATUS.ACTIVE : this.ENDPOINT_STATUS.ERROR
        });
    } catch (error) {
      logger.error('[McpEndpointService] Update test result failed:', error);
    }
  }

  async updateEndpointTools(id, tools) {
    try {
      if (!this.isDatabaseAvailable()) {
        const endpoint = this.getEndpointFromMemory(id);
        endpoint.available_tools = tools;
        return;
      }

      const db = require('../config/database');
      await db('mcp_endpoints')
        .where('id', id)
        .update({
          available_tools: tools,
          server_info: { tools_count: tools.length }
        });
    } catch (error) {
      logger.error('[McpEndpointService] Update endpoint tools failed:', error);
    }
  }

  async saveDiscoveredTools(endpointId, tools) {
    try {
      if (!this.isDatabaseAvailable()) {
        logger.info(
          `[McpEndpointService] Database not available, skipping tool storage for ${endpointId}`
        );
        return;
      }

      const db = require('../config/database');

      // 删除旧的工具记录
      await db('mcp_tools').where('endpoint_id', endpointId).del();

      // 插入新的工具记录
      if (tools.length > 0) {
        const toolRecords = tools.map((tool) => ({
          id: this.generateId(),
          endpoint_id: endpointId,
          name: tool.name,
          description: tool.description,
          category: tool.category || 'general',
          input_schema: tool.inputSchema,
          output_schema: tool.outputSchema,
          enabled: true,
          status: this.TOOL_STATUS.ACTIVE,
          metadata: tool.metadata || {},
          created_at: new Date().toISOString()
        }));

        await db('mcp_tools').insert(toolRecords);
      }
    } catch (error) {
      logger.error('[McpEndpointService] Save discovered tools failed:', error);
    }
  }

  // 其他方法占位符
  async connectStdioEndpoint(endpoint) {
    // 实现stdio连接
    return { type: 'stdio', endpoint };
  }

  async connectHttpEndpoint(endpoint) {
    // 实现HTTP连接
    return { type: 'http', endpoint };
  }

  async connectWebSocketEndpoint(endpoint) {
    // 实现WebSocket连接
    return { type: 'websocket', endpoint };
  }

  async discoverStdioTools(connection, endpoint) {
    // 实现stdio工具发现
    return [];
  }

  async discoverHttpOrWsTools(connection, endpoint) {
    // 实现HTTP/WebSocket工具发现
    return [];
  }

  async executeStdioTool(connection, toolName, args) {
    // 实现stdio工具执行
    return { result: 'executed' };
  }

  async executeHttpOrWsTool(connection, toolName, args) {
    // 实现HTTP/WebSocket工具执行
    return { result: 'executed' };
  }
}

const mcpEndpointService = new McpEndpointService();

export default mcpEndpointService;
