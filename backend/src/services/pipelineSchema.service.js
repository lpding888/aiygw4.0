const db = require('../config/database');
const cmsCacheService = require('./cmsCache.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Pipeline Schema 校验服务
 * 负责流程拓扑结构的合法性校验
 */
class PipelineSchemaService {
  constructor() {
    this.CACHE_SCOPE = 'pipeline-schemas';
    this.VALIDATION_TYPES = {
      TOPOLOGY: 'topology',       // 拓扑结构校验
      VARIABLES: 'variables',     // 变量可达性校验
      COMPLETENESS: 'completeness', // 完整性校验
      CONSTRAINTS: 'constraints'   // 约束条件校验
    };

    // 节点类型定义
    this.NODE_TYPES = {
      INPUT: 'input',
      OUTPUT: 'output',
      TRANSFORM: 'transform',
      CONDITION: 'condition',
      LOOP: 'loop',
      PARALLEL: 'parallel',
      MERGE: 'merge'
    };
  }

  /**
   * 创建Pipeline Schema
   */
  async createSchema(schemaData, userId) {
    try {
      const schema = {
        ...schemaData,
        is_valid: false, // 新创建的Schema默认未校验
        created_by: userId,
        updated_by: userId
      };

      const [insertedId] = await db('pipeline_schemas').insert(schema);
      const newSchema = await this.getSchemaById(insertedId);

      // 异步校验Schema
      this.validateSchemaAsync(insertedId, userId).catch(error => {
        logger.error('[PipelineSchemaService] Async validation failed:', error);
      });

      return newSchema;
    } catch (error) {
      logger.error('[PipelineSchemaService] Create schema failed:', error);
      throw new AppError('创建流程模板失败', 500);
    }
  }

  /**
   * 获取Schema列表
   */
  async getSchemas(options = {}) {
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

      let query = db('pipeline_schemas')
        .select([
          'id', 'name', 'description', 'category', 'version',
          'status', 'is_valid', 'created_at', 'updated_at'
        ]);

      // 过滤条件
      if (category) {
        query = query.where('category', category);
      }
      if (status) {
        query = query.where('status', status);
      }
      if (is_valid !== undefined) {
        query = query.where('is_valid', is_valid === 'true');
      }
      if (search) {
        query = query.where(function() {
          this.where('name', 'like', `%${search}%`)
              .orWhere('description', 'like', `%${search}%`);
        });
      }

      // 排序
      query = query.orderBy(sortBy, sortOrder);

      // 分页
      const offset = (page - 1) * limit;
      const results = await query.limit(limit).offset(offset);

      // 获取总数
      const totalCount = await db('pipeline_schemas')
        .where(function() {
          if (category) this.where('category', category);
          if (status) this.where('status', status);
          if (is_valid !== undefined) this.where('is_valid', is_valid === 'true');
          if (search) {
            this.where('name', 'like', `%${search}%`)
                .orWhere('description', 'like', `%${search}%`);
          }
        })
        .count('* as total')
        .first();

      return {
        schemas: results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount.total,
          pages: Math.ceil(totalCount.total / limit)
        }
      };
    } catch (error) {
      logger.error('[PipelineSchemaService] Get schemas failed:', error);
      throw new AppError('获取流程模板列表失败', 500);
    }
  }

  /**
   * 根据ID获取Schema
   */
  async getSchemaById(id) {
    try {
      const cacheKey = `schema:${id}`;
      return await cmsCacheService.getOrSet(this.CACHE_SCOPE, cacheKey, async () => {
        const schema = await db('pipeline_schemas').where('id', id).first();
        if (!schema) {
          throw new AppError('流程模板不存在', 404);
        }
        return schema;
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('[PipelineSchemaService] Get schema by ID failed:', error);
      throw new AppError('获取流程模板失败', 500);
    }
  }

  /**
   * 更新Schema
   */
  async updateSchema(id, updateData, userId) {
    try {
      const schema = await this.getSchemaById(id);

      const updatedData = {
        ...updateData,
        updated_by: userId,
        is_valid: false // 更新后需要重新校验
      };

      await db('pipeline_schemas').where('id', id).update(updatedData);

      // 清除缓存
      await cmsCacheService.invalidate(this.CACHE_SCOPE, `schema:${id}`);

      // 异步校验
      this.validateSchemaAsync(id, userId).catch(error => {
        logger.error('[PipelineSchemaService] Async validation failed:', error);
      });

      return await this.getSchemaById(id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('[PipelineSchemaService] Update schema failed:', error);
      throw new AppError('更新流程模板失败', 500);
    }
  }

  /**
   * 删除Schema
   */
  async deleteSchema(id, userId) {
    try {
      const schema = await this.getSchemaById(id);

      await db('pipeline_schemas').where('id', id).del();

      // 清除缓存
      await cmsCacheService.invalidate(this.CACHE_SCOPE, `schema:${id}`);

      logger.info('[PipelineSchemaService] Schema deleted:', { id, userId });
      return true;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('[PipelineSchemaService] Delete schema failed:', error);
      throw new AppError('删除流程模板失败', 500);
    }
  }

  /**
   * 校验Schema - 核心方法
   */
  async validateSchema(id, validationTypes = null, userId = null) {
    try {
      const startTime = Date.now();
      const schema = await this.getSchemaById(id);

      const validationResults = {};
      const allErrors = [];
      let overallStatus = 'passed';

      // 默认执行所有校验
      const typesToValidate = validationTypes || [
        this.VALIDATION_TYPES.TOPOLOGY,
        this.VALIDATION_TYPES.VARIABLES,
        this.VALIDATION_TYPES.COMPLETENESS,
        this.VALIDATION_TYPES.CONSTRAINTS
      ];

      for (const type of typesToValidate) {
        try {
          const result = await this.performValidation(type, schema);
          validationResults[type] = result;

          if (result.status !== 'passed') {
            overallStatus = result.status === 'failed' ? 'failed' : 'warning';
            if (result.errors) {
              allErrors.push(...result.errors);
            }
          }
        } catch (error) {
          validationResults[type] = {
            status: 'failed',
            errors: [error.message]
          };
          overallStatus = 'failed';
          allErrors.push(error.message);
        }
      }

      const executionTime = Date.now() - startTime;

      // 更新Schema状态
      await db('pipeline_schemas').where('id', id).update({
        is_valid: overallStatus === 'passed',
        validation_errors: allErrors.length > 0 ? allErrors.join('; ') : null,
        updated_by: userId
      });

      // 记录校验历史
      await this.recordValidation(id, 'full', overallStatus, validationResults, executionTime, userId);

      // 清除缓存
      await cmsCacheService.invalidate(this.CACHE_SCOPE, `schema:${id}`);

      return {
        schema_id: id,
        overall_status: overallStatus,
        validation_results: validationResults,
        execution_time_ms: executionTime,
        is_valid: overallStatus === 'passed'
      };
    } catch (error) {
      logger.error('[PipelineSchemaService] Validate schema failed:', error);
      throw new AppError('校验流程模板失败', 500);
    }
  }

  /**
   * 执行具体类型的校验
   */
  async performValidation(type, schema) {
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
        throw new AppError(`未知的校验类型: ${type}`, 400);
    }
  }

  /**
   * 拓扑结构校验
   */
  async validateTopology(schema) {
    const errors = [];
    const warnings = [];

    try {
      const { node_definitions, edge_definitions } = schema;

      // 1. 检查节点定义
      if (!node_definitions || !Array.isArray(node_definitions) || node_definitions.length === 0) {
        errors.push('节点定义不能为空');
        return { status: 'failed', errors, warnings };
      }

      // 2. 检查边的定义
      if (!edge_definitions || !Array.isArray(edge_definitions)) {
        errors.push('边定义必须是数组');
        return { status: 'failed', errors, warnings };
      }

      // 3. 检查必需的节点类型
      const hasInput = node_definitions.some(node => node.type === this.NODE_TYPES.INPUT);
      const hasOutput = node_definitions.some(node => node.type === this.NODE_TYPES.OUTPUT);

      if (!hasInput) {
        errors.push('流程必须包含至少一个输入节点');
      }
      if (!hasOutput) {
        errors.push('流程必须包含至少一个输出节点');
      }

      // 4. 检查节点ID唯一性
      const nodeIds = node_definitions.map(node => node.id);
      const uniqueNodeIds = [...new Set(nodeIds)];
      if (nodeIds.length !== uniqueNodeIds.length) {
        errors.push('节点ID必须唯一');
      }

      // 5. 检查边的引用有效性
      const allNodeIds = new Set(nodeIds);
      for (const edge of edge_definitions) {
        if (!allNodeIds.has(edge.source)) {
          errors.push(`边引用了不存在的源节点: ${edge.source}`);
        }
        if (!allNodeIds.has(edge.target)) {
          errors.push(`边引用了不存在的目标节点: ${edge.target}`);
        }
      }

      // 6. 检查循环依赖
      const hasCycle = this.detectCycle(nodeIds, edge_definitions);
      if (hasCycle) {
        errors.push('流程存在循环依赖');
      }

      // 7. 检查连通性
      const connectivityIssues = this.checkConnectivity(nodeIds, edge_definitions);
      warnings.push(...connectivityIssues);

      // 8. 检查孤立节点
      const isolatedNodes = this.findIsolatedNodes(nodeIds, edge_definitions);
      if (isolatedNodes.length > 0) {
        warnings.push(`发现孤立节点: ${isolatedNodes.join(', ')}`);
      }

      return {
        status: errors.length > 0 ? 'failed' : (warnings.length > 0 ? 'warning' : 'passed'),
        errors,
        warnings,
        metrics: {
          total_nodes: nodeIds.length,
          total_edges: edge_definitions.length,
          isolated_nodes: isolatedNodes.length,
          has_cycle: hasCycle
        }
      };
    } catch (error) {
      logger.error('[PipelineSchemaService] Topology validation failed:', error);
      return { status: 'failed', errors: [error.message], warnings };
    }
  }

  /**
   * 变量可达性校验
   */
  async validateVariables(schema) {
    const errors = [];
    const warnings = [];

    try {
      const { input_schema, output_schema, variable_mappings, node_definitions } = schema;

      // 1. 检查输入输出Schema定义
      if (!input_schema) {
        errors.push('必须定义输入Schema');
      }
      if (!output_schema) {
        errors.push('必须定义输出Schema');
      }

      // 2. 检查变量映射
      if (!variable_mappings || typeof variable_mappings !== 'object') {
        errors.push('变量映射必须是一个对象');
        return { status: 'failed', errors, warnings };
      }

      // 3. 验证变量引用的有效性
      const inputVariables = this.extractVariablesFromSchema(input_schema);
      const referencedInputs = this.extractReferencedVariables(variable_mappings, 'input');

      for (const ref of referencedInputs) {
        if (!inputVariables.includes(ref)) {
          errors.push(`引用了不存在的输入变量: ${ref}`);
        }
      }

      // 4. 检查输出变量的产生
      const outputVariables = this.extractVariablesFromSchema(output_schema);
      const producedOutputs = this.extractProducedVariables(variable_mappings);

      for (const output of outputVariables) {
        if (!producedOutputs.includes(output)) {
          warnings.push(`输出变量可能未正确赋值: ${output}`);
        }
      }

      // 5. 检查节点间的变量传递
      const variableFlowIssues = this.checkVariableFlow(node_definitions, variable_mappings);
      warnings.push(...variableFlowIssues);

      return {
        status: errors.length > 0 ? 'failed' : (warnings.length > 0 ? 'warning' : 'passed'),
        errors,
        warnings,
        metrics: {
          input_variables: inputVariables.length,
          output_variables: outputVariables.length,
          variable_mappings: Object.keys(variable_mappings).length
        }
      };
    } catch (error) {
      logger.error('[PipelineSchemaService] Variables validation failed:', error);
      return { status: 'failed', errors: [error.message], warnings };
    }
  }

  /**
   * 完整性校验
   */
  async validateCompleteness(schema) {
    const errors = [];
    const warnings = [];

    try {
      const { schema_definition, node_definitions, edge_definitions, input_schema, output_schema } = schema;

      // 1. 检查必填字段
      const requiredFields = ['name', 'category', 'schema_definition', 'node_definitions', 'edge_definitions'];
      for (const field of requiredFields) {
        if (!schema[field]) {
          errors.push(`缺少必填字段: ${field}`);
        }
      }

      // 2. 检查Schema结构完整性
      if (!schema_definition || typeof schema_definition !== 'object') {
        errors.push('Schema结构定义必须是有效的对象');
      } else {
        // 检查Schema结构的元数据
        const schemaMeta = ['version', 'description', 'metadata'];
        for (const meta of schemaMeta) {
          if (!schema_definition[meta]) {
            warnings.push(`建议添加Schema元数据: ${meta}`);
          }
        }
      }

      // 3. 检查节点定义的完整性
      if (node_definitions && Array.isArray(node_definitions)) {
        for (let i = 0; i < node_definitions.length; i++) {
          const node = node_definitions[i];
          const requiredNodeFields = ['id', 'type', 'name'];

          for (const field of requiredNodeFields) {
            if (!node[field]) {
              errors.push(`节点[${i}]缺少必填字段: ${field}`);
            }
          }

          // 检查节点类型的配置完整性
          if (node.type === this.NODE_TYPES.CONDITION && !node.condition_config) {
            warnings.push(`条件节点[${node.id}]缺少条件配置`);
          }
          if (node.type === this.NODE_TYPES.LOOP && !node.loop_config) {
            warnings.push(`循环节点[${node.id}]缺少循环配置`);
          }
        }
      }

      // 4. 检查边定义的完整性
      if (edge_definitions && Array.isArray(edge_definitions)) {
        for (let i = 0; i < edge_definitions.length; i++) {
          const edge = edge_definitions[i];
          const requiredEdgeFields = ['id', 'source', 'target', 'source_port', 'target_port'];

          for (const field of requiredEdgeFields) {
            if (edge[field] === undefined || edge[field] === null) {
              errors.push(`边[${i}]缺少必填字段: ${field}`);
            }
          }
        }
      }

      // 5. 检查分支完整性
      const branchIssues = this.checkBranchCompleteness(node_definitions, edge_definitions);
      warnings.push(...branchIssues);

      return {
        status: errors.length > 0 ? 'failed' : (warnings.length > 0 ? 'warning' : 'passed'),
        errors,
        warnings,
        metrics: {
          total_checks: requiredFields.length + (node_definitions?.length || 0) * 3 + (edge_definitions?.length || 0) * 4,
          passed_checks: requiredFields.length + (node_definitions?.length || 0) * 3 + (edge_definitions?.length || 0) * 4 - errors.length
        }
      };
    } catch (error) {
      logger.error('[PipelineSchemaService] Completeness validation failed:', error);
      return { status: 'failed', errors: [error.message], warnings };
    }
  }

  /**
   * 约束条件校验
   */
  async validateConstraints(schema) {
    const errors = [];
    const warnings = [];

    try {
      const { constraints, validation_rules } = schema;

      // 1. 检查约束定义
      if (constraints && typeof constraints === 'object') {
        // 检查节点数量约束
        if (constraints.max_nodes && constraints.max_nodes < 1) {
          errors.push('最大节点数必须大于0');
        }
        if (constraints.max_edges && constraints.max_edges < 1) {
          errors.push('最大边数必须大于0');
        }

        // 检查深度约束
        if (constraints.max_depth && constraints.max_depth < 1) {
          errors.push('最大深度必须大于0');
        }

        // 检查允许的节点类型
        if (constraints.allowed_node_types && !Array.isArray(constraints.allowed_node_types)) {
          errors.push('允许的节点类型必须是数组');
        }
      }

      // 2. 检查校验规则
      if (validation_rules && Array.isArray(validation_rules)) {
        for (let i = 0; i < validation_rules.length; i++) {
          const rule = validation_rules[i];

          if (!rule.type) {
            errors.push(`校验规则[${i}]缺少类型定义`);
          }
          if (!rule.name) {
            errors.push(`校验规则[${i}]缺少名称`);
          }
          if (rule.type === 'custom' && !rule.validator) {
            warnings.push(`自定义校验规则[${rule.name || i}]缺少校验器定义`);
          }
        }
      }

      // 3. 应用约束检查
      if (constraints && schema.node_definitions && schema.edge_definitions) {
        const constraintViolations = this.checkConstraintViolations(schema, constraints);
        errors.push(...constraintViolations.errors);
        warnings.push(...constraintViolations.warnings);
      }

      return {
        status: errors.length > 0 ? 'failed' : (warnings.length > 0 ? 'warning' : 'passed'),
        errors,
        warnings,
        metrics: {
          constraints_count: constraints ? Object.keys(constraints).length : 0,
          validation_rules_count: validation_rules ? validation_rules.length : 0
        }
      };
    } catch (error) {
      logger.error('[PipelineSchemaService] Constraints validation failed:', error);
      return { status: 'failed', errors: [error.message], warnings };
    }
  }

  /**
   * 检测循环依赖
   */
  detectCycle(nodes, edges) {
    const visited = new Set();
    const recursionStack = new Set();
    const graph = {};

    // 构建邻接表
    for (const node of nodes) {
      graph[node] = [];
    }
    for (const edge of edges) {
      if (graph[edge.source]) {
        graph[edge.source].push(edge.target);
      }
    }

    // DFS检测循环
    const hasCycle = (node) => {
      if (recursionStack.has(node)) {
        return true;
      }
      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);

      for (const neighbor of graph[node] || []) {
        if (hasCycle(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node) && hasCycle(node)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查连通性
   */
  checkConnectivity(nodes, edges) {
    const issues = [];

    if (nodes.length === 0) return issues;

    // 构建邻接表
    const graph = {};
    for (const node of nodes) {
      graph[node] = [];
    }
    for (const edge of edges) {
      if (graph[edge.source]) {
        graph[edge.source].push(edge.target);
      }
    }

    // 检查从输入节点是否能到达所有节点
    const inputNodes = nodes.filter(node => node.includes('input') || node.includes('Input'));
    if (inputNodes.length === 0) {
      issues.push('未找到输入节点，无法检查连通性');
      return issues;
    }

    const visited = new Set();
    const queue = [...inputNodes];

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;

      visited.add(current);
      queue.push(...(graph[current] || []));
    }

    const unreachableNodes = nodes.filter(node => !visited.has(node));
    if (unreachableNodes.length > 0) {
      issues.push(`存在不可达的节点: ${unreachableNodes.join(', ')}`);
    }

    return issues;
  }

  /**
   * 查找孤立节点
   */
  findIsolatedNodes(nodes, edges) {
    const connectedNodes = new Set();

    for (const edge of edges) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }

    return nodes.filter(node => !connectedNodes.has(node));
  }

  /**
   * 从Schema中提取变量
   */
  extractVariablesFromSchema(schema) {
    if (!schema || !schema.properties) return [];

    const variables = [];
    const extractFromProperties = (properties, prefix = '') => {
      for (const [key, value] of Object.entries(properties)) {
        const fullName = prefix ? `${prefix}.${key}` : key;
        if (value.type === 'object' && value.properties) {
          extractFromProperties(value.properties, fullName);
        } else {
          variables.push(fullName);
        }
      }
    };

    extractFromProperties(schema.properties);
    return variables;
  }

  /**
   * 提取引用的变量
   */
  extractReferencedVariables(variableMappings, sourceType) {
    const references = [];
    for (const [key, mapping] of Object.entries(variableMappings)) {
      if (mapping.source === sourceType) {
        references.push(mapping.variable);
      }
    }
    return references;
  }

  /**
   * 提取产生的变量
   */
  extractProducedVariables(variableMappings) {
    const produced = [];
    for (const [key, mapping] of Object.entries(variableMappings)) {
      if (mapping.source === 'node' || mapping.source === 'transform') {
        produced.push(key);
      }
    }
    return produced;
  }

  /**
   * 检查变量流
   */
  checkVariableFlow(nodeDefinitions, variableMappings) {
    const issues = [];
    // 这里可以实现更复杂的变量流分析逻辑
    return issues;
  }

  /**
   * 检查分支完整性
   */
  checkBranchCompleteness(nodeDefinitions, edgeDefinitions) {
    const issues = [];

    // 检查条件节点的分支完整性
    const conditionNodes = nodeDefinitions.filter(node => node.type === this.NODE_TYPES.CONDITION);
    for (const node of conditionNodes) {
      const outgoingEdges = edgeDefinitions.filter(edge => edge.source === node.id);
      if (outgoingEdges.length < 2) {
        issues.push(`条件节点[${node.id}]应该有至少两个输出分支`);
      }
    }

    return issues;
  }

  /**
   * 检查约束违反
   */
  checkConstraintViolations(schema, constraints) {
    const errors = [];
    const warnings = [];

    if (constraints.max_nodes && schema.node_definitions.length > constraints.max_nodes) {
      errors.push(`节点数量(${schema.node_definitions.length})超过限制(${constraints.max_nodes})`);
    }

    if (constraints.max_edges && schema.edge_definitions.length > constraints.max_edges) {
      errors.push(`边数量(${schema.edge_definitions.length})超过限制(${constraints.max_edges})`);
    }

    if (constraints.allowed_node_types) {
      const invalidNodes = schema.node_definitions.filter(
        node => !constraints.allowed_node_types.includes(node.type)
      );
      if (invalidNodes.length > 0) {
        errors.push(`存在不允许的节点类型: ${invalidNodes.map(n => n.type).join(', ')}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * 记录校验历史
   */
  async recordValidation(schemaId, validationType, status, result, executionTime, userId) {
    try {
      await db('pipeline_validations').insert({
        schema_id: schemaId,
        validation_type: validationType,
        status: status,
        validation_result: result,
        execution_time_ms: executionTime,
        triggered_by: userId
      });
    } catch (error) {
      logger.error('[PipelineSchemaService] Record validation failed:', error);
    }
  }

  /**
   * 异步校验Schema
   */
  async validateSchemaAsync(id, userId) {
    try {
      await this.validateSchema(id, null, userId);
    } catch (error) {
      logger.error('[PipelineSchemaService] Async validation failed:', { id, error: error.message });
    }
  }

  /**
   * 获取校验历史
   */
  async getValidationHistory(schemaId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      const results = await db('pipeline_validations')
        .where('schema_id', schemaId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      const totalCount = await db('pipeline_validations')
        .where('schema_id', schemaId)
        .count('* as total')
        .first();

      return {
        validations: results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount.total,
          pages: Math.ceil(totalCount.total / limit)
        }
      };
    } catch (error) {
      logger.error('[PipelineSchemaService] Get validation history failed:', error);
      throw new AppError('获取校验历史失败', 500);
    }
  }

  /**
   * 获取Schema分类列表
   */
  async getSchemaCategories() {
    try {
      const cacheKey = 'categories';
      return await cmsCacheService.getOrSet(this.CACHE_SCOPE, cacheKey, async () => {
        const categories = await db('pipeline_schemas')
          .distinct('category')
          .select('category')
          .whereNotNull('category')
          .orderBy('category');

        return categories.map(c => c.category);
      });
    } catch (error) {
      logger.error('[PipelineSchemaService] Get categories failed:', error);
      throw new AppError('获取分类列表失败', 500);
    }
  }

  /**
   * 获取Schema统计
   */
  async getSchemaStats() {
    try {
      const cacheKey = 'stats';
      return await cmsCacheService.getOrSet(this.CACHE_SCOPE, cacheKey, async () => {
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

        return {
          ...stats,
          category_distribution: categoryStats
        };
      }, { ttl: 300 }); // 5分钟缓存
    } catch (error) {
      logger.error('[PipelineSchemaService] Get stats failed:', error);
      throw new AppError('获取统计信息失败', 500);
    }
  }
}

module.exports = new PipelineSchemaService();