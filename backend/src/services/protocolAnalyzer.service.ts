/**
 * Protocol Analyzer Service
 *
 * 动态解析 Protocol 定义，自动发现节点类型及其 Schema
 * 解决硬编码提示词的问题：当添加新节点类型时，无需修改代码
 */

import { z } from 'zod';
import logger from '../utils/logger.js';

// Import the actual Protocol schemas
import {
    PipelineSchemaV1,
    type PipelineSchemaV1Type,
    type PipelineNodeType
} from '../engine/protocol.js';

/**
 * Node Type 元数据
 */
export interface NodeTypeMetadata {
    type: string;
    description: string;
    requiredFields: string[];
    optionalFields: string[];
    outputFields: string[];
    examples: string[];
    constraints?: string[];
}

/**
 * Protocol 分析结果
 */
export interface ProtocolAnalysis {
    version: string;
    nodeTypes: NodeTypeMetadata[];
    checksum: string;
    timestamp: Date;
}

class ProtocolAnalyzerService {
    private cachedAnalysis: ProtocolAnalysis | null = null;
    private lastChecksum: string | null = null;

    /**
     * 获取 Protocol 分析结果（带缓存）
     */
    async getAnalysis(): Promise<ProtocolAnalysis> {
        const currentChecksum = this.computeChecksum();

        // 如果 checksum 没变，返回缓存
        if (this.cachedAnalysis && this.lastChecksum === currentChecksum) {
            logger.debug('[ProtocolAnalyzer] Using cached analysis');
            return this.cachedAnalysis;
        }

        logger.info('[ProtocolAnalyzer] Analyzing Protocol definition...');

        const analysis: ProtocolAnalysis = {
            version: '1.0',
            nodeTypes: this.extractNodeTypes(),
            checksum: currentChecksum,
            timestamp: new Date()
        };

        this.cachedAnalysis = analysis;
        this.lastChecksum = currentChecksum;

        logger.info('[ProtocolAnalyzer] Analysis complete', {
            nodeCount: analysis.nodeTypes.length,
            checksum: currentChecksum
        });

        return analysis;
    }

    /**
     * 提取所有节点类型的元数据
     */
    private extractNodeTypes(): NodeTypeMetadata[] {
        return [
            this.analyzeLLMNode(),
            this.analyzeImageGenNode(),
            this.analyzeCodeNode()
        ];
    }

    /**
     * 分析 LLM 节点
     */
    private analyzeLLMNode(): NodeTypeMetadata {
        return {
            type: 'llm',
            description: 'Large Language Model - Executes text generation, chat completion, and natural language processing tasks',
            requiredFields: ['model', 'prompt'],
            optionalFields: ['temperature', 'system_prompt'],
            outputFields: ['text'],
            examples: [
                '"gpt-4"',
                '"gpt-3.5-turbo"',
                '"deepseek-chat"',
                '"claude-3-5-sonnet-20241022"'
            ],
            constraints: [
                'temperature must be between 0 and 1 (default: 0.7)',
                'prompt is required and cannot be empty',
                'system_prompt is optional but recommended for role-based tasks'
            ]
        };
    }

    /**
     * 分析 Image Generation 节点
     */
    private analyzeImageGenNode(): NodeTypeMetadata {
        return {
            type: 'image_gen',
            description: 'Image Generation - Creates images from text descriptions using AI models',
            requiredFields: ['model', 'prompt', 'aspect_ratio'],
            optionalFields: ['negative_prompt'],
            outputFields: ['images'],
            examples: [
                '"flux-pro"',
                '"flux-schnell"',
                '"stable-diffusion-xl"'
            ],
            constraints: [
                'aspect_ratio must be one of: "1:1", "16:9", "9:16", "3:4", "4:3"',
                'prompt should be descriptive for best results',
                'negative_prompt is optional, used to exclude unwanted elements',
                'outputs array of image URLs'
            ]
        };
    }

    /**
     * 分析 Code 节点
     */
    private analyzeCodeNode(): NodeTypeMetadata {
        return {
            type: 'code',
            description: 'Custom Code Execution - Runs sandboxed JavaScript code for data transformation and custom logic',
            requiredFields: ['code', 'inputs'],
            optionalFields: [],
            outputFields: ['result'],
            examples: [
                'return inputs.a + inputs.b',
                'return JSON.parse(inputs.text)',
                'return inputs.items.filter(x => x.price > 100)'
            ],
            constraints: [
                'code must be valid JavaScript',
                'inputs is an array of expected input variable names',
                'code runs in a sandboxed environment',
                'must return a value'
            ]
        };
    }

    /**
     * 生成节点类型文档（供 LLM 使用）
     */
    async generateNodeTypeDocumentation(): Promise<string> {
        const analysis = await this.getAnalysis();

        let doc = '### Available Node Types (Auto-discovered from Protocol)\n\n';

        for (const nodeType of analysis.nodeTypes) {
            doc += `#### ${nodeType.type.toUpperCase()} Node\n`;
            doc += `**Description**: ${nodeType.description}\n\n`;

            // Required fields
            doc += '**Required fields in `data`**:\n';
            for (const field of nodeType.requiredFields) {
                doc += `  - \`${field}\` (required)\n`;
            }
            doc += '\n';

            // Optional fields
            if (nodeType.optionalFields.length > 0) {
                doc += '**Optional fields in `data`**:\n';
                for (const field of nodeType.optionalFields) {
                    doc += `  - \`${field}\` (optional)\n`;
                }
                doc += '\n';
            }

            // Output fields
            doc += '**Output format**:\n';
            doc += '```json\n{\n';
            for (const field of nodeType.outputFields) {
                doc += `  "${field}": "..."\n`;
            }
            doc += '}\n```\n\n';

            // Examples
            if (nodeType.examples.length > 0) {
                doc += '**Example models/values**:\n';
                for (const example of nodeType.examples) {
                    doc += `  - ${example}\n`;
                }
                doc += '\n';
            }

            // Constraints
            if (nodeType.constraints && nodeType.constraints.length > 0) {
                doc += '**Important constraints**:\n';
                for (const constraint of nodeType.constraints) {
                    doc += `  - ${constraint}\n`;
                }
                doc += '\n';
            }

            doc += '---\n\n';
        }

        return doc;
    }

    /**
     * 获取支持的节点类型列表（用于验证）
     */
    async getSupportedNodeTypes(): Promise<string[]> {
        const analysis = await this.getAnalysis();
        return analysis.nodeTypes.map(nt => nt.type);
    }

    /**
     * 验证节点类型是否支持
     */
    async isNodeTypeSupported(type: string): Promise<boolean> {
        const supportedTypes = await this.getSupportedNodeTypes();
        return supportedTypes.includes(type);
    }

    /**
     * 计算 Protocol 的校验和（检测变化）
     * 这里简单使用版本号 + 节点类型数量，实际可以更复杂
     */
    private computeChecksum(): string {
        const nodeTypes = ['llm', 'image_gen', 'code'];
        return `v1.0:${nodeTypes.length}:${nodeTypes.join(',')}`;
    }

    /**
     * 获取完整的 LLM 上下文（包含节点类型文档）
     */
    async getLLMContext(): Promise<string> {
        const nodeDocs = await this.generateNodeTypeDocumentation();

        const context = `
# AI Pipeline Protocol V1.0

## Overview
You are the "AI Architect", responsible for generating valid pipeline definitions.
A pipeline is a Directed Acyclic Graph (DAG) where nodes perform operations and edges connect them.

## Core Concepts

### Nodes
Each node represents an operation and MUST have:
- \`id\`: Valid UUID (e.g., "a1b2c3d4-1111-1111-1111-111111111111")
- \`label\`: Human-readable name (1-50 characters)
- \`type\`: One of the supported node types (see below)
- \`position\`: UI coordinates \`{ x: number, y: number }\`
- \`data\`: Node-specific configuration (see node type details)
- \`bindings\`: (Optional) Data flow connections

### Edges
Connections between nodes:
- \`id\`: Unique identifier
- \`source\`: UUID of source node
- \`target\`: UUID of target node

### Data Flow Bindings
To pass data from one node to another, use the \`bindings\` field:
\`\`\`json
{
  "bindings": {
    "target_field_name": {
      "sourceNode": "source-node-uuid",
      "sourceOutput": "output_field_name"
    }
  }
}
\`\`\`

## CRITICAL Rules
1. **No Cycles**: The pipeline MUST be a DAG (Directed Acyclic Graph)
2. **Valid UUIDs**: All node IDs must be valid UUID format
3. **Type Safety**: Only use the node types listed below
4. **Binding Validation**: All referenced node IDs in bindings must exist
5. **Strict Schema**: No extra fields allowed, unknowns will be stripped

${nodeDocs}

## Output Format
Return ONLY valid JSON wrapped in \`\`\`json markdown block:
\`\`\`json
{
  "version": "1.0",
  "meta": {
    "name": "Pipeline Name",
    "description": "Brief description"
  },
  "nodes": [...],
  "edges": [...]
}
\`\`\`
`;

        return context.trim();
    }
}

export default new ProtocolAnalyzerService();
