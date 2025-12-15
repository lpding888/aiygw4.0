
import logger from '../../utils/logger.js';

export interface NodeExecutionInput {
    nodeId: string;
    nodeType: string;
    config: any;
    inputs: any; // Merged inputs from dependencies
    context: any;
}

export interface NodeExecutor {
    execute(input: NodeExecutionInput): Promise<any>;
}

class LLMNodeExecutor implements NodeExecutor {
    async execute(input: NodeExecutionInput): Promise<any> {
        // Integrate with existing provider service here
        logger.info(`[Executor] LLM Node ${input.nodeId} executing`);
        return { text: "Mock LLM Response" };
    }
}

class ImageGenNodeExecutor implements NodeExecutor {
    async execute(input: NodeExecutionInput): Promise<any> {
        logger.info(`[Executor] ImageGen Node ${input.nodeId} executing`);
        return { imageUrl: "https://mock.image/1.png" };
    }
}

class NodeRegistry {
    private executors: Map<string, NodeExecutor> = new Map();

    constructor() {
        this.executors.set('llm', new LLMNodeExecutor());
        this.executors.set('image_gen', new ImageGenNodeExecutor());
        // Default handlers for 'input', 'output'?
    }

    getExecutor(type: string): NodeExecutor {
        return this.executors.get(type) || {
            execute: async () => ({ warning: `No executor for ${type}` })
        };
    }
}

export const nodeRegistry = new NodeRegistry();
