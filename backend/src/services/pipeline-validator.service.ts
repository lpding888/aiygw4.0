/**
 * Pipeline Schema验证服务
 *
 * 验证流程拓扑的合法性，包括：
 * - 拓扑排序检测循环
 * - 节点完整性检查
 * - 变量可达性验证
 * - 条件分支完整性检查
 * - 输出覆盖验证
 */

const logger = require('../utils/logger');

interface PipelineNode {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  inputs: string[];
  outputs: string[];
  position?: { x: number; y: number };
}

interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  condition?: string; // 条件表达式
  label?: string;
}

interface PipelineVariable {
  name: string;
  type: string;
  source: string; // 来源节点
  description?: string;
}

interface PipelineSchema {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  variables: PipelineVariable[];
  metadata?: Record<string, any>;
}

interface ValidationResult {
  valid: boolean;
  errors: Array<{
    type: string;
    message: string;
    nodeId?: string;
    severity: 'error' | 'warning';
  }>;
  warnings: Array<{
    type: string;
    message: string;
    nodeId?: string;
  }>;
}

interface TopologySortResult {
  sorted: string[];
  hasCycle: boolean;
  cycleNodes?: string[];
}

class PipelineValidatorService {
  /**
   * 验证完整的Pipeline Schema
   */
  async validatePipeline(pipeline: PipelineSchema): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    try {
      // 1. 基础结构验证
      this.validateBasicStructure(pipeline, errors);

      // 2. 拓扑排序和循环检测
      const topologyResult = this.validateTopology(pipeline, errors);

      // 3. 节点完整性验证
      this.validateNodes(pipeline, errors);

      // 4. 边的合法性验证
      this.validateEdges(pipeline, topologyResult, errors);

      // 5. 变量可达性验证
      this.validateVariables(pipeline, topologyResult, errors);

      // 6. 条件分支完整性验证
      this.validateConditionalBranches(pipeline, errors);

      // 7. 输出覆盖验证
      this.validateOutputCoverage(pipeline, errors);

      // 8. 性能和最佳实践检查
      this.validatePerformance(pipeline, warnings);

      // 9. 安全性检查
      this.validateSecurity(pipeline, warnings);

      const result: ValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings
      };

      logger.info('Pipeline验证完成', {
        nodeId: pipeline.metadata?.name || 'unknown',
        valid: result.valid,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return result;
    } catch (error) {
      logger.error('Pipeline验证过程中发生错误:', error);
      return {
        valid: false,
        errors: [
          {
            type: 'system_error',
            message: '验证过程中发生系统错误',
            severity: 'error'
          }
        ],
        warnings: []
      };
    }
  }

  /**
   * 验证基础结构
   */
  private validateBasicStructure(
    pipeline: PipelineSchema,
    errors: ValidationResult['errors']
  ): void {
    // 检查必要字段
    if (!pipeline.nodes || !Array.isArray(pipeline.nodes)) {
      errors.push({
        type: 'missing_nodes',
        message: 'Pipeline必须包含nodes数组',
        severity: 'error'
      });
      return;
    }

    if (!pipeline.edges || !Array.isArray(pipeline.edges)) {
      errors.push({
        type: 'missing_edges',
        message: 'Pipeline必须包含edges数组',
        severity: 'error'
      });
      return;
    }

    // 检查节点唯一性
    const nodeIds = new Set<string>();
    for (const node of pipeline.nodes) {
      if (!node.id) {
        errors.push({
          type: 'missing_node_id',
          message: '所有节点必须有id字段',
          nodeId: node.type,
          severity: 'error'
        });
        continue;
      }

      if (nodeIds.has(node.id)) {
        errors.push({
          type: 'duplicate_node_id',
          message: `节点ID重复: ${node.id}`,
          nodeId: node.id,
          severity: 'error'
        });
      } else {
        nodeIds.add(node.id);
      }

      // 验证节点类型
      if (!node.type) {
        errors.push({
          type: 'missing_node_type',
          message: '节点必须有type字段',
          nodeId: node.id,
          severity: 'error'
        });
      }
    }

    // 检查边的合法性
    const edgeIds = new Set<string>();
    for (const edge of pipeline.edges) {
      if (!edge.source || !edge.target) {
        errors.push({
          type: 'invalid_edge',
          message: '边必须有source和target字段',
          severity: 'error'
        });
        continue;
      }

      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        errors.push({
          type: 'invalid_edge_reference',
          message: `边引用了不存在的节点: ${edge.source} -> ${edge.target}`,
          severity: 'error'
        });
      }

      if (edge.id && edgeIds.has(edge.id)) {
        errors.push({
          type: 'duplicate_edge_id',
          message: `边ID重复: ${edge.id}`,
          severity: 'error'
        });
        edgeIds.add(edge.id);
      } else if (edge.id) {
        edgeIds.add(edge.id);
      }
    }
  }

  /**
   * 验证拓扑结构（检测循环）
   */
  private validateTopology(
    pipeline: PipelineSchema,
    errors: ValidationResult['errors']
  ): TopologySortResult {
    const { nodes, edges } = pipeline;
    const nodeIds = new Set(nodes.map((n) => n.id));
    const adjacencyList = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    // 构建邻接表和入度
    for (const node of nodes) {
      adjacencyList.set(node.id, new Set());
      inDegree.set(node.id, 0);
    }

    for (const edge of edges) {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        adjacencyList.get(edge.source)!.add(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      }
    }

    // Kahn算法进行拓扑排序
    const queue: string[] = [];
    const result: string[] = [];

    // 找到所有入度为0的节点
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const neighbors = adjacencyList.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          const newDegree = (inDegree.get(neighbor) || 0) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0) {
            queue.push(neighbor);
          }
        }
      }
    }

    // 检查是否有循环
    const hasCycle = result.length !== nodes.length;

    if (hasCycle) {
      // 找出循环中的节点
      const remainingNodes = nodes.filter((n) => !result.includes(n.id));
      errors.push({
        type: 'cycle_detected',
        message: 'Pipeline存在循环依赖',
        severity: 'error'
      });

      return {
        sorted: result,
        hasCycle: true,
        cycleNodes: remainingNodes.map((n) => n.id)
      };
    }

    return {
      sorted: result,
      hasCycle: false
    };
  }

  /**
   * 验证节点配置
   */
  private validateNodes(pipeline: PipelineSchema, errors: ValidationResult['errors']): void {
    for (const node of pipeline.nodes) {
      // 验证START节点
      if (node.type === 'START' && node.inputs.length > 0) {
        errors.push({
          type: 'invalid_start_node',
          message: 'START节点不应该有输入',
          nodeId: node.id,
          severity: 'error'
        });
      }

      // 验证END节点
      if (node.type === 'END' && node.outputs.length > 0) {
        errors.push({
          type: 'invalid_end_node',
          message: 'END节点不应该有输出',
          nodeId: node.id,
          severity: 'error'
        });
      }

      // 验证数据处理节点
      if (['TRANSFORM', 'FILTER', 'MERGE', 'SPLIT'].includes(node.type)) {
        if (!node.inputs || node.inputs.length === 0) {
          errors.push({
            type: 'missing_inputs',
            message: `${node.type}节点必须有输入`,
            nodeId: node.id,
            severity: 'error'
          });
        }

        if (!node.outputs || node.outputs.length === 0) {
          errors.push({
            type: 'missing_outputs',
            message: `${node.type}节点必须有输出`,
            nodeId: node.id,
            severity: 'error'
          });
        }
      }

      // 验证条件节点
      if (node.type === 'CONDITION') {
        if (!node.config || !node.config.condition) {
          errors.push({
            type: 'missing_condition',
            message: 'CONDITION节点必须有condition配置',
            nodeId: node.id,
            severity: 'error'
          });
        }
      }
    }
  }

  /**
   * 验证边的合法性
   */
  private validateEdges(
    pipeline: PipelineSchema,
    topologyResult: TopologySortResult,
    errors: ValidationResult['errors']
  ): void {
    const { nodes, edges } = pipeline;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    for (const edge of edges) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      if (!sourceNode || !targetNode) continue;

      // 验证边类型的合法性
      if (edge.condition) {
        // 条件边只能从CONDITION节点发出
        if (sourceNode.type !== 'CONDITION') {
          errors.push({
            type: 'invalid_conditional_edge',
            message: '条件边只能从CONDITION节点发出',
            nodeId: edge.source,
            severity: 'error'
          });
        }

        // 条件边的验证逻辑
        try {
          // 这里可以添加条件表达式的验证逻辑
          this.validateConditionExpression(edge.condition, edge.source, edge.target, errors);
        } catch (error: any) {
          // 艹，TypeScript的error类型是unknown，需要转换！
          errors.push({
            type: 'invalid_condition_expression',
            message: `条件表达式无效: ${error.message}`,
            nodeId: edge.source,
            severity: 'error'
          });
        }
      }

      // 验证变量类型匹配
      if (sourceNode.outputs && targetNode.inputs) {
        const sourceOutputs = new Set(sourceNode.outputs);
        const targetInputs = new Set(targetNode.inputs);

        // 检查是否有匹配的变量
        const hasMatchingVariable = [...sourceOutputs].some((output) => targetInputs.has(output));
        if (!hasMatchingVariable) {
          errors.push({
            type: 'variable_mismatch',
            message: '边的源节点和目标节点之间没有匹配的变量',
            severity: 'warning'
          });
        }
      }
    }

    // 检查每个节点是否至少有一个输入或输出（除了START/END）
    for (const node of nodes) {
      if (node.type !== 'START' && node.type !== 'END') {
        const hasInput = edges.some((e) => e.target === node.id);
        const hasOutput = edges.some((e) => e.source === node.id);

        if (!hasInput) {
          errors.push({
            type: 'isolated_node',
            message: `节点没有输入连接: ${node.name} (${node.id})`,
            nodeId: node.id,
            severity: 'warning'
          });
        }

        if (!hasOutput) {
          errors.push({
            type: 'dead_end_node',
            message: `节点没有输出连接: ${node.name} (${node.id})`,
            nodeId: node.id,
            severity: 'warning'
          });
        }
      }
    }
  }

  /**
   * 验证变量可达性
   */
  private validateVariables(
    pipeline: PipelineSchema,
    topologyResult: TopologySortResult,
    errors: ValidationResult['errors']
  ): void {
    const { nodes, variables } = pipeline;
    const variableSources = new Map<string, string>();

    // 收集所有变量的来源节点
    for (const node of nodes) {
      if (node.outputs) {
        for (const output of node.outputs) {
          variableSources.set(output, node.id);
        }
      }
    }

    // 验证每个变量都有来源
    for (const variable of variables) {
      if (!variableSources.has(variable.name)) {
        errors.push({
          type: 'undefined_variable',
          message: `变量没有定义来源: ${variable.name}`,
          severity: 'error'
        });
      }
    }

    // 验证变量使用情况
    const usedVariables = new Set<string>();
    for (const node of nodes) {
      if (node.inputs) {
        for (const input of node.inputs) {
          usedVariables.add(input);
        }
      }
    }

    // 检查未使用的变量
    for (const variable of variables) {
      if (!usedVariables.has(variable.name)) {
        errors.push({
          type: 'unused_variable',
          message: `定义了但未使用的变量: ${variable.name}`,
          nodeId: variable.source,
          severity: 'warning'
        });
      }
    }
  }

  /**
   * 验证条件分支完整性
   */
  private validateConditionalBranches(
    pipeline: PipelineSchema,
    errors: ValidationResult['errors']
  ): void {
    const { nodes, edges } = pipeline;

    for (const node of nodes) {
      if (node.type === 'CONDITION') {
        // 找出所有从该节点发出的边
        const outgoingEdges = edges.filter((e) => e.source === node.id);

        if (outgoingEdges.length < 2) {
          errors.push({
            type: 'insufficient_branches',
            message: `CONDITION节点至少需要2个分支: ${node.name}`,
            nodeId: node.id,
            severity: 'error'
          });
          continue;
        }

        // 检查是否有默认分支（无条件边）
        const hasDefaultBranch = outgoingEdges.some((e) => !e.condition);
        if (!hasDefaultBranch) {
          errors.push({
            type: 'missing_default_branch',
            message: `CONDITION节点建议包含默认分支: ${node.name}`,
            nodeId: node.id,
            severity: 'warning'
          });
        }

        // 检查条件的互斥性
        // 艹，过滤掉undefined的condition！
        const conditions = outgoingEdges
          .filter((e) => e.condition)
          .map((e) => e.condition) as string[];
        this.validateConditionMutualExclusivity(conditions, node.id, errors);
      }
    }
  }

  /**
   * 验证输出覆盖
   */
  private validateOutputCoverage(
    pipeline: PipelineSchema,
    errors: ValidationResult['errors']
  ): void {
    const { nodes, edges } = pipeline;

    // 找到所有END节点
    const endNodes = nodes.filter((n) => n.type === 'END');

    if (endNodes.length === 0) {
      errors.push({
        type: 'missing_end_node',
        message: 'Pipeline必须包含至少一个END节点',
        severity: 'error'
      });
      return;
    }

    // 检查是否有节点无法到达END节点
    const reachableFromEnd = new Set<string>();

    // 反向DFS从END节点开始
    for (const endNode of endNodes) {
      this.reverseDFS(endNode.id, edges, reachableFromEnd);
    }

    for (const node of nodes) {
      if (node.type !== 'START' && !reachableFromEnd.has(node.id)) {
        errors.push({
          type: 'unreachable_node',
          message: `节点无法到达END节点: ${node.name} (${node.id})`,
          nodeId: node.id,
          severity: 'error'
        });
      }
    }
  }

  /**
   * 验证性能和最佳实践
   */
  private validatePerformance(
    pipeline: PipelineSchema,
    warnings: ValidationResult['warnings']
  ): void {
    const { nodes, edges } = pipeline;

    // 检查节点数量
    if (nodes.length > 50) {
      warnings.push({
        type: 'too_many_nodes',
        message: `Pipeline节点数量过多(${nodes.length})，可能影响性能`
      });
    }

    // 检查边的数量
    if (edges.length > 100) {
      warnings.push({
        type: 'too_many_edges',
        message: `Pipeline边数量过多(${edges.length})，可能影响性能`
      });
    }

    // 检查节点深度
    const maxDepth = this.calculateMaxDepth(pipeline);
    if (maxDepth > 20) {
      warnings.push({
        type: 'too_deep_pipeline',
        message: `Pipeline深度过深(${maxDepth})，可能影响执行效率`
      });
    }

    // 检查是否存在大量并行分支
    const maxParallelBranches = this.calculateMaxParallelBranches(pipeline);
    if (maxParallelBranches > 10) {
      warnings.push({
        type: 'too_many_parallel_branches',
        message: `并行分支数量过多(${maxParallelBranches})，可能影响资源使用`
      });
    }
  }

  /**
   * 验证安全性
   */
  private validateSecurity(pipeline: PipelineSchema, warnings: ValidationResult['warnings']): void {
    const { nodes } = pipeline;

    for (const node of nodes) {
      // 检查是否使用了危险的操作
      if (node.config) {
        const configStr = JSON.stringify(node.config).toLowerCase();

        if (
          configStr.includes('eval(') ||
          configStr.includes('exec(') ||
          configStr.includes('system(')
        ) {
          warnings.push({
            type: 'dangerous_operation',
            message: `节点配置包含潜在危险操作: ${node.name}`,
            nodeId: node.id
          });
        }

        // 检查是否有明文密码或密钥
        if (
          configStr.includes('password') ||
          configStr.includes('secret') ||
          configStr.includes('key')
        ) {
          warnings.push({
            type: 'sensitive_data',
            message: `节点配置可能包含敏感数据，建议使用加密存储: ${node.name}`,
            nodeId: node.id
          });
        }
      }
    }
  }

  /**
   * 验证条件表达式
   */
  private validateConditionExpression(
    condition: string,
    sourceNodeId: string,
    targetNodeId: string,
    errors: ValidationResult['errors']
  ): void {
    // 简单的条件表达式验证
    // 实际实现可以根据需要扩展
    const validOperators = ['==', '!=', '>', '<', '>=', '<=', '&&', '||'];
    const hasValidOperator = validOperators.some((op) => condition.includes(op));

    if (!hasValidOperator && condition.length > 0) {
      errors.push({
        type: 'invalid_condition_syntax',
        message: '条件表达式语法无效',
        nodeId: sourceNodeId,
        severity: 'error' // 艹，必须加上severity字段！
      });
    }
  }

  /**
   * 验证条件的互斥性
   */
  private validateConditionMutualExclusivity(
    conditions: string[],
    nodeId: string,
    errors: ValidationResult['errors']
  ): void {
    // 简单的互斥性检查
    // 实际实现可以根据需要扩展
    if (conditions.length > 5) {
      errors.push({
        type: 'too_many_conditions',
        message: `条件分支过多(${conditions.length})，建议简化逻辑`,
        nodeId: nodeId,
        severity: 'warning'
      });
    }
  }

  /**
   * 反向DFS遍历
   */
  private reverseDFS(nodeId: string, edges: PipelineEdge[], visited: Set<string>): void {
    if (visited.has(nodeId)) return;

    visited.add(nodeId);

    for (const edge of edges) {
      if (edge.target === nodeId) {
        this.reverseDFS(edge.source, edges, visited);
      }
    }
  }

  /**
   * 计算Pipeline最大深度
   */
  private calculateMaxDepth(pipeline: PipelineSchema): number {
    const { nodes, edges } = pipeline;
    const startNodes = nodes.filter((n) => n.type === 'START');

    if (startNodes.length === 0) return 0;

    let maxDepth = 0;

    const calculateDepth = (nodeId: string, visited: Set<string>, depth: number) => {
      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      maxDepth = Math.max(maxDepth, depth);

      const outgoingEdges = edges.filter((e) => e.source === nodeId);
      for (const edge of outgoingEdges) {
        calculateDepth(edge.target, visited, depth + 1);
      }
    };

    for (const startNode of startNodes) {
      calculateDepth(startNode.id, new Set(), 0);
    }

    return maxDepth;
  }

  /**
   * 计算最大并行分支数
   */
  private calculateMaxParallelBranches(pipeline: PipelineSchema): number {
    const { nodes, edges } = pipeline;

    let maxParallel = 0;

    for (const node of nodes) {
      const outgoingEdges = edges.filter((e) => e.source === node.id);
      maxParallel = Math.max(maxParallel, outgoingEdges.length);
    }

    return maxParallel;
  }
}

const pipelineValidatorService = new PipelineValidatorService();
module.exports = pipelineValidatorService;
