import { db } from '../config/database.js';
import cmsCacheService from './cmsCache.service.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';

class PipelineSchemaService {
  private readonly CACHE_SCOPE = 'pipeline-schemas';
  private readonly VALIDATION_TYPES = {
    TOPOLOGY: 'topology',
    VARIABLES: 'variables',
    COMPLETENESS: 'completeness',
    CONSTRAINTS: 'constraints'
  } as const;

  private readonly NODE_TYPES = {
    INPUT: 'input',
    OUTPUT: 'output',
    TRANSFORM: 'transform',
    CONDITION: 'condition',
    LOOP: 'loop',
    PARALLEL: 'parallel',
    MERGE: 'merge'
  } as const;

  async createSchema(schemaData: any, userId: string) {
    try {
      const schema = { ...schemaData, is_valid: false, created_by: userId, updated_by: userId };
      const [insertedId] = await db('pipeline_schemas').insert(schema);
      const newSchema = await this.getSchemaById(insertedId);
      this.validateSchemaAsync(insertedId, userId).catch((error: any) => {
        logger.error('[PipelineSchemaService] Async validation failed:', error);
      });
      return newSchema;
    } catch (error) {
      logger.error('[PipelineSchemaService] Create schema failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '创建流程模板失败');
    }
  }

  async getSchemas(options: any = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        status,
        is_valid,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = options;

      let query: any = db('pipeline_schemas').select([
        'id',
        'name',
        'description',
        'category',
        'version',
        'status',
        'is_valid',
        'created_at',
        'updated_at'
      ]);

      if (category) query = query.where('category', category);
      if (status) query = query.where('status', status);
      if (is_valid !== undefined) query = query.where('is_valid', String(is_valid) === 'true');
      if (search) {
        query = query.where(function (this: any) {
          this.where('name', 'like', `%${search}%`).orWhere('description', 'like', `%${search}%`);
        });
      }
      query = query.orderBy(sortBy, sortOrder);

      const offset = (page - 1) * limit;
      const results = await query.limit(limit).offset(offset);
      const totalCount: any = await db('pipeline_schemas')
        .where(function (this: any) {
          if (category) this.where('category', category);
          if (status) this.where('status', status);
          if (is_valid !== undefined) this.where('is_valid', String(is_valid) === 'true');
          if (search)
            this.where('name', 'like', `%${search}%`).orWhere('description', 'like', `%${search}%`);
        })
        .count('* as total')
        .first();

      return {
        schemas: results,
        pagination: {
          page: parseInt(String(page)),
          limit: parseInt(String(limit)),
          total: totalCount.total,
          pages: Math.ceil(totalCount.total / limit)
        }
      };
    } catch (error) {
      logger.error('[PipelineSchemaService] Get schemas failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '获取流程模板列表失败');
    }
  }

  async getSchemaById(id: string | number) {
    try {
      const cacheKey = `schema:${id}`;
      return await (cmsCacheService as any).getOrSet(this.CACHE_SCOPE, cacheKey, async () => {
        const schema = await db('pipeline_schemas').where('id', id).first();
        if (!schema) throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '流程模板不存在');
        return schema;
      });
    } catch (error: any) {
      if (AppError.isAppError?.(error)) throw error;
      logger.error('[PipelineSchemaService] Get schema by ID failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '获取流程模板失败');
    }
  }

  async updateSchema(id: string | number, updateData: any, userId: string) {
    try {
      await this.getSchemaById(id);
      const updatedData = { ...updateData, updated_by: userId, is_valid: false };
      await db('pipeline_schemas').where('id', id).update(updatedData);
      await (cmsCacheService as any).invalidate(this.CACHE_SCOPE, `schema:${id}`);
      this.validateSchemaAsync(id, userId).catch((error: any) => {
        logger.error('[PipelineSchemaService] Async validation failed:', error);
      });
      return await this.getSchemaById(id);
    } catch (error: any) {
      if (AppError.isAppError?.(error)) throw error;
      logger.error('[PipelineSchemaService] Update schema failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '更新流程模板失败');
    }
  }

  async deleteSchema(id: string | number, userId: string) {
    try {
      await this.getSchemaById(id);
      await db('pipeline_schemas').where('id', id).del();
      await (cmsCacheService as any).invalidate(this.CACHE_SCOPE, `schema:${id}`);
      logger.info('[PipelineSchemaService] Schema deleted:', { id, userId });
      return true;
    } catch (error: any) {
      if (AppError.isAppError?.(error)) throw error;
      logger.error('[PipelineSchemaService] Delete schema failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '删除流程模板失败');
    }
  }

  async validateSchema(
    id: string | number,
    validationTypes: string[] | null = null,
    userId: string | null = null
  ) {
    try {
      const startTime = Date.now();
      const schema = await this.getSchemaById(id);
      const validationResults: Record<string, any> = {};
      const allErrors: string[] = [];
      let overallStatus: 'passed' | 'warning' | 'failed' = 'passed';
      const types = validationTypes ?? Object.values(this.VALIDATION_TYPES);

      for (const type of types) {
        try {
          const result = await this.performValidation(type, schema);
          validationResults[type] = result;
          if (result.status !== 'passed') {
            overallStatus = result.status === 'failed' ? 'failed' : 'warning';
            if (result.errors) allErrors.push(...result.errors);
          }
        } catch (error: any) {
          validationResults[type] = { status: 'failed', errors: [error.message] };
          overallStatus = 'failed';
          allErrors.push(error.message);
        }
      }

      const executionTime = Date.now() - startTime;
      await db('pipeline_schemas')
        .where('id', id)
        .update({
          is_valid: overallStatus === 'passed',
          validation_errors: allErrors.length > 0 ? allErrors.join('; ') : null,
          updated_by: userId ?? undefined
        });

      await this.recordValidation(
        id,
        'full',
        overallStatus,
        validationResults,
        executionTime,
        userId
      );
      await (cmsCacheService as any).invalidate(this.CACHE_SCOPE, `schema:${id}`);

      return {
        schema_id: id,
        overall_status: overallStatus,
        validation_results: validationResults,
        execution_time_ms: executionTime,
        is_valid: overallStatus === 'passed'
      };
    } catch (error) {
      logger.error('[PipelineSchemaService] Validate schema failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '校验流程模板失败');
    }
  }

  async performValidation(type: string, schema: any) {
    switch (type) {
      case this.VALIDATION_TYPES.TOPOLOGY:
        return await this.validateTopology(schema);
      case this.VALIDATION_TYPES.VARIABLES:
        return await this.validateVariables(schema);
      case this.VALIDATION_TYPES.COMPLETENESS:
        return await this.validateCompleteness(schema);
      case this.VALIDATION_TYPES.CONSTRAINTS:
        return await this.validateConstraints(schema);
      default:
        throw AppError.custom(ERROR_CODES.INVALID_PARAMETERS, `未知的校验类型: ${type}`);
    }
  }

  async validateTopology(schema: any) {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const { node_definitions, edge_definitions } = schema;
      if (!node_definitions || !Array.isArray(node_definitions) || node_definitions.length === 0) {
        errors.push('节点定义不能为空');
        return { status: 'failed', errors, warnings };
      }
      if (!edge_definitions || !Array.isArray(edge_definitions)) {
        errors.push('边定义必须是数组');
        return { status: 'failed', errors, warnings };
      }
      const hasInput = node_definitions.some((n: any) => n.type === this.NODE_TYPES.INPUT);
      const hasOutput = node_definitions.some((n: any) => n.type === this.NODE_TYPES.OUTPUT);
      if (!hasInput) errors.push('流程必须包含至少一个输入节点');
      if (!hasOutput) errors.push('流程必须包含至少一个输出节点');
      const nodeIds = node_definitions.map((n: any) => n.id);
      const uniqueNodeIds = [...new Set(nodeIds)];
      if (nodeIds.length !== uniqueNodeIds.length) errors.push('节点ID必须唯一');
      const allNodeIds = new Set(nodeIds);
      for (const edge of edge_definitions) {
        if (!allNodeIds.has(edge.source)) errors.push(`边引用了不存在的源节点: ${edge.source}`);
        if (!allNodeIds.has(edge.target)) errors.push(`边引用了不存在的目标节点: ${edge.target}`);
      }
      const hasCycle = this.detectCycle(nodeIds, edge_definitions);
      if (hasCycle) errors.push('流程存在循环依赖');
      const connectivityIssues = this.checkConnectivity(nodeIds, edge_definitions);
      warnings.push(...connectivityIssues);
      const isolatedNodes = this.findIsolatedNodes(nodeIds, edge_definitions);
      if (isolatedNodes.length > 0) warnings.push(`存在孤立节点: ${isolatedNodes.join(', ')}`);
      return {
        status: errors.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
        errors,
        warnings
      };
    } catch (error: any) {
      logger.error('[PipelineSchemaService] Topology validation failed:', error);
      return { status: 'failed', errors: [error.message], warnings };
    }
  }

  async validateVariables(schema: any) {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const inputVars = this.extractVariablesFromSchema(schema.input_schema || {});
      const outputVars = this.extractVariablesFromSchema(schema.output_schema || {});
      const mappings = schema.variable_mappings || {};
      const referencedInput = this.extractReferencedVariables(mappings, 'input');
      const referencedOutput = this.extractReferencedVariables(mappings, 'output');
      const missingInputs = referencedInput.filter((v) => !inputVars.includes(v));
      const missingOutputs = referencedOutput.filter((v) => !outputVars.includes(v));
      if (missingInputs.length > 0)
        errors.push(`引用了未在输入中定义的变量: ${missingInputs.join(', ')}`);
      if (missingOutputs.length > 0)
        errors.push(`引用了未在输出中定义的变量: ${missingOutputs.join(', ')}`);
      const flowIssues = this.checkVariableFlow(schema.node_definitions || [], mappings);
      warnings.push(...flowIssues);
      return {
        status: errors.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
        errors,
        warnings
      };
    } catch (error: any) {
      logger.error('[PipelineSchemaService] Variables validation failed:', error);
      return { status: 'failed', errors: [error.message], warnings };
    }
  }

  async validateCompleteness(schema: any) {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const { node_definitions, edge_definitions, validation_rules } = schema;
      if (!node_definitions || node_definitions.length === 0) errors.push('缺少节点定义');
      if (!edge_definitions || edge_definitions.length === 0) warnings.push('缺少边定义');
      const branchIssues = this.checkBranchCompleteness(
        node_definitions || [],
        edge_definitions || []
      );
      warnings.push(...branchIssues);
      const rules = validation_rules || [];
      const missingRuleIds = rules.filter((r: any) => !r?.id).length;
      if (missingRuleIds > 0) warnings.push(`存在 ${missingRuleIds} 条缺少ID的校验规则`);
      return {
        status: errors.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
        errors,
        warnings
      };
    } catch (error: any) {
      logger.error('[PipelineSchemaService] Completeness validation failed:', error);
      return { status: 'failed', errors: [error.message], warnings };
    }
  }

  async validateConstraints(schema: any) {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const { constraints, validation_rules } = schema;
      if (constraints && schema.node_definitions && schema.edge_definitions) {
        const v = this.checkConstraintViolations(schema, constraints);
        errors.push(...v.errors);
        warnings.push(...v.warnings);
      }
      return {
        status: errors.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
        errors,
        warnings,
        metrics: {
          constraints_count: constraints ? Object.keys(constraints).length : 0,
          validation_rules_count: validation_rules ? validation_rules.length : 0
        }
      };
    } catch (error: any) {
      logger.error('[PipelineSchemaService] Constraints validation failed:', error);
      return { status: 'failed', errors: [error.message], warnings };
    }
  }

  detectCycle(nodes: string[], edges: any[]) {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const graph: Record<string, string[]> = {};
    for (const node of nodes) graph[node] = [];
    for (const edge of edges) {
      if (graph[edge.source]) graph[edge.source].push(edge.target);
    }
    const hasCycle = (node: string): boolean => {
      if (recursionStack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      recursionStack.add(node);
      for (const neighbor of graph[node] || []) if (hasCycle(neighbor)) return true;
      recursionStack.delete(node);
      return false;
    };
    for (const node of nodes) if (!visited.has(node) && hasCycle(node)) return true;
    return false;
  }

  checkConnectivity(nodes: string[], edges: any[]) {
    const issues: string[] = [];
    if (nodes.length === 0) return issues;
    const graph: Record<string, string[]> = {};
    for (const node of nodes) graph[node] = [];
    for (const edge of edges) if (graph[edge.source]) graph[edge.source].push(edge.target);
    const inputNodes = nodes.filter((n) => n.includes('input') || n.includes('Input'));
    if (inputNodes.length === 0) {
      issues.push('未找到输入节点，无法检查连通性');
      return issues;
    }
    const visited = new Set<string>();
    const queue: string[] = [...inputNodes];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (visited.has(current)) continue;
      visited.add(current);
      queue.push(...(graph[current] || []));
    }
    const unreachable = nodes.filter((n) => !visited.has(n));
    if (unreachable.length > 0) issues.push(`存在不可达的节点: ${unreachable.join(', ')}`);
    return issues;
  }

  findIsolatedNodes(nodes: string[], edges: any[]) {
    const connected = new Set<string>();
    for (const edge of edges) {
      connected.add(edge.source);
      connected.add(edge.target);
    }
    return nodes.filter((n) => !connected.has(n));
  }

  extractVariablesFromSchema(schema: any) {
    if (!schema || !schema.properties) return [] as string[];
    const variables: string[] = [];
    const extractFromProperties = (properties: Record<string, any>, prefix = '') => {
      for (const [key, value] of Object.entries(properties)) {
        const fullName = prefix ? `${prefix}.${key}` : key;
        if ((value as any).type === 'object' && (value as any).properties) {
          extractFromProperties((value as any).properties, fullName);
        } else {
          variables.push(fullName);
        }
      }
    };
    extractFromProperties(schema.properties);
    return variables;
  }

  extractReferencedVariables(variableMappings: any, sourceType: string) {
    const references: string[] = [];
    for (const [_key, mapping] of Object.entries<any>(variableMappings)) {
      if ((mapping as any).source === sourceType) references.push((mapping as any).variable);
    }
    return references;
  }

  extractProducedVariables(variableMappings: any) {
    const produced: string[] = [];
    for (const [key, mapping] of Object.entries<any>(variableMappings)) {
      if ((mapping as any).source === 'node' || (mapping as any).source === 'transform')
        produced.push(key);
    }
    return produced;
  }

  checkVariableFlow(_nodeDefinitions: any[], _variableMappings: any) {
    const issues: string[] = [];
    return issues;
  }

  checkBranchCompleteness(nodeDefinitions: any[], edgeDefinitions: any[]) {
    const issues: string[] = [];
    const conditionNodes = nodeDefinitions.filter((n) => n.type === this.NODE_TYPES.CONDITION);
    for (const node of conditionNodes) {
      const outgoing = edgeDefinitions.filter((e) => e.source === node.id);
      if (outgoing.length < 2) issues.push(`条件节点[${node.id}]应该有至少两个输出分支`);
    }
    return issues;
  }

  checkConstraintViolations(schema: any, constraints: any) {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (constraints.max_nodes && schema.node_definitions.length > constraints.max_nodes) {
      errors.push(`节点数量(${schema.node_definitions.length})超过限制(${constraints.max_nodes})`);
    }
    if (constraints.max_edges && schema.edge_definitions.length > constraints.max_edges) {
      errors.push(`边数量(${schema.edge_definitions.length})超过限制(${constraints.max_edges})`);
    }
    if (constraints.allowed_node_types) {
      const invalidNodes = schema.node_definitions.filter(
        (n: any) => !constraints.allowed_node_types.includes(n.type)
      );
      if (invalidNodes.length > 0)
        errors.push(`存在不允许的节点类型: ${invalidNodes.map((n: any) => n.type).join(', ')}`);
    }
    return { errors, warnings };
  }

  async recordValidation(
    schemaId: string | number,
    validationType: string,
    status: 'passed' | 'warning' | 'failed',
    result: any,
    executionTime: number,
    userId: string | null
  ) {
    try {
      await db('pipeline_validations').insert({
        schema_id: schemaId,
        validation_type: validationType,
        status,
        validation_result: result,
        execution_time_ms: executionTime,
        triggered_by: userId
      });
    } catch (error) {
      logger.error('[PipelineSchemaService] Record validation failed:', error);
    }
  }

  async validateSchemaAsync(id: string | number, userId: string | null) {
    try {
      await this.validateSchema(id, null, userId ?? null);
    } catch (error: any) {
      logger.error('[PipelineSchemaService] Async validation failed:', {
        id,
        error: error.message
      });
    }
  }

  async getValidationHistory(schemaId: string | number, options: any = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;
      const results = await db('pipeline_validations')
        .where('schema_id', schemaId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);
      const totalCount: any = await db('pipeline_validations')
        .where('schema_id', schemaId)
        .count('* as total')
        .first();
      return {
        validations: results,
        pagination: {
          page: parseInt(String(page)),
          limit: parseInt(String(limit)),
          total: totalCount.total,
          pages: Math.ceil(totalCount.total / limit)
        }
      };
    } catch (error) {
      logger.error('[PipelineSchemaService] Get validation history failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '获取校验历史失败');
    }
  }

  async getSchemaCategories() {
    try {
      const cacheKey = 'categories';
      return await (cmsCacheService as any).getOrSet(this.CACHE_SCOPE, cacheKey, async () => {
        const categories = await db('pipeline_schemas')
          .distinct('category')
          .select('category')
          .whereNotNull('category')
          .orderBy('category');
        return categories.map((c: any) => c.category);
      });
    } catch (error) {
      logger.error('[PipelineSchemaService] Get categories failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '获取分类列表失败');
    }
  }

  async getSchemaStats() {
    try {
      const cacheKey = 'stats';
      return await (cmsCacheService as any).getOrSet(
        this.CACHE_SCOPE,
        cacheKey,
        async () => {
          const stats = await db('pipeline_schemas')
            .select(
              db.raw('COUNT(*) as total'),
              db.raw('SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid_count'),
              db.raw('SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active_count'),
              db.raw('COUNT(DISTINCT category) as category_count')
            )
            .first();
          const categoryStats = await db('pipeline_schemas')
            .select('category', db.raw('COUNT(*) as count'))
            .groupBy('category')
            .orderBy('count', 'desc');
          return { ...stats, category_distribution: categoryStats } as any;
        },
        { ttl: 300 }
      );
    } catch (error) {
      logger.error('[PipelineSchemaService] Get stats failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '获取统计信息失败');
    }
  }
}

export default new PipelineSchemaService();
