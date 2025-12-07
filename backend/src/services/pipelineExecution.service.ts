import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import pipelineSchemaService from './pipelineSchema.service.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import { TopologySorter } from '../engine/runner/TopologySorter.js';
import { StateManager, PipelineStatus } from '../engine/runner/StateManager.js';
import { ProtocolValidator, PipelineSchemaV1Type } from '../engine/protocol.js';
import { pipelineQueue } from '../engine/queue/PipelineQueue.js';

// Define minimal types for the new engine
export interface PipelineExecutionV2 {
  id: string;
  schema_id: string;
  status: PipelineStatus;
  input_data: any;
  execution_mode: string;
  execution_context: any;
  userId?: string;
  created_at: number;
  // Legacy compat fields
  execution_metadata: any;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  error_details: any;
  output_data: any;
}

class PipelineExecutionService extends EventEmitter {
  private stateManager: StateManager;
  // 临时内存态，避免接口返回空对象导致前端崩溃。后续可替换为持久化存储。
  private executions = new Map<string, PipelineExecutionV2>();

  constructor() {
    super();
    this.stateManager = new StateManager();
  }

  getActiveExecutionCount(): number {
    let count = 0;
    for (const exec of this.executions.values()) {
      if ([PipelineStatus.PENDING, PipelineStatus.DISPATCHED, PipelineStatus.RUNNING].includes(exec.status)) {
        count++;
      }
    }
    return count;
  }

  async cleanupExpiredExecutions(maxAge: number): Promise<number> {
    const now = Date.now();
    let removed = 0;
    for (const [id, exec] of this.executions.entries()) {
      if (now - exec.created_at > maxAge) {
        this.executions.delete(id);
        removed++;
      }
    }
    return removed;
  }

  async cancelExecution(id: string, reason: string): Promise<boolean> {
    logger.info(`[ExecutionService] Cancel requested for ${id} reason: ${reason}`);
    await this.stateManager.setState(id, PipelineStatus.CANCELLED);
    const exec = this.executions.get(id);
    if (exec) {
      exec.status = PipelineStatus.CANCELLED;
      exec.error_message = reason;
      exec.completed_at = new Date().toISOString();
      exec.duration_ms = exec.started_at ? Date.now() - new Date(exec.started_at).getTime() : null;
      this.executions.set(id, exec);
      this.emitExecutionEvent(id, 'cancelled', exec);
    }
    return true;
  }

  /**
   * Create a new execution instance.
   * STRICTLY ENFORCES LEGACY GUARD.
   */
  async createExecution(
    schemaId: string,
    inputData: Record<string, unknown>,
    mode: string = 'real', // 'mock' or 'real'
    userId: string | null = null
  ): Promise<any> {
    try {
      // 1. Fetch Schema
      const schemaRow = await pipelineSchemaService.getSchemaById(schemaId) as any;

      // 2. LEGACY GUARD
      if (!schemaRow.schema_version || schemaRow.schema_version < 1) {
        throw AppError.custom(
          ERROR_CODES.INVALID_REQUEST,
          "LEGACY_PIPELINE_BLOCKED: This pipeline is from an older version (Legacy) and cannot be executed. Please migrate or recreate it."
        );
      }

      // 3. Protocol Validation
      let pipelineDef: PipelineSchemaV1Type;
      let schemaDef = schemaRow.schema_definition;
      if (typeof schemaDef === 'string') {
        try {
          schemaDef = JSON.parse(schemaDef);
          // If it is still a string (double encoded), parse again
          if (typeof schemaDef === 'string') {
            console.log('[DEBUG] Double parsed schemaDef');
            schemaDef = JSON.parse(schemaDef);
          }
        } catch (e) {
          throw AppError.custom(ERROR_CODES.INVALID_REQUEST, `Invalid JSON in schema_definition`);
        }
      }
      try {
        logger.debug(`[PipelineExecution] Validating Schema Def: type=${typeof schemaDef}`);
        pipelineDef = ProtocolValidator.validate(schemaDef);
      } catch (validationError: any) {
        throw AppError.custom(ERROR_CODES.INVALID_REQUEST, `Protocol Violation: ${validationError.message}`);
      }

      // 4. Create Execution Record
      const executionId = uuidv4();
      const now = Date.now();
      const execution: PipelineExecutionV2 = {
        id: executionId,
        schema_id: schemaId,
        status: PipelineStatus.PENDING,
        input_data: inputData,
        execution_mode: mode,
        execution_context: { mode },
        userId: userId || undefined,
        created_at: now,
        execution_metadata: { created_at: new Date(now).toISOString() },
        started_at: null,
        completed_at: null,
        duration_ms: null,
        error_message: null,
        error_details: null,
        output_data: null
      };

      // 5. Persist Initial State (Redis)
      await this.stateManager.setState(executionId, PipelineStatus.PENDING);
      // Persist Schema ID mapping for startExecution to retrieve
      await this.stateManager.setExecutionSchema(executionId, schemaId);

      logger.info(`[ExecutionService] Created V2 Execution ${executionId} for Schema ${schemaId} (V${schemaRow.schema_version})`);
      this.executions.set(executionId, execution);
      this.emitExecutionEvent(executionId, 'created', execution);
      return execution;

    } catch (error) {
      logger.error('[ExecutionService] Create execution failed:', error);
      throw error;
    }
  }

  /**
   * Start the execution.
   */
  async startExecution(executionId: string) {
    try {
      // 0. Retrieve Schema ID from Redis (stored during create)
      // If we can't find it, we might fall back or fail.
      const schemaId = await this.stateManager.getExecutionSchema(executionId);
      if (!schemaId) {
        const fallbackSchemaId = this.executions.get(executionId)?.schema_id;
        if (!fallbackSchemaId) {
          throw new Error(`Schema ID not found for execution ${executionId}`);
        }
      }
      const effectiveSchemaId = schemaId || (this.executions.get(executionId)?.schema_id as string);

      // 1. Check State
      const allowed = await this.stateManager.tryDispatch(executionId);
      if (!allowed) {
        logger.warn(`[ExecutionService] Skipped duplicate start for ${executionId}`);
        return;
      }

      logger.info(`[ExecutionService] Starting Execution ${executionId} (Schema: ${effectiveSchemaId})...`);

      // 2. Load Schema & Protocol Check
      const schemaRow = await pipelineSchemaService.getSchemaById(effectiveSchemaId) as any;
      let schemaDef = schemaRow.schema_definition;
      if (typeof schemaDef === 'string') {
        try {
          schemaDef = JSON.parse(schemaDef);
          if (typeof schemaDef === 'string') schemaDef = JSON.parse(schemaDef);
        } catch (e) {
          throw new Error(`Invalid JSON in schema_definition: ${e}`);
        }
      }
      const pipelineDef = ProtocolValidator.validate(schemaDef);

      // 3. Topology Sort
      const batches = TopologySorter.sort(pipelineDef);

      if (batches.length === 0) {
        logger.warn(`[ExecutionService] Empty pipeline ${executionId}, completing immediately.`);
        await this.stateManager.setState(executionId, PipelineStatus.COMPLETED);
        return;
      }

      // 4. Dispatch First Batch
      const firstBatch = batches[0];
      logger.info(`[ExecutionService] Dispatching Batch 0 with ${firstBatch.nodeIds.length} nodes.`);

      await pipelineQueue.dispatchBatch(executionId, firstBatch.nodeIds, 0, { mode: 'real' });

      // Update status to DISPATCHED (actually handled by tryDispatch, but we might want RUNNING when worker picks up)
      // tryDispatch sets it to DISPATCHED.
      const exec = this.executions.get(executionId);
      if (exec) {
        exec.status = PipelineStatus.DISPATCHED;
        exec.started_at = new Date().toISOString();
        this.executions.set(executionId, exec);
        this.emitExecutionEvent(executionId, 'started', exec);
      }

    } catch (error) {
      logger.error(`[ExecutionService] Start execution failed for ${executionId}:`, error);
      await this.stateManager.setState(executionId, PipelineStatus.FAILED, (error as Error).message);
      const exec = this.executions.get(executionId);
      if (exec) {
        exec.status = PipelineStatus.FAILED;
        exec.error_message = (error as Error).message;
        exec.completed_at = new Date().toISOString();
        exec.duration_ms = exec.started_at ? Date.now() - new Date(exec.started_at).getTime() : null;
        this.executions.set(executionId, exec);
        this.emitExecutionEvent(executionId, 'failed', exec);
      }
      throw error;
    }
  }

  /**
   * Convenience method: Create AND Start.
   */
  async dispatch(schemaId: string, userId: string, inputData: Record<string, unknown> = {}): Promise<string> {
    const execution = await this.createExecution(schemaId, inputData, 'real', userId);
    await this.startExecution(execution.id);
    return execution.id;
  }

  // --- Legacy Compatibility Stubs ---
  getExecution(id: string) {
    return this.executions.get(id) || null;
  }
  getExecutions(options: any) {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const all = Array.from(this.executions.values()).filter((exec) => {
      const statusOk = options?.status ? exec.status.toLowerCase() === String(options.status).toLowerCase() : true;
      const modeOk = options?.mode ? exec.execution_mode === options.mode : true;
      const schemaOk = options?.schema_id ? exec.schema_id === options.schema_id : true;
      return statusOk && modeOk && schemaOk;
    });
    const slice = all.slice(offset, offset + limit);
    return {
      executions: slice,
      pagination: {
        total: all.length,
        limit,
        offset,
        pages: Math.ceil(all.length / limit) || 1
      }
    };
  }

  private emitExecutionEvent(executionId: string, event: string, data: any) {
    this.emit('execution:event', { execution_id: executionId, event, ...data });
  }
}

export default new PipelineExecutionService();
