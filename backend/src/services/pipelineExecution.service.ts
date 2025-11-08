import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import { EventEmitter } from 'events';
import pipelineSchemaService from './pipelineSchema.service.js';

type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
type ExecutionMode = 'mock' | 'real';

class PipelineExecutionService extends EventEmitter {
  public readonly EXECUTION_MODES = { MOCK: 'mock', REAL: 'real' } as const;
  public readonly EXECUTION_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  } as const;
  public readonly NODE_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    SKIPPED: 'skipped'
  } as const;

  private executions: Map<string, any> = new Map();
  private executionSteps: Map<string, any[]> = new Map();

  async createExecution(
    schemaId: string,
    inputData: any,
    mode: ExecutionMode = this.EXECUTION_MODES.MOCK,
    userId: string | null = null
  ) {
    try {
      const executionId = this.generateId();
      const execution: any = {
        id: executionId,
        schema_id: schemaId,
        execution_mode: mode,
        status: this.EXECUTION_STATUS.PENDING as ExecutionStatus,
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

      this.executions.set(executionId, execution);

      const schema: any = await (pipelineSchemaService as any).getSchemaById(schemaId);
      execution.schema = schema;

      await this.createExecutionSteps(executionId, schema.node_definitions);

      logger.info(`[PipelineExecutionService] Created execution: ${executionId}`, {
        schemaId,
        mode,
        userId
      });

      return execution;
    } catch (error) {
      logger.error('[PipelineExecutionService] Create execution failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '创建执行任务失败');
    }
  }

  async startExecution(executionId: string) {
    try {
      const execution = this.executions.get(executionId);
      if (!execution) {
        throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '执行任务不存在');
      }
      if (execution.status !== this.EXECUTION_STATUS.PENDING) {
        throw AppError.custom(ERROR_CODES.INVALID_REQUEST, '执行任务已开始或完成');
      }
      execution.status = this.EXECUTION_STATUS.RUNNING;
      execution.started_at = new Date().toISOString();

      this.emitExecutionEvent(executionId, 'execution:started', {
        execution_id: executionId,
        status: execution.status,
        started_at: execution.started_at
      });

      await this.executePipeline(executionId);
    } catch (error: any) {
      logger.error('[PipelineExecutionService] Start execution failed:', error);
      await this.failExecution(executionId, error?.message ?? '未知错误');
      throw error;
    }
  }

  async executePipeline(executionId: string) {
    const execution = this.executions.get(executionId);
    const steps = this.executionSteps.get(executionId) || [];

    const results: Record<string, any> = {};

    const adjacency = new Map<string, string[]>();
    for (const step of steps) {
      adjacency.set(step.node_id, []);
    }
    // 构造执行顺序（简单按 steps 顺序执行，若有依赖，可在 node.config.dependencies 中声明）
    const getDependencies = (node: any) => (node?.config?.dependencies ?? []) as string[];

    const executeNode = async (nodeId: string) => {
      const step = steps.find((s) => s.node_id === nodeId);
      if (!step) return;

      // 先跑依赖
      for (const depId of getDependencies(step)) {
        if (!results[depId]) {
          await executeNode(depId);
        }
      }

      await this.updateStepStatus(executionId, nodeId, this.NODE_STATUS.RUNNING);
      const nodeResult = await this.executeNode(executionId, step, results);
      results[nodeId] = nodeResult;
      await this.updateStepStatus(
        executionId,
        nodeId,
        this.NODE_STATUS.COMPLETED,
        null,
        nodeResult
      );
    };

    for (const step of steps) {
      await executeNode(step.node_id);
    }

    // 结束
    const outputData = this.mergeResults(results, execution?.schema?.output_schema);
    await this.completeExecution(executionId, outputData);
  }

  async executeNode(executionId: string, node: any, previousResults: Record<string, any>) {
    const execution = this.executions.get(executionId);
    if (!execution) throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '执行任务不存在');
    switch (node.node_type || node.type) {
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

  executeInputNode(execution: any, node: any) {
    const { input_data } = execution;
    const { input_config } = node.config || {};
    let result = input_data;
    if (input_config && input_config.mapping) {
      result = this.mapInputData(input_data, input_config.mapping);
    }
    return result;
  }

  executeOutputNode(_execution: any, node: any, previousResults: Record<string, any>) {
    const { output_config } = node.config || {};
    const result: any = {};
    for (const [sourceNodeId, portConfig] of Object.entries<any>(output_config?.ports || {})) {
      if (previousResults[sourceNodeId]) {
        (result as any)[(portConfig as any).name || sourceNodeId] = previousResults[sourceNodeId];
      }
    }
    return result;
  }

  async executeTransformNode(execution: any, node: any, previousResults: Record<string, any>) {
    const mode = execution.execution_mode as ExecutionMode;
    const { transform_config } = node.config || {};
    if (mode === this.EXECUTION_MODES.MOCK) {
      return this.generateMockTransformResult(node, previousResults);
    }
    return await this.executeRealTransform(node, previousResults, transform_config);
  }

  async executeConditionNode(_execution: any, node: any, previousResults: Record<string, any>) {
    const { condition_config } = node.config || {};
    const { condition } = condition_config || {};
    const conditionResult = this.evaluateCondition(condition, previousResults);
    return {
      condition_result: conditionResult,
      selected_branch: conditionResult ? 'true' : 'false'
    };
  }

  async executeLoopNode(execution: any, node: any, previousResults: Record<string, any>) {
    const { loop_config } = node.config || {};
    const { iterations = 3 } = loop_config || {};
    const results: any[] = [];
    for (let i = 0; i < iterations; i++) {
      const iterationResult = await this.executeLoopIteration(execution, node, previousResults, i);
      results.push(iterationResult);
      this.emitExecutionEvent(execution.id, 'loop:iteration', {
        node_id: node.id,
        iteration: i,
        result: iterationResult
      });
    }
    return { iterations: results, total_iterations: iterations };
  }

  async executeParallelNode(execution: any, node: any, previousResults: Record<string, any>) {
    const { parallel_config } = node.config || {};
    const { branches = [] } = parallel_config || {};
    const promises = (branches as any[]).map(async (branch, index) => {
      try {
        return await this.executeParallelBranch(execution, node, branch, previousResults, index);
      } catch (error: any) {
        return { error: error.message, branch_index: index };
      }
    });
    const results = await Promise.all(promises);
    return { branches: results, successful_branches: results.filter((r: any) => !r.error).length };
  }

  async executeMergeNode(_execution: any, _node: any, previousResults: Record<string, any>) {
    return this.combineResults(Object.values(previousResults));
  }

  generateMockTransformResult(node: any, previousResults: Record<string, any>) {
    const mockData: any = {
      node_id: node.id,
      processed_at: new Date().toISOString()
    };
    switch (node?.config?.mock?.type) {
      case 'text_summary':
        return { ...mockData, summary: 'This is a mock summary.' };
      case 'image_process':
        return { ...mockData, width: 512, height: 512, format: 'png' };
      default:
        return {
          ...mockData,
          output_format: 'generic_output',
          data_size: Math.floor(Math.random() * 10000)
        };
    }
  }

  async executeRealTransform(
    _node: any,
    previousResults: Record<string, any>,
    transformConfig: any
  ) {
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
    return {
      processed_data: previousResults,
      transformation_applied: transformConfig?.type || 'default',
      processed_at: new Date().toISOString()
    };
  }

  evaluateCondition(condition: any, previousResults: Record<string, any>) {
    if (!condition) return true;
    if (condition.type === 'exists') {
      const { variable } = condition;
      return Object.prototype.hasOwnProperty.call(previousResults, variable);
    }
    if (condition.type === 'equals') {
      const { variable, value } = condition;
      return previousResults[variable] === value;
    }
    return true;
  }

  async completeExecution(executionId: string, outputData: any) {
    const execution = this.executions.get(executionId);
    if (!execution) return;
    execution.status = this.EXECUTION_STATUS.COMPLETED;
    execution.completed_at = new Date().toISOString();
    execution.duration_ms = execution.started_at
      ? Date.now() - new Date(execution.started_at).getTime()
      : null;
    execution.output_data = outputData;
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

  async failExecution(executionId: string, errorMessage: string, errorDetails: any = null) {
    const execution = this.executions.get(executionId);
    if (!execution) return;
    execution.status = this.EXECUTION_STATUS.FAILED;
    execution.completed_at = new Date().toISOString();
    execution.duration_ms = execution.started_at
      ? Date.now() - new Date(execution.started_at).getTime()
      : null;
    execution.error_message = errorMessage;
    execution.error_details = errorDetails
      ? { message: (errorDetails as any).message, stack: (errorDetails as any).stack }
      : null;
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

  async cancelExecution(executionId: string, reason: string = '用户取消') {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '执行任务不存在');
    }
    if (
      execution.status === this.EXECUTION_STATUS.COMPLETED ||
      execution.status === this.EXECUTION_STATUS.FAILED ||
      execution.status === this.EXECUTION_STATUS.CANCELLED
    ) {
      throw AppError.custom(ERROR_CODES.INVALID_REQUEST, '执行任务已完成，无法取消');
    }
    execution.status = this.EXECUTION_STATUS.CANCELLED;
    execution.completed_at = new Date().toISOString();
    execution.duration_ms = execution.started_at
      ? Date.now() - new Date(execution.started_at).getTime()
      : null;
    execution.error_message = reason;
    this.emitExecutionEvent(executionId, 'execution:cancelled', {
      execution_id: executionId,
      status: execution.status,
      reason
    });
    return true;
  }

  getExecution(id: string) {
    const execution = this.executions.get(id);
    if (!execution) throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '执行任务不存在');
    return execution;
  }

  getExecutions(options: any = {}) {
    const { schema_id, status, mode, limit = 20, offset = 0 } = options;
    let executions: any[] = Array.from(this.executions.values());
    if (schema_id) executions = executions.filter((e) => e.schema_id === schema_id);
    if (status) executions = executions.filter((e) => e.status === status);
    if (mode) executions = executions.filter((e) => e.execution_mode === mode);
    executions.sort(
      (a, b) =>
        new Date(b.execution_context?.created_at || 0).getTime() -
        new Date(a.execution_context?.created_at || 0).getTime()
    );
    const total = executions.length;
    const paginatedExecutions = executions.slice(offset, offset + limit);
    return {
      executions: paginatedExecutions,
      pagination: { total, limit, offset, pages: Math.ceil(total / limit) }
    };
  }

  createExecutionContext(inputData: any, mode: ExecutionMode) {
    return {
      input_data: inputData,
      execution_mode: mode,
      created_at: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    };
  }

  async createExecutionSteps(executionId: string, nodeDefinitions: any[]) {
    const steps: any[] = [];
    for (const node of nodeDefinitions || []) {
      steps.push({
        id: this.generateId(),
        execution_id: executionId,
        node_id: node.id,
        node_type: node.type,
        status: this.NODE_STATUS.PENDING as NodeStatus,
        input_data: null,
        output_data: null,
        config: node.config || {},
        started_at: null,
        completed_at: null,
        duration_ms: null,
        error_message: null,
        retry_count: 0,
        metadata: { node_name: node.name, created_at: new Date().toISOString() }
      });
    }
    this.executionSteps.set(executionId, steps);
    return steps;
  }

  async updateStepStatus(
    executionId: string,
    nodeId: string,
    status: NodeStatus,
    errorMessage: string | null = null,
    outputData: any = null
  ) {
    const steps = this.executionSteps.get(executionId) || [];
    const step = steps.find((s) => s.node_id === nodeId);
    if (step) {
      step.status = status;
      if (status === this.NODE_STATUS.RUNNING) {
        step.started_at = new Date().toISOString();
      } else if (status === this.NODE_STATUS.COMPLETED || status === this.NODE_STATUS.FAILED) {
        step.completed_at = new Date().toISOString();
        step.duration_ms = step.started_at
          ? Date.now() - new Date(step.started_at).getTime()
          : null;
      }
      if (errorMessage) step.error_message = errorMessage;
      if (outputData) step.output_data = outputData;
      this.emitExecutionEvent(executionId, 'step:updated', {
        node_id: nodeId,
        status,
        error_message: errorMessage,
        output_data: outputData
      });
    }
  }

  emitExecutionEvent(executionId: string, eventType: string, data: any) {
    const event = {
      type: eventType,
      execution_id: executionId,
      timestamp: new Date().toISOString(),
      ...data
    };
    this.emit('execution:event', event);
  }

  generateId() {
    return 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  cleanupExpiredExecutions(maxAge: number = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const expiredIds: string[] = [];
    for (const [executionId, execution] of this.executions.entries()) {
      const createdTime = new Date(
        execution.execution_context?.created_at || execution.created_at || 0
      ).getTime();
      if (now - createdTime > maxAge) expiredIds.push(executionId);
    }
    for (const id of expiredIds) {
      this.executions.delete(id);
      this.executionSteps.delete(id);
    }
    if (expiredIds.length > 0) {
      logger.info(`[PipelineExecutionService] Cleaned up ${expiredIds.length} expired executions`);
    }
    return expiredIds.length;
  }

  mapInputData(inputData: any, mapping: Record<string, string>) {
    const result: any = {};
    for (const [targetKey, sourcePath] of Object.entries(mapping)) {
      result[targetKey] = this.getNestedValue(inputData, sourcePath as string);
    }
    return result;
  }
  getNestedValue(obj: any, path: string) {
    return path
      .split('.')
      .reduce(
        (current: any, key: string) =>
          current && current[key] !== undefined ? current[key] : undefined,
        obj
      );
  }
  combineResults(results: any[]) {
    return results.reduce((combined, result) => ({ ...combined, ...(result || {}) }), {} as any);
  }
  mergeResultsArray(results: any[]) {
    return { merged_results: results, total_count: results.length };
  }
  flattenResults(results: any[]) {
    return results.flat();
  }
  executeLoopIteration(_execution: any, _node: any, previousResults: any, iteration: number) {
    return { iteration, input_data: previousResults, result: `Loop iteration ${iteration} result` };
  }
  executeParallelBranch(
    _execution: any,
    _node: any,
    branch: any,
    previousResults: any,
    index: number
  ) {
    return {
      branch_index: index,
      branch_name: branch?.name || `branch_${index}`,
      result: `Parallel branch ${index} result`,
      input_data: previousResults
    };
  }
  mergeResults(results: Record<string, any>, outputSchema: any) {
    if (!outputSchema) return results;
    const merged: any = {};
    for (const [_nodeId, result] of Object.entries(results)) {
      if (typeof result === 'object' && result !== null) Object.assign(merged, result);
    }
    return merged;
  }
}

export default new PipelineExecutionService();
