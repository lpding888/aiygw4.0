const mcpEndpointsService = require('../../services/mcp-endpoints.service');
const { createSuccessResponse, createErrorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

class McpEndpointsController {
  /**
   * 获取MCP终端列表
   */
  async getEndpoints(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        provider,
        status,
        enabled,
        search
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        filters: {
          provider,
          status,
          enabled: enabled !== undefined ? enabled === 'true' : undefined
        },
        search
      };

      const result = await mcpEndpointsService.getEndpoints(options);

      res.json(createSuccessResponse({
        endpoints: result.endpoints,
        pagination: result.pagination
      }, '获取MCP终端列表成功'));
    } catch (error) {
      logger.error('获取MCP终端列表失败:', error);
      next(error);
    }
  }

  /**
   * 获取单个MCP终端详情
   */
  async getEndpointById(req, res, next) {
    try {
      const { id } = req.params;
      const endpoint = await mcpEndpointsService.getEndpointById(id);

      res.json(createSuccessResponse(endpoint, '获取MCP终端详情成功'));
    } catch (error) {
      logger.error('获取MCP终端详情失败:', error);
      next(error);
    }
  }

  /**
   * 创建MCP终端
   */
  async createEndpoint(req, res, next) {
    try {
      const userId = req.user.id;
      const endpointData = {
        ...req.body,
        created_by: userId
      };

      const endpoint = await mcpEndpointsService.createEndpoint(endpointData, userId);

      res.status(201).json(
        createSuccessResponse(endpoint, '创建MCP终端成功')
      );
    } catch (error) {
      logger.error('创建MCP终端失败:', error);
      next(error);
    }
  }

  /**
   * 更新MCP终端
   */
  async updateEndpoint(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = {
        ...req.body,
        updated_by: userId
      };

      const endpoint = await mcpEndpointsService.updateEndpoint(id, updateData, userId);

      res.json(createSuccessResponse(endpoint, '更新MCP终端成功'));
    } catch (error) {
      logger.error('更新MCP终端失败:', error);
      next(error);
    }
  }

  /**
   * 删除MCP终端
   */
  async deleteEndpoint(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await mcpEndpointsService.deleteEndpoint(id, userId);

      res.json(createSuccessResponse(null, '删除MCP终端成功'));
    } catch (error) {
      logger.error('删除MCP终端失败:', error);
      next(error);
    }
  }

  /**
   * 测试MCP终端连接
   */
  async testEndpoint(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const testResult = await mcpEndpointsService.testEndpoint(id, userId);

      res.json(createSuccessResponse(testResult, '测试MCP终端完成'));
    } catch (error) {
      logger.error('测试MCP终端失败:', error);
      next(error);
    }
  }

  /**
   * 发现MCP终端工具
   */
  async discoverTools(req, res, next) {
    try {
      const { id } = req.params;
      const tools = await mcpEndpointsService.discoverTools(id);

      res.json(createSuccessResponse(tools, '发现MCP终端工具成功'));
    } catch (error) {
      logger.error('发现MCP终端工具失败:', error);
      next(error);
    }
  }

  /**
   * 执行MCP工具
   */
  async executeTool(req, res, next) {
    try {
      const { id, toolName } = req.params;
      const { arguments: toolArgs } = req.body;
      const userId = req.user.id;

      const result = await mcpEndpointsService.executeTool(
        id,
        toolName,
        toolArgs || {},
        userId
      );

      res.json(createSuccessResponse(result, '执行MCP工具成功'));
    } catch (error) {
      logger.error('执行MCP工具失败:', error);
      next(error);
    }
  }

  /**
   * 获取测试记录
   */
  async getTestLogs(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50, testType } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        filters: {
          test_type: testType
        }
      };

      const result = await mcpEndpointsService.getTestLogs(id, options);

      res.json(createSuccessResponse({
        logs: result.logs,
        pagination: result.pagination
      }, '获取测试记录成功'));
    } catch (error) {
      logger.error('获取测试记录失败:', error);
      next(error);
    }
  }

  /**
   * 启用/禁用MCP终端
   */
  async toggleEndpoint(req, res, next) {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const userId = req.user.id;

      const endpoint = await mcpEndpointsService.toggleEndpoint(id, enabled, userId);

      res.json(createSuccessResponse(endpoint, `${enabled ? '启用' : '禁用'}MCP终端成功`));
    } catch (error) {
      logger.error('切换MCP终端状态失败:', error);
      next(error);
    }
  }
}

module.exports = new McpEndpointsController();