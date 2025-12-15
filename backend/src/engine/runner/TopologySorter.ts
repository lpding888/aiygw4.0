import { PipelineSchemaV1Type, PipelineNodeType } from '../protocol.js';

export enum TopologyErrorType {
    CYCLE_DETECTED = 'CYCLE_DETECTED',
    ISOLATE_NODE = 'ISOLATE_NODE',
    UNREACHABLE_NODE = 'UNREACHABLE_NODE',
    EMPTY_GRAPH = 'EMPTY_GRAPH',
    INVALID_STRUCTURE = 'INVALID_STRUCTURE',
}

export interface ValidationError {
    type: TopologyErrorType;
    message: string;
    nodeIds?: string[];
}

export interface ExecutionBatch {
    nodeIds: string[];
}

/**
 * TopologySorter: The Brain of the DAG.
 * Responsibilities:
 * 1. Validate the graph structure (Cycles, Orphans).
 * 2. Sort nodes into parallel execution batches (Kahn's Algorithm variant).
 * 3. Enforce "Reachability" from a set of Entry Nodes (nodes with 0 in-degree).
 */
export class TopologySorter {

    /**
     * Main Entry point.
     * Returns a 2D array of node IDs (batches) if valid.
     * Throws ValidationError if invalid.
     */
    static sort(pipeline: PipelineSchemaV1Type): ExecutionBatch[] {
        const { nodes, edges } = pipeline;

        if (nodes.length === 0) {
            return [];
        }

        // 1. Build Adjacency List & In-Degree Map
        const adj = new Map<string, string[]>();
        const inDegree = new Map<string, number>();
        const nodeMap = new Map<string, PipelineNodeType>();

        // Initialize maps
        for (const node of nodes) {
            adj.set(node.id, []);
            inDegree.set(node.id, 0);
            nodeMap.set(node.id, node);
        }

        // Populate edges
        for (const edge of edges) {
            if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
                throw {
                    type: TopologyErrorType.INVALID_STRUCTURE,
                    message: `Edge references missing nodes: ${edge.source} -> ${edge.target}`
                } as ValidationError;
            }
            adj.get(edge.source)!.push(edge.target);
            inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }

        // 2. Identify Entry Nodes (In-Degree 0)
        const queue: string[] = []; // Zero in-degree nodes

        for (const [nodeId, degree] of inDegree.entries()) {
            if (degree === 0) {
                queue.push(nodeId);
            }
        }

        // Check for Isolates
        const isolates: string[] = [];
        if (nodes.length > 1) {
            for (const nodeId of queue) {
                if ((adj.get(nodeId) || []).length === 0) {
                    isolates.push(nodeId);
                }
            }
        }

        if (isolates.length > 0) {
            throw {
                type: TopologyErrorType.ISOLATE_NODE,
                message: `Found isolated nodes (diconnected from graph): ${isolates.join(', ')}`,
                nodeIds: isolates
            } as ValidationError;
        }

        // 3. Kahn's Algorithm for Topological Sort & Batching
        const batches: ExecutionBatch[] = [];
        let visitedCount = 0;

        let currentBatchNodes = [...queue];

        while (currentBatchNodes.length > 0) {
            batches.push({ nodeIds: currentBatchNodes });
            visitedCount += currentBatchNodes.length;

            const nextBatchNodes: string[] = [];

            // Process current level
            for (const nodeId of currentBatchNodes) {
                const neighbors = adj.get(nodeId) || [];
                for (const neighbor of neighbors) {
                    const currentDegree = inDegree.get(neighbor)! - 1;
                    inDegree.set(neighbor, currentDegree);

                    if (currentDegree === 0) {
                        nextBatchNodes.push(neighbor);
                    }
                }
            }

            currentBatchNodes = nextBatchNodes;
        }

        // 4. Cycle Detection
        if (visitedCount !== nodes.length) {
            const unvisited = nodes.filter((n: PipelineNodeType) => {
                return !batches.some((b: ExecutionBatch) => b.nodeIds.includes(n.id));
            }).map((n: PipelineNodeType) => n.id);

            throw {
                type: TopologyErrorType.CYCLE_DETECTED,
                message: `Cycle detected or nodes unreachable. Unvisited: ${unvisited.length}`,
                nodeIds: unvisited
            } as ValidationError;
        }

        return batches;
    }

    /**
     * Helper to get direct dependencies of a specific node
     */
    static getUpstreamDependencies(pipeline: PipelineSchemaV1Type, nodeId: string): string[] {
        return pipeline.edges
            .filter((e: any) => e.target === nodeId)
            .map((e: any) => e.source);
    }
}
