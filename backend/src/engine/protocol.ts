import { z } from 'zod';

/**
 * AI-Native Factory - Core Protocol Definition
 * 
 * This file is the SINGLE SOURCE OF TRUTH for the pipeline data structure.
 * It is used by both the Backend Engine (for validation) and the Frontend Builder (via shared types).
 * 
 * CORE PRINCIPLES:
 * 1. Strict Typing: Any unknown keys are STRIPPED to prevent injection.
 * 2. Version Gating: Schema MUST have version='1.0'.
 * 3. Atomic Nodes: Nodes are strictly typed by their functionality.
 */

// --- 1. Node Definitions ---

const BaseNodeSchema = z.object({
    id: z.string().uuid(),
    label: z.string().min(1).max(50),
    // Position is purely for UI, Engine ignores it but stores it.
    position: z.object({
        x: z.number(),
        y: z.number(),
    }),
    // Data Flow Bindings: targetField -> { sourceNode, sourceOutput }
    bindings: z.record(z.string(), z.object({
        sourceNode: z.string().uuid(),
        sourceOutput: z.string(),
    })).optional(),
});

const LLMNodeSchema = BaseNodeSchema.extend({
    type: z.literal('llm'),
    data: z.object({
        model: z.string(),
        prompt: z.string(),
        temperature: z.number().min(0).max(1).optional().default(0.7),
        system_prompt: z.string().optional(),
    }).strict(),
});

const ImageGenNodeSchema = BaseNodeSchema.extend({
    type: z.literal('image_gen'),
    data: z.object({
        model: z.string(), // e.g. "flux-pro"
        prompt: z.string(),
        aspect_ratio: z.enum(['1:1', '16:9', '9:16', '3:4', '4:3']),
        negative_prompt: z.string().optional(),
    }).strict(),
});

// A versatile Code Node for custom logic (Sandboxed)
const CodeNodeSchema = BaseNodeSchema.extend({
    type: z.literal('code'),
    data: z.object({
        code: z.string(), // JS/Python code
        inputs: z.array(z.string()), // Expected input variable names
    }).strict(),
});

// Agent Node - Autonomous tool-calling agent
const AgentNodeSchema = BaseNodeSchema.extend({
    type: z.literal('agent'),
    data: z.object({
        model: z.string(), // LLM model to use
        system_prompt: z.string().optional(),

        // Tool configuration
        tools: z.array(z.object({
            type: z.enum(['kb_retrieve', 'mcp_tool', 'code_execute', 'http_request']),
            kb_id: z.string().optional(),           // For kb_retrieve
            mcp_endpoint_ref: z.string().optional(), // For mcp_tool
            tool_name: z.string().optional(),        // For mcp_tool
            description: z.string().optional(),      // Override tool description
        })).optional().default([]),

        // Safety constraints
        max_iterations: z.number().min(1).max(10).default(5),
        max_tokens: z.number().min(100).max(100000).default(10000),
        timeout_ms: z.number().min(1000).max(300000).default(120000),
        temperature: z.number().min(0).max(1).default(0.7),

        // Advanced options
        parallel_tool_calls: z.boolean().default(true),
        memory_enabled: z.boolean().default(false),
    }).strict(),
});

// Union of all possible node types
const PipelineNodeSchema = z.discriminatedUnion('type', [
    LLMNodeSchema,
    ImageGenNodeSchema,
    CodeNodeSchema,
    AgentNodeSchema,
]);

// --- 2. Edge Definition ---

const PipelineEdgeSchema = z.object({
    id: z.string(),
    source: z.string().uuid(),
    target: z.string().uuid(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
}).strict();

// --- 3. Pipeline Meta Definition (V1) ---

export const PipelineSchemaV1 = z.object({
    version: z.literal('1.0'), // STRICT VERSION GATE
    meta: z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        tags: z.array(z.string()).optional(),
    }).strict(),
    nodes: z.array(PipelineNodeSchema),
    edges: z.array(PipelineEdgeSchema),
    // Global config (e.g. timeout, retry policy for the whole pipeline)
    config: z.object({
        max_duration_seconds: z.number().max(3600).default(600),
        concurrency_limit: z.number().min(1).max(10).default(1),
        // @ts-ignore
    }).default({}),
}).strict(); // STRIP UNKNOWN KEYS for security!

export type PipelineSchemaV1Type = z.infer<typeof PipelineSchemaV1>;
export type PipelineNodeType = z.infer<typeof PipelineNodeSchema>;

// --- 4. Validation Helper ---

export class ProtocolValidator {
    /**
     * Validates a raw JSON object against Schema V1.
     * Throws ZodError if invalid.
     */
    static validate(json: unknown): PipelineSchemaV1Type {
        const result = PipelineSchemaV1.safeParse(json);
        if (!result.success) {
            // In a real scenario, we might want to format this error better
            throw new Error(`Protocol Violation: ${result.error.message}`);
        }
        return result.data;
    }

    /**
     * CI Checksum Placeholder
     * In a CI environment, you would run this to ensure backend/frontend types are aligned.
     */
    static getChecksum(): string {
        // Implementation would involve hashing this file content
        return "PROTOCOL_V1_CHECKSUM_placeholder";
    }
}

// --- 5. Upgrader Registry (Placeholder for V1 -> V2) ---

type Upgrader = (old: any) => any;
const UpgraderRegistry: Record<string, Upgrader> = {
    // '0.9': (old) => { ... transform to 1.0 ... }
};

export const upgradePipeline = (json: any): any => {
    // Logic to find current version and apply chain of upgraders
    // For V1 (Greenfield), we just reject anything that isn't 1.0
    if (json.version !== '1.0') {
        throw new Error(`Unsupported schema version: ${json.version}. Migration required.`);
    }
    return json;
}
