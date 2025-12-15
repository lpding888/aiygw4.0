import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { PipelineSchemaV1, PipelineSchemaV1Type, PipelineNodeType } from '../lib/pipeline/protocol';
import { v4 as uuidv4 } from 'uuid';

interface PipelineState {
    currentPipeline: PipelineSchemaV1Type | null;
    isDirty: boolean;
    validationErrors: string[];
    validationWarnings: string[];

    // Actions
    initNewPipeline: (name: string) => void;
    loadPipeline: (json: any) => Promise<boolean>; // Returns success/fail
    addNode: (type: 'llm' | 'image_gen' | 'code' | 'agent', position: { x: number, y: number }) => void;
    updateNodeData: (id: string, data: any) => void;
    updateNodeBindings: (id: string, bindings: Record<string, { sourceNode: string, sourceOutput: string }>) => void;
    updateNodePosition: (id: string, position: { x: number, y: number }) => void;
    validate: () => boolean;

    // UI State
    selectedNodeId: string | null;
    setSelectedNode: (id: string | null) => void;
}

export const usePipelineStore = create<PipelineState>()(
    immer((set, get) => ({
        currentPipeline: null,
        isDirty: false,
        validationErrors: [],
        validationWarnings: [],
        selectedNodeId: null,

        initNewPipeline: (name: string) => {
            set((state) => {
                state.currentPipeline = {
                    version: '1.0',
                    meta: { name },
                    nodes: [],
                    edges: [],
                    config: { max_duration_seconds: 600, concurrency_limit: 1 }
                };
                state.isDirty = false;
                state.validationErrors = [];
                state.validationWarnings = [];
            });
        },

        loadPipeline: async (json: any) => {
            try {
                // Strict V1 Validation on Load
                // If it fails, we reject it (Safe Load)
                const parsed = PipelineSchemaV1.parse(json);
                set((state) => {
                    state.currentPipeline = parsed;
                    state.isDirty = false;
                    state.validationErrors = [];
                    state.validationWarnings = [];
                });
                return true;
            } catch (e: any) {
                console.error("Failed to load pipeline:", e);
                set((state) => {
                    state.validationErrors = [`Failed to load: ${e.message}`];
                });
                return false;
            }
        },

        addNode: (type, position) => {
            const newNodeId = uuidv4();
            let newNode: PipelineNodeType;

            // Factory Logic for Defaults
            if (type === 'llm') {
                newNode = {
                    id: newNodeId,
                    type: 'llm',
                    label: 'New LLM Node',
                    position,
                    data: { model: 'gpt-3.5-turbo', prompt: '' } as any
                };
            } else if (type === 'image_gen') {
                newNode = {
                    id: newNodeId,
                    type: 'image_gen',
                    label: 'New Image Node',
                    position,
                    data: { model: 'flux-pro', prompt: '', aspect_ratio: '1:1' } as any
                };
            } else if (type === 'agent') {
                newNode = {
                    id: newNodeId,
                    type: 'agent',
                    label: 'New Agent Node',
                    position,
                    data: {
                        model: 'deepseek-chat',
                        system_prompt: 'You are a helpful assistant.',
                        max_iterations: 10,
                        temperature: 0.7,
                        tools: [],
                        parallel_tool_calls: false,
                        memory_enabled: false
                    } as any
                };
            } else {
                newNode = {
                    id: newNodeId,
                    type: 'code',
                    label: 'New Code Node',
                    position,
                    data: { code: '// custom logic', inputs: [] } as any
                };
            }

            set((state) => {
                if (state.currentPipeline) {
                    state.currentPipeline.nodes.push(newNode);
                    state.isDirty = true;
                }
            });
        },

        updateNodeData: (id, data) => {
            set((state) => {
                const node = state.currentPipeline?.nodes.find(n => n.id === id);
                if (node) {
                    // Deep merge or replace? Replace for simplicity in strict mode
                    // But we must preserve type.
                    // Ideally we should type check 'data' against the node type data schema
                    if (node.type === 'llm') {
                        node.data = { ...node.data, ...data };
                    } else if (node.type === 'image_gen') {
                        node.data = { ...node.data, ...data };
                    } else if (node.type === 'code') {
                        node.data = { ...node.data, ...data };
                    } else if (node.type === 'agent') {
                        node.data = { ...node.data, ...data };
                    }
                    state.isDirty = true;
                }
            });
        },

        updateNodePosition: (id, position) => {
            set((state) => {
                const node = state.currentPipeline?.nodes.find(n => n.id === id);
                if (node) {
                    node.position = position;
                    state.isDirty = true; // Position change might not mark dirty if trivial?
                }
            });
        },

        updateNodeBindings: (id: string, bindings: Record<string, { sourceNode: string, sourceOutput: string }>) => {
            set((state) => {
                const node = state.currentPipeline?.nodes.find(n => n.id === id);
                if (node) {
                    node.bindings = bindings;
                    state.isDirty = true;
                }
            });
        },

        validate: () => {
            const current = get().currentPipeline;
            if (!current) return false;

            const errors: string[] = [];
            const warnings: string[] = [];

            // 1. Strict Schema Validation (Critical)
            const result = PipelineSchemaV1.safeParse(current);
            if (!result.success) {
                errors.push(...result.error.errors.map(e => `[Protocol] ${e.path.join('.')}: ${e.message}`));
            }

            // 2. Connectivity Checks (Warning)
            const nodeIds = new Set(current.nodes.map(n => n.id));
            const connectedNodes = new Set<string>();
            current.edges.forEach(e => {
                connectedNodes.add(e.source);
                connectedNodes.add(e.target);
            });
            // Also check bindings
            current.nodes.forEach(n => {
                if (n.bindings) Object.values(n.bindings).forEach((b: any) => {
                    connectedNodes.add(n.id);
                    if (b.sourceNode) connectedNodes.add(b.sourceNode);
                });
            });

            current.nodes.forEach(n => {
                if (!connectedNodes.has(n.id) && current.nodes.length > 1) {
                    warnings.push(`[Topology] Node '${n.id.slice(0, 8)}...' is isolated (no edges).`);
                }
            });

            // 3. Configuration Checks (Warning)
            current.nodes.forEach(n => {
                if (n.type === 'llm' && (!n.data.prompt || n.data.prompt.length < 5)) {
                    warnings.push(`[Config] Node '${n.label}' has empty or short prompt.`);
                }
                if (n.type === 'image_gen' && !n.data.prompt) {
                    warnings.push(`[Config] Node '${n.label}' missing image generation prompt.`);
                }
            });

            set((state) => {
                state.validationErrors = errors;
                state.validationWarnings = warnings;
            });

            return errors.length === 0;
        },

        setSelectedNode: (id) => {
            set((state) => {
                state.selectedNodeId = id;
            });
        }
    }))
);
