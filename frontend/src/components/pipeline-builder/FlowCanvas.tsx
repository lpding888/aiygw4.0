import React, { useCallback } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    NodeChange,
    EdgeChange,
    applyNodeChanges,
    applyEdgeChanges
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { usePipelineStore } from '../../stores/usePipelineStore';

// Mappers to convert shared protocol to React Flow format
const protocolToFlow = (pipeline: any) => {
    if (!pipeline) return { nodes: [], edges: [] };

    // Nodes
    const nodes = pipeline.nodes.map((n: any) => ({
        id: n.id,
        type: n.type, // Map 'llm' -> 'llmNode' component if needed
        position: n.position,
        data: { label: n.label, ...n.data }
    }));

    // Edges (Execution Flow)
    const executionEdges = pipeline.edges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: 'default',
        style: { stroke: '#555', strokeWidth: 2 },
        animated: false,
    }));

    // Data Flow Edges (Derived from Bindings)
    // bindings: { "targetField": { sourceNode: "id", sourceOutput: "output" } }
    const dataEdges: any[] = [];
    pipeline.nodes.forEach((node: any) => {
        if (node.bindings) {
            Object.entries(node.bindings).forEach(([field, binding]: [string, any]) => {
                if (binding.sourceNode) {
                    dataEdges.push({
                        id: `data-${node.id}-${field}`,
                        source: binding.sourceNode,
                        target: node.id,
                        type: 'default',
                        animated: true,
                        style: {
                            stroke: '#a855f7', // Purple-ish for data
                            strokeWidth: 1.5,
                            strokeDasharray: '5,5',
                            opacity: 0.7
                        },
                        label: field,
                        labelStyle: { fill: '#a855f7', fontSize: 10 },
                        data: { isDataFlow: true }
                    });
                }
            });
        }
    });

    return { nodes, edges: [...executionEdges, ...dataEdges] };
};

export function FlowCanvas() {
    const { currentPipeline, updateNodePosition } = usePipelineStore();

    // TODO: Ideally we sync store -> useNodesState or use store directly.
    // For "Controlled" React Flow, we pass nodes/edges and onNodesChange calls store actions.
    const { nodes, edges } = protocolToFlow(currentPipeline);
    const { setSelectedNode } = usePipelineStore();

    const onNodesChange = useCallback((changes: NodeChange[]) => {
        changes.forEach(change => {
            if (change.type === 'position' && change.position) {
                updateNodePosition(change.id, change.position);
            }
        });
    }, [updateNodePosition]);

    const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
        setSelectedNode(node.id);
    }, [setSelectedNode]);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, [setSelectedNode]);

    const onConnect = useCallback((params: Connection) => {
        // TODO: Add addEdge action to store
        console.log('Connect:', params);
    }, []);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                fitView
            >
                <Background />
                <Controls />
                <MiniMap />
            </ReactFlow>
        </div>
    );
}
