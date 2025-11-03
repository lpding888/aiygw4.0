const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const EventEmitter = require('events');
const pipelineSchemaService = require('./pipelineSchema.service');

/**
 * Pipeline 执行服务
 * 支持Mock和真实执行模式，提供SSE实时输出
 */
class PipelineExecutionService extends EventEmitter {
  constructor() {
    super();
    this.EXECUTION_MODES = {
      MOCK: 'mock',
      REAL: 'real'
    };

    this.EXECUTION_STATUS = {
      PENDING: 'pending',
      RUNNING: 'running',
      COMPLETED: 'completed',
      FAILED: 'failed',
      CANCELLED: 'cancelled'
    };

    this.NODE_STATUS = {
      PENDING: 'pending',
      RUNNING: 'running',
      COMPLETED: 'completed',
      FAILED: 'failed',
      SKIPPED: 'skipped'
    };

    // 存储执行上下文
    this.executions = new Map();
    this.executionSteps = new Map();
  }

  /**
   * 创建执行任务
   */
  async createExecution(schemaId, inputData, mode = this.EXECUTION_MODES.MOCK, userId = null) {
    try {
      const executionId = this.generateId();
      const execution = {
        id: executionId,
        schema_id: schemaId,
        execution_mode: mode,
        status: this.EXECUTION_STATUS.PENDING,
        input_data: inputData,
        output_data: null,
        execution_context: this.createExecutionContext(inputData, mode),
        execution_metadata: {
          created_at: new Date().toISOString(),
          created_by: userId,
          node_count: 0,
          step_count: 0
        },
        started_at: null,
        completed_at: null,
        duration_ms: null,
        error_message: null,
        error_details: null
      };

      // 存储执行上下文
      this.executions.set(executionId, execution);

      // 获取流程Schema
      const schema = await pipelineSchemaService.getSchemaById(schemaId);
      execution.schema = schema;

      // 创建执行步骤
      await this.createExecutionSteps(executionId, schema.node_definitions);

      logger.info(`[PipelineExecutionService] Created execution: ${executionId}`, {
        schemaId,
        mode,
        userId
      });

      return execution;
    } catch (error) {
      logger.error('[PipelineExecutionService] Create execution failed:', error);
      throw new AppError('创建执行任务失败', 500);
    }
  }

  /**
   * 启动执行
   */
  async startExecution(executionId) {
    try {
      const execution = this.executions.get(executionId);
      if (!execution) {
        throw new AppError('执行任务不存在', 404);
      }

      if (execution.status !== this.EXECUTION_STATUS.PENDING) {
        throw new AppError('执行任务已开始或完成', 400);
      }

      // 更新执行状态
      execution.status = this.EXECUTION_STATUS.RUNNING;
      execution.started_at = new Date().toISOString();

      // 发送开始事件
      this.emitExecutionEvent(executionId, 'execution:started', {
        execution_id: executionId,
        status: execution.status,
        started_at: execution.started_at
      });

      // 开始执行流程
      await this.executePipeline(executionId);

    } catch (error) {
      logger.error('[PipelineExecutionService] Start execution failed:', error);
      await this.failExecution(executionId, error.message);
      throw error;
    }
  }

  /**
   * 执行Pipeline
   */
  async executePipeline(executionId) {
    const execution = this.executions.get(executionId);
    const steps = this.executionSteps.get(executionId) || [];

    try {
      // 构建执行图
      const executionGraph = this.buildExecutionGraph(execution.schema, steps);

      // 执行节点
      const results = await this.executeNodes(executionId, executionGraph);

      // 合并结果
      const outputData = this.mergeResults(results, execution.schema.output_schema);

      // 完成执行
      await this.completeExecution(executionId, outputData);

    } catch (error) {
      await this.failExecution(executionId, error.message, error);
    }
  }

  /**
   * 构建执行图
   */
  buildExecutionGraph(schema, steps) {
    const { node_definitions, edge_definitions } = schema;

    // 创建节点映射
    const nodeMap = {};
    for (const node of node_definitions) {
      const step = steps.find(s => s.node_id === node.id);
      nodeMap[node.id] = {
        ...node,
        step: step,
        dependencies: [],
        dependents: []
      };
    }

    // 构建依赖关系
    for (const edge of edge_definitions) {
      if (nodeMap[edge.source] && nodeMap[edge.target]) {
        nodeMap[edge.source].dependents.push(edge.target);
        nodeMap[edge.target].dependencies.push(edge.source);
      }
    }

    return nodeMap;
  }

  /**
   * 执行节点
   */
  async executeNodes(executionId, executionGraph) {
    const execution = this.executions.get(executionId);
    const results = {};
    const visited = new Set();
    const executing = new Set();

    const executeNode = async (nodeId) => {
      if (visited.has(nodeId)) return;
      if (executing.has(nodeId)) {
        throw new Error(`检测到循环依赖: ${nodeId}`);
      }

      const node = executionGraph[nodeId];
      if (!node) return;

      // 检查依赖
      for (const depId of node.dependencies) {
        await executeNode(depId);
      }

      executing.add(nodeId);

      try {
        // 更新步骤状态
        await this.updateStepStatus(executionId, nodeId, this.NODE_STATUS.RUNNING);

        // 执行节点
        const nodeResult = await this.executeNode(executionId, node, results);

        // 保存结果
        results[nodeId] = nodeResult;
        visited.add(nodeId);

        // 更新步骤状态
        await this.updateStepStatus(executionId, nodeId, this.NODE_STATUS.COMPLETED, null, nodeResult);

        // 发送节点完成事件
        this.emitExecutionEvent(executionId, 'node:completed', {
          node_id: nodeId,
          node_type: node.type,
          result: nodeResult
        });

      } catch (error) {
        await this.updateStepStatus(executionId, nodeId, this.NODE_STATUS.FAILED, error.message);
        throw error;
      } finally {
        executing.delete(nodeId);
      }
    };

    // 找到所有入口节点（无依赖的节点）
    const entryNodes = Object.keys(executionGraph).filter(nodeId => {
      const node = executionGraph[nodeId];
      return node.dependencies.length === 0 || node.type === 'input';
    });

    // 开始执行
    for (const nodeId of entryNodes) {
      await executeNode(nodeId);
    }

    return results;
  }

  /**
   * 执行单个节点
   */
  async executeNode(executionId, node, previousResults) {
    const execution = this.executions.get(executionId);
    const { mode } = execution;

    // 发送节点开始事件
    this.emitExecutionEvent(executionId, 'node:started', {
      node_id: node.id,
      node_type: node.type,
      node_name: node.name
    });

    switch (node.type) {
      case 'input':
        return this.executeInputNode(execution, node);
      case 'output':
        return this.executeOutputNode(execution, node, previousResults);
      case 'transform':
        return await this.executeTransformNode(execution, node, previousResults);
      case 'condition':
        return await this.executeConditionNode(execution, node, previousResults);
      case 'loop':
        return await this.executeLoopNode(execution, node, previousResults);
      case 'parallel':
        return await this.executeParallelNode(execution, node, previousResults);
      case 'merge':
        return await this.executeMergeNode(execution, node, previousResults);
      default:
        throw new Error(`未知的节点类型: ${node.type}`);
    }
  }

  /**
   * 执行输入节点
   */
  executeInputNode(execution, node) {
    const { input_data } = execution;
    const { input_config } = node.config || {};

    let result = input_data;
    if (input_config && input_config.mapping) {
      result = this.mapInputData(input_data, input_config.mapping);
    }

    return result;
  }

  /**
   * 执行输出节点
   */
  executeOutputNode(execution, node, previousResults) {
    const { output_config } = node.config || {};

    let result = {};
    for (const [sourceNodeId, portConfig] of Object.entries(output_config?.ports || {})) {
      if (previousResults[sourceNodeId]) {
        result[portConfig.name || sourceNodeId] = previousResults[sourceNodeId];
      }
    }

    return result;
  }

  /**
   * 执行转换节点
   */
  async executeTransformNode(execution, node, previousResults) {
    const { mode } = execution;
    const { transform_config } = node.config || {};

    if (mode === this.EXECUTION_MODES.MOCK) {
      // Mock模式：返回模拟数据
      return this.generateMockTransformResult(node, previousResults);
    } else {
      // 真实模式：执行实际的转换逻辑
      return await this.executeRealTransform(node, previousResults, transform_config);
    }
  }

  /**
   * 执行条件节点
   */
  async executeConditionNode(execution, node, previousResults) {
    const { condition_config } = node.config || {};
    const { condition } = condition_config || {};

    // 评估条件
    const conditionResult = this.evaluateCondition(condition, previousResults);

    return {
      condition_result: conditionResult,
      selected_branch: conditionResult ? 'true' : 'false'
    };
  }

  /**
   * 执行循环节点
   */
  async executeLoopNode(execution, node, previousResults) {
    const { loop_config } = node.config || {};
    const { iterations = 3 } = loop_config || {};
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const iterationResult = await this.executeLoopIteration(execution, node, previousResults, i);
      results.push(iterationResult);

      // 发送迭代事件
      this.emitExecutionEvent(execution.id, 'loop:iteration', {
        node_id: node.id,
        iteration: i,
        result: iterationResult
      });
    }

    return {
      iterations: results,
      total_iterations: iterations
    };
  }

  /**
   * 执行并行节点
   */
  async executeParallelNode(execution, node, previousResults) {
    const { parallel_config } = node.config || {};
    const { branches = [] } = parallel_config || {};

    const promises = branches.map(async (branch, index) => {
      try {
        return await this.executeParallelBranch(execution, node, branch, previousResults, index);
      } catch (error) {
        return { error: error.message, branch_index: index };
      }
    });

    const results = await Promise.all(promises);

    return {
      branches: results,
      successful_branches: results.filter(r => !r.error).length
    };
  }

  /**
   * 执行合并节点
   */
  async executeMergeNode(execution, node, previousResults) {
    const { merge_config } = node.config || {};
    const { merge_strategy = 'combine' } = merge_config || {};

    const results = [];
    for (const [sourceNodeId, sourceResult] of Object.entries(previousResults)) {
      if (sourceNodeId !== node.id) {
        results.push(sourceResult);
      }
    }

    switch (merge_strategy) {
      case 'combine':
        return this.combineResults(results);
      case 'merge':
        return this.mergeResultsArray(results);
      case 'flatten':
        return this.flattenResults(results);
      default:
        return results;
    }
  }

  /**
   * 生成Mock转换结果
   */
  generateMockTransformResult(node, previousResults) {
    const mockData = {
      timestamp: new Date().toISOString(),
      node_id: node.id,
      node_type: 'transform',
      input_summary: Object.keys(previousResults).length,
      processing_time: Math.floor(Math.random() * 1000) + 'ms'
    };

    // 根据节点类型生成不同的mock数据
    switch (node.config?.transform_config?.type) {
      case 'image_processing':
        return {
          ...mockData,
          output_format: 'processed_image',
          quality_score: Math.floor(Math.random() * 100),
          processing_steps: ['resize', 'enhance', 'optimize']
        };
      case 'text_processing':
        return {
          ...mockData,
          output_format: 'processed_text',
          word_count: Math.floor(Math.random() * 1000),
          language: 'zh-CN'
        };
      default:
        return {
          ...mockData,
          output_format: 'generic_output',
          data_size: Math.floor(Math.random() * 10000)
        };
    }
  }

  /**
   * 执行真实转换
   */
  async executeRealTransform(node, previousResults, transformConfig) {
    // 这里可以集成实际的转换服务
    // 比如调用图片处理服务、文本处理服务等

    // 模拟真实处理的延迟
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    return {
      processed_data: previousResults,
      transformation_applied: transformConfig?.type || 'default',
      processed_at: new Date().toISOString()
    };
  }

  /**
   * 评估条件
   */
  evaluateCondition(condition, previousResults) {
    if (!condition) return true;

    // 简单的条件评估逻辑
    if (condition.type === 'exists') {
      const { variable } = condition;
      return previousResults.hasOwnProperty(variable);
    }

    if (condition.type === 'equals') {
      const { variable, value } = condition;
      return previousResults[variable] === value;
    }

    return true;
  }

  /**
   * 完成执行
   */
  async completeExecution(executionId, outputData) {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    execution.status = this.EXECUTION_STATUS.COMPLETED;
    execution.completed_at = new Date().toISOString();
    execution.duration_ms = Date.now() - new Date(execution.started_at).getTime();
    execution.output_data = outputData;

    // 发送完成事件
    this.emitExecutionEvent(executionId, 'execution:completed', {
      execution_id: executionId,
      status: execution.status,
      completed_at: execution.completed_at,
      duration_ms: execution.duration_ms,
      output_data: outputData
    });

    logger.info(`[PipelineExecutionService] Execution completed: ${executionId}`, {
      duration: execution.duration_ms,
      status: execution.status
    });
  }

  /**
   * 执行失败
   */
  async failExecution(executionId, errorMessage, errorDetails = null) {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    execution.status = this.EXECUTION_STATUS.FAILED;
    execution.completed_at = new Date().toISOString();
    execution.duration_ms = execution.started_at ?
      Date.now() - new Date(execution.started_at).getTime() : null;
    execution.error_message = errorMessage;
    execution.error_details = errorDetails ? {
      message: errorDetails.message,
      stack: errorDetails.stack
    } : null;

    // 发送失败事件
    this.emitExecutionEvent(executionId, 'execution:failed', {
      execution_id: executionId,
      status: execution.status,
      error_message: errorMessage,
      error_details: execution.error_details
    });

    logger.error(`[PipelineExecutionService] Execution failed: ${executionId}`, {
      error: errorMessage
    });
  }

  /**
   * 取消执行
   */
  async cancelExecution(executionId, reason = '用户取消') {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new AppError('执行任务不存在', 404);
    }

    if (execution.status === this.EXECUTION_STATUS.COMPLETED ||
        execution.status === this.EXECUTION_STATUS.FAILED ||
        execution.status === this.EXECUTION_STATUS.CANCELLED) {
      throw new AppError('执行任务已完成，无法取消', 400);
    }

    execution.status = this.EXECUTION_STATUS.CANCELLED;
    execution.completed_at = new Date().toISOString();
    execution.duration_ms = execution.started_at ?
      Date.now() - new Date(execution.started_at).getTime() : null;
    execution.error_message = reason;

    // 发送取消事件
    this.emitExecutionEvent(executionId, 'execution:cancelled', {
      execution_id: executionId,
      reason: reason
    });

    logger.info(`[PipelineExecutionService] Execution cancelled: ${executionId}`, { reason });
  }

  /**
   * 获取执行状态
   */
  getExecution(executionId) {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new AppError('执行任务不存在', 404);
    }

    const steps = this.executionSteps.get(executionId) || [];

    return {
      ...execution,
      steps: steps.map(step => ({
        id: step.id,
        node_id: step.node_id,
        node_type: step.node_type,
        status: step.status,
        started_at: step.started_at,
        completed_at: step.completed_at,
        duration_ms: step.duration_ms,
        error_message: step.error_message
      }))
    };
  }

  /**
   * 获取执行列表
   */
  getExecutions(options = {}) {
    const { schema_id, status, mode, limit = 20, offset = 0 } = options;

    let executions = Array.from(this.executions.values());

    // 过滤
    if (schema_id) {
      executions = executions.filter(e => e.schema_id === schema_id);
    }
    if (status) {
      executions = executions.filter(e => e.status === status);
    }
    if (mode) {
      executions = executions.filter(e => e.execution_mode === mode);
    }

    // 排序
    executions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 分页
    const total = executions.length;
    const paginatedExecutions = executions.slice(offset, offset + limit);

    return {
      executions: paginatedExecutions,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 创建执行上下文
   */
  createExecutionContext(inputData, mode) {
    return {
      input_data: inputData,
      execution_mode: mode,
      created_at: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    };
  }

  /**
   * 创建执行步骤
   */
  async createExecutionSteps(executionId, nodeDefinitions) {
    const steps = [];

    for (const node of nodeDefinitions) {
      const step = {
        id: this.generateId(),
        execution_id: executionId,
        node_id: node.id,
        node_type: node.type,
        status: this.NODE_STATUS.PENDING,
        input_data: null,
        output_data: null,
        config: node.config || {},
        started_at: null,
        completed_at: null,
        duration_ms: null,
        error_message: null,
        retry_count: 0,
        metadata: {
          node_name: node.name,
          created_at: new Date().toISOString()
        }
      };

      steps.push(step);
    }

    this.executionSteps.set(executionId, steps);
    return steps;
  }

  /**
   * 更新步骤状态
   */
  async updateStepStatus(executionId, nodeId, status, errorMessage = null, outputData = null) {
    const steps = this.executionSteps.get(executionId) || [];
    const step = steps.find(s => s.node_id === nodeId);

    if (step) {
      step.status = status;

      if (status === this.NODE_STATUS.RUNNING) {
        step.started_at = new Date().toISOString();
      } else if (status === this.NODE_STATUS.COMPLETED || status === this.NODE_STATUS.FAILED) {
        step.completed_at = new Date().toISOString();
        step.duration_ms = step.started_at ?
          Date.now() - new Date(step.started_at).getTime() : null;
      }

      if (errorMessage) {
        step.error_message = errorMessage;
      }

      if (outputData) {
        step.output_data = outputData;
      }

      // 发送步骤状态更新事件
      this.emitExecutionEvent(executionId, 'step:updated', {
        node_id: nodeId,
        status: status,
        error_message: errorMessage,
        output_data: outputData
      });
    }
  }

  /**
   * 发送执行事件
   */
  emitExecutionEvent(executionId, eventType, data) {
    const event = {
      type: eventType,
      execution_id: executionId,
      timestamp: new Date().toISOString(),
      data: data
    };

    this.emit('execution:event', event);
  }

  /**
   * 生成ID
   */
  generateId() {
    return 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 清理过期执行记录
   */
  cleanupExpiredExecutions(maxAge = 24 * 60 * 60 * 1000) { // 24小时
    const now = Date.now();
    const expiredIds = [];

    for (const [executionId, execution] of this.executions.entries()) {
      const createdTime = new Date(execution.created_at).getTime();
      if (now - createdTime > maxAge) {
        expiredIds.push(executionId);
      }
    }

    for (const executionId of expiredIds) {
      this.executions.delete(executionId);
      this.executionSteps.delete(executionId);
    }

    if (expiredIds.length > 0) {
      logger.info(`[PipelineExecutionService] Cleaned up ${expiredIds.length} expired executions`);
    }

    return expiredIds.length;
  }

  // 辅助方法
  mapInputData(inputData, mapping) {
    const result = {};
    for (const [targetKey, sourcePath] of Object.entries(mapping)) {
      result[targetKey] = this.getNestedValue(inputData, sourcePath);
    }
    return result;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  combineResults(results) {
    return results.reduce((combined, result) => {
      return { ...combined, ...result };
    }, {});
  }

  mergeResultsArray(results) {
    return {
      merged_results: results,
      total_count: results.length
    };
  }

  flattenResults(results) {
    return results.flat();
  }

  executeLoopIteration(execution, node, previousResults, iteration) {
    return {
      iteration: iteration,
      input_data: previousResults,
      result: `Loop iteration ${iteration} result`
    };
  }

  executeParallelBranch(execution, node, branch, previousResults, index) {
    return {
      branch_index: index,
      branch_name: branch.name || `branch_${index}`,
      result: `Parallel branch ${index} result`,
      input_data: previousResults
    };
  }

  mergeResults(results, outputSchema) {
    // 根据输出Schema合并结果
    if (!outputSchema) {
      return results;
    }

    const merged = {};
    for (const [nodeId, result] of Object.entries(results)) {
      if (typeof result === 'object' && result !== null) {
        Object.assign(merged, result);
      }
    }

    return merged;
  }
}

module.exports = new PipelineExecutionService();