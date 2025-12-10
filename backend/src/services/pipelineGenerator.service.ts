import logger from '../utils/logger.js';
import { aiGateway } from './ai-gateway.service.js';
import { PipelineSchemaV1, type PipelineSchemaV1Type } from '../engine/protocol.js';
import { TopologySorter, TopologyErrorType, type ValidationError } from '../engine/runner/TopologySorter.js';
import promptTemplateService from './prompt-template.service.js';
import systemConfigService from './systemConfig.service.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import Redis from 'ioredis';
import type { Redis as RedisInstance } from 'ioredis';

type RedisConstructor = new (...args: unknown[]) => RedisInstance;
const RedisCtor = Redis as unknown as RedisConstructor;

// Error Types
export enum GeneratorErrorType {
    JSON_PARSE_ERROR = 'JSON_PARSE_ERROR',
    SCHEMA_VALIDATION_ERROR = 'SCHEMA_VALIDATION_ERROR',
    TOPOLOGY_ERROR = 'TOPOLOGY_ERROR',
    LLM_ERROR = 'LLM_ERROR',
    RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
    PROMPT_TOO_LONG = 'PROMPT_TOO_LONG'
}

export interface ArchitectResult {
    pipeline: PipelineSchemaV1Type;
    summary: string;
    thinking?: string;
    quality_score?: number;  // 0-100
    confidence?: number;     // 0-1
    attempts?: number;       // Number of attempts needed
}

export class PipelineGeneratorError extends Error {
    constructor(
        message: string,
        public type: GeneratorErrorType = GeneratorErrorType.LLM_ERROR,
        public statusCode = 400
    ) {
        super(message);
        this.name = 'PipelineGeneratorError';
    }
}

class PipelineGeneratorService {
    private readonly MAX_RETRIES = 3;
    private readonly MODEL_FAST = 'deepseek-chat';
    private readonly MODEL_SMART = 'deepseek-chat';
    private readonly MAX_PROMPT_LENGTH = 2000;
    private readonly CACHE_TTL = 3600; // 1 hour
    private redis: RedisInstance;

    constructor() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.redis = new RedisCtor(redisUrl);
        logger.info('[Architect] Initialized with Redis cache');
    }

    /**
     * Generate a new pipeline from scratch
     */
    async generatePipeline(userRequirement: string): Promise<ArchitectResult> {
        // Security: Validate prompt length
        if (userRequirement.length > this.MAX_PROMPT_LENGTH) {
            throw new PipelineGeneratorError(
                `Prompt too long (${userRequirement.length} chars). Maximum is ${this.MAX_PROMPT_LENGTH}.`,
                GeneratorErrorType.PROMPT_TOO_LONG,
                400
            );
        }

        logger.info('[Architect] Generating pipeline...', {
            userRequirement: userRequirement.substring(0, 100) + '...',
            length: userRequirement.length
        });

        // Check cache
        const cacheKey = this.getCacheKey('generate', userRequirement);
        const cached = await this.getFromCache(cacheKey);
        if (cached) {
            logger.info('[Architect] Cache hit');
            return cached;
        }

        // Dynamic Model Selection
        const model = await systemConfigService.get<string>('AI_ARCHITECT_MODEL', this.MODEL_SMART);

        // 使用动态提示词（自动注入节点类型文档）
        const systemPrompt = await promptTemplateService.getArchitectSystemPrompt();

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Requirement: "${userRequirement}"\n\nGenerate a pipeline that fulfills this requirement.` }
        ];

        const result = await this.executeWithAutoFix(messages as any, model as string);

        // Cache the result
        await this.setCache(cacheKey, result);

        return result;
    }

    /**
     * Modify an existing pipeline
     */
    async modifyPipeline(currentPipeline: PipelineSchemaV1Type, modificationRequest: string): Promise<ArchitectResult> {
        // Security: Validate prompt length
        if (modificationRequest.length > this.MAX_PROMPT_LENGTH) {
            throw new PipelineGeneratorError(
                `Modification request too long (${modificationRequest.length} chars).`,
                GeneratorErrorType.PROMPT_TOO_LONG,
                400
            );
        }

        logger.info('[Architect] Modifying pipeline...', {
            modificationRequest: modificationRequest.substring(0, 100) + '...'
        });

        // Dynamic Model Selection
        const model = await systemConfigService.get<string>('AI_ARCHITECT_MODEL', this.MODEL_SMART);

        // 使用动态提示词
        const systemPrompt = await promptTemplateService.getArchitectSystemPrompt();
        const modifyPrompt = await promptTemplateService.getArchitectModifyPrompt();

        const messages = [
            { role: 'system', content: systemPrompt + '\n\n' + modifyPrompt },
            {
                role: 'user',
                content: `Current Pipeline:\n\`\`\`json\n${JSON.stringify(currentPipeline, null, 2)}\n\`\`\`\n\nModification Request: "${modificationRequest}"\n\nReturn the full updated pipeline.`
            }
        ];

        return this.executeWithAutoFix(messages as any, model as string);
    }

    /**
     * Core execution loop with Validation & Auto-Fix
     */
    private async executeWithAutoFix(messages: any[], model: string): Promise<ArchitectResult> {
        logger.info(`[Architect] Executing with model: ${model}`);
        let attempts = 0;
        let lastError: string | null = null;
        let conversation = [...messages];
        let failedResponse: string | null = null;

        while (attempts < this.MAX_RETRIES) {
            attempts++;
            logger.info(`[Architect] Attempt ${attempts}/${this.MAX_RETRIES}`);

            try {
                // 1. Call LLM
                const response = await aiGateway.chat({
                    model: model, // Dynamic model
                    messages: conversation,
                    temperature: 0.2, // Low temp for structure
                    max_tokens: 4000,
                    stream: false
                });

                const content = response.choices[0]?.message?.content || '';

                if (!content) {
                    throw new PipelineGeneratorError(
                        'Empty response from LLM',
                        GeneratorErrorType.LLM_ERROR
                    );
                }

                // 2. Parse JSON
                const jsonStr = this.extractJson(content);
                if (!jsonStr) {
                    throw new PipelineGeneratorError(
                        'No JSON found in response',
                        GeneratorErrorType.JSON_PARSE_ERROR
                    );
                }

                const rawPipeline = JSON.parse(jsonStr);

                // 3. Normalize (ensure IDs and Defaults)
                const normalized = this.normalizePipeline(rawPipeline);

                // 4. Strict Validation (Zod)
                const validation = PipelineSchemaV1.safeParse(normalized);

                if (!validation.success) {
                    const errorMsg = (validation.error as any).errors
                        .map((e: any) => `${e.path.join('.')}: ${e.message}`)
                        .join('; ');
                    throw new PipelineGeneratorError(
                        `Schema validation failed: ${errorMsg}`,
                        GeneratorErrorType.SCHEMA_VALIDATION_ERROR
                    );
                }

                // 5. Topology Validation
                try {
                    TopologySorter.sort(validation.data);
                } catch (topoError: any) {
                    const err = topoError as ValidationError;
                    throw new PipelineGeneratorError(
                        `Topology validation failed: ${err.message}`,
                        GeneratorErrorType.TOPOLOGY_ERROR
                    );
                }

                // 6. Calculate quality score
                const qualityScore = this.calculateQualityScore(validation.data, attempts);

                // 7. Success!
                logger.info('[Architect] Pipeline generated successfully', {
                    attempts,
                    nodeCount: validation.data.nodes.length,
                    edgeCount: validation.data.edges.length,
                    qualityScore
                });

                return {
                    pipeline: validation.data,
                    summary: validation.data.meta?.description || 'Generated by AI Architect',
                    thinking: content,
                    quality_score: qualityScore,
                    confidence: Math.max(0, 1 - (attempts - 1) * 0.3),
                    attempts
                };

            } catch (error: any) {
                lastError = error.message;
                failedResponse = error.response || failedResponse;

                logger.warn(`[Architect] Attempt ${attempts} failed: ${lastError}`);

                // If this was the last attempt, throw
                if (attempts >= this.MAX_RETRIES) {
                    break;
                }

                // Add the failed response to conversation
                if (failedResponse) {
                    conversation.push({
                        role: 'assistant',
                        content: failedResponse
                    });
                }

                // Add error feedback for next attempt (Auto-Fix) - 使用动态提示词
                const errorFeedback = await promptTemplateService.generateErrorFeedback(lastError || '未知错误');

                conversation.push({
                    role: 'user',
                    content: errorFeedback || `请修复以下错误:\n${lastError || '未知错误'}`
                });

                // Small delay before retry
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // All attempts failed
        throw new PipelineGeneratorError(
            `Failed to generate valid pipeline after ${this.MAX_RETRIES} attempts. Last error: ${lastError}`,
            GeneratorErrorType.LLM_ERROR,
            500
        );
    }

    /**
     * Extract JSON from LLM response (supports markdown blocks and raw JSON)
     */
    private extractJson(text: string): string | null {
        // Try 1: Markdown json block
        let match = text.match(/```json\s*([\s\S]*?)```/);
        if (match) return match[1].trim();

        // Try 2: Any markdown block
        match = text.match(/```\s*([\s\S]*?)```/);
        if (match) {
            const content = match[1].trim();
            // Check if it looks like JSON
            if (content.startsWith('{')) {
                return content;
            }
        }

        // Try 3: Find outermost { ... } pair
        const stack: number[] = [];
        let start = -1;

        for (let i = 0; i < text.length; i++) {
            if (text[i] === '{') {
                if (stack.length === 0) start = i;
                stack.push(i);
            } else if (text[i] === '}') {
                stack.pop();
                if (stack.length === 0 && start !== -1) {
                    return text.substring(start, i + 1);
                }
            }
        }

        return null;
    }

    /**
     * Normalize pipeline: ensure all required fields have defaults
     */
    private normalizePipeline(raw: any): any {
        const result: any = {
            version: raw.version || '1.0',
            meta: raw.meta || { name: 'Generated Pipeline', description: 'AI Generated' },
            nodes: raw.nodes || [],
            edges: raw.edges || [],
            config: raw.config || {}
        };

        // Ensure meta has required fields
        if (!result.meta.name) result.meta.name = 'Generated Pipeline';

        // Ensure UUIDs for nodes
        result.nodes.forEach((n: any) => {
            if (!n.id || !this.isValidUUID(n.id)) {
                n.id = uuidv4();
                logger.warn('[Architect] Generated UUID for node', { label: n.label });
            }
            if (!n.label) {
                n.label = `Node ${n.type}`;
            }
        });

        // Ensure edge IDs
        result.edges.forEach((e: any, index: number) => {
            if (!e.id) {
                e.id = `e${index + 1}`;
            }
        });

        // Auto-layout if positions are missing
        let y = 100;
        result.nodes.forEach((n: any) => {
            if (!n.position || typeof n.position.x !== 'number' || typeof n.position.y !== 'number') {
                n.position = { x: 250, y };
                y += 150;
            }
        });

        return result;
    }

    /**
     * Validate UUID format
     */
    private isValidUUID(uuid: string): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    /**
     * Calculate quality score based on various factors
     */
    private calculateQualityScore(pipeline: PipelineSchemaV1Type, attempts: number): number {
        let score = 100;

        // Penalty for multiple attempts
        score -= (attempts - 1) * 20;

        // Reward for good structure
        if (pipeline.nodes.length > 0) score += 5;
        if (pipeline.edges.length > 0) score += 5;
        if (pipeline.meta?.description) score += 10;

        // Penalty for too simple or too complex
        if (pipeline.nodes.length < 2) score -= 10;
        if (pipeline.nodes.length > 10) score -= 5;

        // Reward for using bindings (data flow)
        const nodesWithBindings = pipeline.nodes.filter((n: any) => n.bindings).length;
        score += Math.min(nodesWithBindings * 5, 15);

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Cache helpers
     */
    private getCacheKey(operation: string, input: string): string {
        const hash = crypto.createHash('md5').update(input).digest('hex');
        return `architect:${operation}:${hash}`;
    }

    private async getFromCache(key: string): Promise<ArchitectResult | null> {
        try {
            const cached = await this.redis.get(key);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (error) {
            logger.warn('[Architect] Cache read error', error);
        }
        return null;
    }

    private async setCache(key: string, value: ArchitectResult): Promise<void> {
        try {
            await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(value));
        } catch (error) {
            logger.warn('[Architect] Cache write error', error);
        }
    }
}

export default new PipelineGeneratorService();
