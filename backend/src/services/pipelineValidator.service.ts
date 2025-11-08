import logger from '../utils/logger.js';

type PipelineNodeType = 'start' | 'end' | string;

type PipelineNode = {
  id: string;
  type: PipelineNodeType;
  data?: {
    maxOutputs?: number;
    minOutputs?: number;
    minInputs?: number;
    maxInputs?: number;
    inputMapping?: string;
    outputKey?: string;
  };
};

type PipelineEdge = {
  source: string;
  target: string;
};

type PipelineData = {
  nodes?: PipelineNode[];
  edges?: PipelineEdge[];
};

type CycleDetectionResult = {
  isDAG: boolean;
  topologicalOrder: string[];
  remainingNodes: string[];
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validatePipelineTopology(pipelineData: PipelineData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const { nodes = [], edges = [] } = pipelineData;

    if (nodes.length === 0) {
      errors.push('Pipeline必须至少包含一个节点');
      return { valid: false, errors, warnings };
    }

    const startNodes = nodes.filter((n) => n.type === 'start');
    if (startNodes.length === 0) {
      errors.push('Pipeline必须包含start节点');
    } else if (startNodes.length > 1) {
      errors.push('Pipeline只能有一个start节点');
    }

    const endNodes = nodes.filter((n) => n.type === 'end');
    if (endNodes.length === 0) {
      warnings.push('建议添加end节点以明确Pipeline终点');
    }

    const cycleDetection = detectCyclesUsingKahn(nodes, edges);
    if (!cycleDetection.isDAG) {
      errors.push('Pipeline存在循环依赖（环），无法执行');
      if (cycleDetection.remainingNodes.length > 0) {
        errors.push(`涉及节点: ${cycleDetection.remainingNodes.join(', ')}`);
      }
    }

    errors.push(...validateDegreeRules(nodes, edges));

    const isolatedNodes = findIsolatedNodes(nodes, edges);
    if (isolatedNodes.length > 0) {
      warnings.push(`发现${isolatedNodes.length}个孤立节点（未连接）: ${isolatedNodes.join(', ')}`);
    }

    errors.push(...validateVariableReachability(nodes, edges));

    logger.info('[PipelineValidator] 校验完成', {
      nodesCount: nodes.length,
      edgesCount: edges.length,
      errorsCount: errors.length,
      warningsCount: warnings.length
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    const err = error as Error;
    logger.error('[PipelineValidator] 校验失败', err);
    return {
      valid: false,
      errors: [`校验过程出错: ${err.message}`],
      warnings
    };
  }
}

export function detectCyclesUsingKahn(
  nodes: PipelineNode[],
  edges: PipelineEdge[]
): CycleDetectionResult {
  const adjacencyMap = new Map<string, string[]>();
  const inDegreeMap = new Map<string, number>();

  nodes.forEach((node) => {
    adjacencyMap.set(node.id, []);
    inDegreeMap.set(node.id, 0);
  });

  edges.forEach((edge) => {
    const { source, target } = edge;
    if (!adjacencyMap.has(source) || !adjacencyMap.has(target)) {
      logger.warn('[Kahn] 边引用了不存在的节点', { source, target });
      return;
    }

    adjacencyMap.get(source)?.push(target);
    inDegreeMap.set(target, (inDegreeMap.get(target) ?? 0) + 1);
  });

  const queue: string[] = [];
  const topologicalOrder: string[] = [];

  inDegreeMap.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      break;
    }

    topologicalOrder.push(nodeId);

    const neighbors = adjacencyMap.get(nodeId) ?? [];
    neighbors.forEach((neighbor) => {
      const currentDegree = (inDegreeMap.get(neighbor) ?? 0) - 1;
      inDegreeMap.set(neighbor, currentDegree);
      if (currentDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  const remainingNodes = nodes
    .map((node) => node.id)
    .filter((nodeId) => !topologicalOrder.includes(nodeId));

  return {
    isDAG: remainingNodes.length === 0,
    topologicalOrder,
    remainingNodes
  };
}

export function validateDegreeRules(nodes: PipelineNode[], edges: PipelineEdge[]): string[] {
  const errors: string[] = [];

  nodes.forEach((node) => {
    const incoming = edges.filter((edge) => edge.target === node.id);
    const outgoing = edges.filter((edge) => edge.source === node.id);

    if (node.type === 'start' && incoming.length > 0) {
      errors.push(`start节点 "${node.id}" 不能有入边`);
    }

    if (node.type === 'end' && outgoing.length > 0) {
      errors.push(`end节点 "${node.id}" 不能有出边`);
    }

    const minOutputs = node.data?.minOutputs ?? 1;
    const maxOutputs = node.data?.maxOutputs ?? 5;
    if (outgoing.length < minOutputs) {
      errors.push(`节点 "${node.id}" 至少需要 ${minOutputs} 条出边`);
    }
    if (outgoing.length > maxOutputs) {
      errors.push(`节点 "${node.id}" 最多只能有 ${maxOutputs} 条出边`);
    }

    const minInputs = node.data?.minInputs ?? 0;
    const maxInputs = node.data?.maxInputs ?? 5;
    if (incoming.length < minInputs) {
      errors.push(`节点 "${node.id}" 至少需要 ${minInputs} 条入边`);
    }
    if (incoming.length > maxInputs) {
      errors.push(`节点 "${node.id}" 最多只能有 ${maxInputs} 条入边`);
    }
  });

  return errors;
}

export function findIsolatedNodes(nodes: PipelineNode[], edges: PipelineEdge[]): string[] {
  const connectedNodeIds = new Set<string>();

  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  return nodes.filter((node) => !connectedNodeIds.has(node.id)).map((node) => node.id);
}

export function validateVariableReachability(
  nodes: PipelineNode[],
  edges: PipelineEdge[]
): string[] {
  const errors: string[] = [];
  const reverseAdjacencyMap = buildReverseAdjacency(nodes, edges);

  nodes.forEach((node) => {
    if (node.type === 'start' || node.type === 'end') {
      return;
    }

    const referencedVars = extractReferencedVars(node.data?.inputMapping ?? '');
    if (referencedVars.length === 0) {
      return;
    }

    const reachableVars = getReachableVars(node.id, nodes, reverseAdjacencyMap);
    referencedVars.forEach((varPath) => {
      if (!isVarReachable(varPath, reachableVars)) {
        errors.push(`节点 "${node.id}" 引用了不可达的变量: {{${varPath}}}`);
      }
    });
  });

  return errors;
}

function buildReverseAdjacency(
  nodes: PipelineNode[],
  edges: PipelineEdge[]
): Map<string, string[]> {
  const reverseAdjacency = new Map<string, string[]>();
  nodes.forEach((node) => reverseAdjacency.set(node.id, []));

  edges.forEach((edge) => {
    if (reverseAdjacency.has(edge.target)) {
      reverseAdjacency.get(edge.target)?.push(edge.source);
    }
  });

  return reverseAdjacency;
}

function extractReferencedVars(template: string): string[] {
  if (typeof template !== 'string') {
    return [];
  }

  const regex = /\{\{([^}]+)\}\}/g;
  const vars: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    const varPath = match[1].trim();
    if (varPath.startsWith('#') || varPath.startsWith('/') || varPath.startsWith('!')) {
      continue;
    }

    if (varPath && !vars.includes(varPath)) {
      vars.push(varPath);
    }
  }

  return vars;
}

function getReachableVars(
  nodeId: string,
  nodes: PipelineNode[],
  reverseAdjacencyMap: Map<string, string[]>
): Set<string> {
  const reachableVars = new Set<string>();
  const visited = new Set<string>();

  const dfs = (currentNodeId: string): void => {
    if (visited.has(currentNodeId)) {
      return;
    }
    visited.add(currentNodeId);

    const currentNode = nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) {
      return;
    }

    if (currentNode.type === 'start') {
      reachableVars.add('form');
    }

    reachableVars.add('system');

    if (currentNode.data?.outputKey) {
      reachableVars.add(currentNode.data.outputKey);
    }

    const upstreamNodes = reverseAdjacencyMap.get(currentNodeId) ?? [];
    upstreamNodes.forEach((upstreamId) => dfs(upstreamId));
  };

  dfs(nodeId);

  return reachableVars;
}

function isVarReachable(varPath: string, reachableVars: Set<string>): boolean {
  const rootVar = varPath.split('.')[0];
  return reachableVars.has(rootVar);
}

const pipelineValidator = {
  validatePipelineTopology,
  detectCyclesUsingKahn,
  validateDegreeRules,
  findIsolatedNodes,
  validateVariableReachability
};

export default pipelineValidator;
