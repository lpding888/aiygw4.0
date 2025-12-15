/**
 * Agent 节点执行器
 * 自主决策调用 KB/MCP 工具的智能 Agent
 * 
 * 借鉴 LangGraph 状态机 + OpenAI Tool Use + AutoGPT 自主决策
 */

import logger from '../../utils/logger.js';
import providerRegistryService, { type ProviderCapabilities } from '../../services/provider-registry.service.js';
import agentMemoryService from '../../services/agent-memory.service.js';
import kbRetrieveExecutor from './kb-retrieve.js';
import mcpToolCallExecutor from './mcp-tool-call.js';
import {
    NodeExecutor,
    NodeExecutionContext,
    NodeExecutionResult,
    NodeConfig,
    NodeError,
    NodeErrorType
} from '../types.js';

// ============ 类型定义 ============

interface AgentConfig {
    model: string;
    system_prompt?: string;
    tools: AgentToolConfig[];
    max_iterations: number;
    max_tokens: number;
    timeout_ms: number;
    temperature: number;
    parallel_tool_calls: boolean;
    memory_enabled: boolean;
}

interface AgentToolConfig {
    type: 'kb_retrieve' | 'mcp_tool' | 'code_execute' | 'http_request';
    kb_id?: string;
    mcp_endpoint_ref?: string;
    tool_name?: string;
    description?: string;
}

interface AgentState {
    messages: Message[];
    tools_called: ToolCallLog[];
    iteration: number;
    total_tokens: number;
    final_answer?: string;
}

interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
}

interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

interface ToolCallLog {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result: string;
    duration_ms: number;
    success: boolean;
}

interface OpenAIToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, unknown>;
            required?: string[];
        };
    };
}

// ============ Agent 执行器 ============

class AgentNodeExecutor implements NodeExecutor {
    /**
     * 执行 Agent 节点
     */
    async execute(context: NodeExecutionContext): Promise<NodeExecutionResult> {
        const startTime = Date.now();

        try {
            const config = this.parseConfig(context.node);

            logger.info(`[Agent] 开始执行: flowId=${context.flowContext.flowId} nodeId=${context.node.id} model=${config.model}`);

            // 1. 获取模型能力
            const capabilities = providerRegistryService.getModelCapabilities(config.model);

            // 2. 如果模型不支持 tool_use，降级为普通 LLM 调用
            if (!capabilities?.tool_use) {
                logger.warn(`[Agent] 模型 ${config.model} 不支持 tool_use，降级为普通 LLM`);
                return this.executeFallbackLLM(config, context, startTime);
            }

            // 3. 执行 Agent 循环
            return this.executeAgentLoop(config, context, capabilities, startTime);
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`[Agent] 执行失败: nodeId=${context.node.id}`, error);

            return {
                success: false,
                outputs: {},
                duration,
                error: this.createError(
                    'AGENT_EXECUTION_FAILED',
                    error instanceof Error ? error.message : String(error),
                    NodeErrorType.EXECUTION_FAILED
                )
            };
        }
    }

    /**
     * 验证节点配置
     */
    validate(config: NodeConfig): boolean {
        const nodeConfig = config.config as any;
        if (!nodeConfig?.model) {
            return false;
        }
        return true;
    }

    /**
     * Agent 主循环
     */
    private async executeAgentLoop(
        config: AgentConfig,
        context: NodeExecutionContext,
        capabilities: ProviderCapabilities,
        startTime: number
    ): Promise<NodeExecutionResult> {
        // 初始化状态
        const state: AgentState = {
            messages: this.buildInitialMessages(config, context),
            tools_called: [],
            iteration: 0,
            total_tokens: 0
        };

        // 构建工具定义
        const toolDefinitions = await this.buildToolDefinitions(config.tools, context);

        // 主循环
        while (state.iteration < config.max_iterations) {
            state.iteration++;

            // 检查超时
            if (Date.now() - startTime > config.timeout_ms) {
                logger.warn(`[Agent] 执行超时: iteration=${state.iteration}`);
                break;
            }

            logger.debug(`[Agent] 迭代 ${state.iteration}/${config.max_iterations}`);

            // 1. 调用 LLM
            const response = await this.callLLMWithTools(
                config,
                state.messages,
                toolDefinitions,
                capabilities
            );

            state.total_tokens += response.usage?.total_tokens || 0;

            // Token 预算检查
            if (state.total_tokens > config.max_tokens) {
                logger.warn(`[Agent] Token 预算超限: ${state.total_tokens}/${config.max_tokens}`);
                state.final_answer = response.content || '由于 Token 限制，无法完成回答。';
                break;
            }

            // 2. 检查是否需要调用工具
            if (response.tool_calls && response.tool_calls.length > 0) {
                // 添加 assistant 消息（包含 tool_calls）
                state.messages.push({
                    role: 'assistant',
                    content: response.content || '',
                    tool_calls: response.tool_calls
                });

                // 执行工具（并行或顺序）
                const results = config.parallel_tool_calls && capabilities.parallel_tool_use
                    ? await this.executeToolsParallel(response.tool_calls, context)
                    : await this.executeToolsSequential(response.tool_calls, context);

                // 添加工具结果到消息
                for (const result of results) {
                    state.messages.push({
                        role: 'tool',
                        content: result.result,
                        tool_call_id: result.id
                    });
                    state.tools_called.push(result);
                }
            } else {
                // 3. LLM 直接返回最终答案
                state.final_answer = response.content;
                break;
            }
        }

        const duration = Date.now() - startTime;

        // 如果循环结束但没有最终答案，生成一个
        if (!state.final_answer) {
            state.final_answer = '达到最大迭代次数，未能完成任务。';
        }

        logger.info(`[Agent] 执行完成: iterations=${state.iteration} tools_called=${state.tools_called.length} tokens=${state.total_tokens} duration=${duration}ms`);

        // 合并结果到流程状态
        context.flowContext.state.agent_response = state.final_answer;
        context.flowContext.state.agent_tool_calls = state.tools_called;

        // 记忆系统集成：保存任务到长期记忆
        if (config.memory_enabled) {
            const userId = context.flowContext.userId || 'anonymous';
            const sessionId = context.flowContext.executionId;

            try {
                // 保存任务历史
                await agentMemoryService.saveTaskToLongTerm(userId, {
                    taskId: context.node.id,
                    description: String(context.flowContext.state.input || '').slice(0, 100),
                    toolsUsed: state.tools_called.map(t => t.name),
                    success: true
                });

                // 持久化短期记忆
                await agentMemoryService.persistShortTerm(sessionId);

                logger.debug(`[Agent] 记忆已保存: userId=${userId}`);
            } catch (memError) {
                logger.warn('[Agent] 保存记忆失败', memError);
            }
        }

        return {
            success: true,
            outputs: {
                response: state.final_answer,
                tool_calls: state.tools_called,
                iterations: state.iteration,
                tokens_used: state.total_tokens
            },
            duration
        };
    }

    /**
     * 降级为普通 LLM 调用（不支持 tool_use 时）
     */
    private async executeFallbackLLM(
        config: AgentConfig,
        context: NodeExecutionContext,
        startTime: number
    ): Promise<NodeExecutionResult> {
        const messages = this.buildInitialMessages(config, context);

        const response = await this.callLLM(config.model, messages, config.temperature);

        const duration = Date.now() - startTime;

        context.flowContext.state.agent_response = response.content;

        return {
            success: true,
            outputs: {
                response: response.content,
                tool_calls: [],
                iterations: 1,
                tokens_used: response.usage?.total_tokens || 0,
                fallback_mode: true
            },
            duration
        };
    }

    /**
     * 构建初始消息
     */
    private buildInitialMessages(config: AgentConfig, context: NodeExecutionContext): Message[] {
        const messages: Message[] = [];

        // System prompt
        if (config.system_prompt) {
            messages.push({
                role: 'system',
                content: config.system_prompt
            });
        } else {
            messages.push({
                role: 'system',
                content: '你是一个智能助手，可以根据需要使用工具来完成任务。请分析用户的请求，决定是否需要使用工具，然后给出最终回答。'
            });
        }

        // User input from flow state
        const userInput = context.flowContext.state.input || context.flowContext.state.user_input || '';
        if (userInput) {
            messages.push({
                role: 'user',
                content: String(userInput)
            });
        }

        return messages;
    }

    /**
     * 构建工具定义（OpenAI 格式）
     */
    private async buildToolDefinitions(
        tools: AgentToolConfig[],
        context: NodeExecutionContext
    ): Promise<OpenAIToolDefinition[]> {
        const definitions: OpenAIToolDefinition[] = [];

        for (const tool of tools) {
            switch (tool.type) {
                case 'kb_retrieve':
                    definitions.push({
                        type: 'function',
                        function: {
                            name: `kb_retrieve_${tool.kb_id || 'default'}`,
                            description: tool.description || '从知识库中检索与查询相关的文档',
                            parameters: {
                                type: 'object',
                                properties: {
                                    query: { type: 'string', description: '搜索查询关键词' },
                                    top_k: { type: 'integer', description: '返回结果数量', default: 5 }
                                },
                                required: ['query']
                            }
                        }
                    });
                    break;

                case 'mcp_tool':
                    if (tool.mcp_endpoint_ref && tool.tool_name) {
                        definitions.push({
                            type: 'function',
                            function: {
                                name: `mcp_${tool.tool_name}`,
                                description: tool.description || `调用 MCP 工具: ${tool.tool_name}`,
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        input: { type: 'string', description: '工具输入参数' }
                                    },
                                    required: ['input']
                                }
                            }
                        });
                    }
                    break;

                case 'code_execute':
                    definitions.push({
                        type: 'function',
                        function: {
                            name: 'code_execute',
                            description: tool.description || '执行 JavaScript 代码片段',
                            parameters: {
                                type: 'object',
                                properties: {
                                    code: { type: 'string', description: '要执行的 JavaScript 代码' }
                                },
                                required: ['code']
                            }
                        }
                    });
                    break;

                case 'http_request':
                    definitions.push({
                        type: 'function',
                        function: {
                            name: 'http_request',
                            description: tool.description || '发送 HTTP 请求',
                            parameters: {
                                type: 'object',
                                properties: {
                                    url: { type: 'string', description: '请求 URL' },
                                    method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' },
                                    body: { type: 'string', description: 'POST 请求体' }
                                },
                                required: ['url']
                            }
                        }
                    });
                    break;
            }
        }

        return definitions;
    }

    /**
     * 调用 LLM（带工具）
     */
    private async callLLMWithTools(
        config: AgentConfig,
        messages: Message[],
        tools: OpenAIToolDefinition[],
        capabilities: ProviderCapabilities
    ): Promise<{
        content?: string;
        tool_calls?: ToolCall[];
        usage?: { total_tokens: number };
    }> {
        // 通过 ProviderRegistry 调用 LLM
        const providerRef = `llm_${config.model.split('-')[0]}`;

        try {
            const result = await providerRegistryService.execute(
                providerRef,
                'execute',
                [{
                    messages,
                    model: config.model,
                    temperature: config.temperature,
                    tools: tools.length > 0 ? tools : undefined,
                    tool_choice: tools.length > 0 ? 'auto' : undefined
                }, 'agent-node']
            ) as any;

            return {
                content: result.text || result.content,
                tool_calls: result.tool_calls,
                usage: result.usage
            };
        } catch (error) {
            logger.error(`[Agent] LLM 调用失败`, error);
            throw error;
        }
    }

    /**
     * 调用 LLM（不带工具）
     */
    private async callLLM(
        model: string,
        messages: Message[],
        temperature: number
    ): Promise<{
        content: string;
        usage?: { total_tokens: number };
    }> {
        const providerRef = `llm_${model.split('-')[0]}`;

        const result = await providerRegistryService.execute(
            providerRef,
            'execute',
            [{
                messages,
                model,
                temperature
            }, 'agent-node']
        ) as any;

        return {
            content: result.text || result.content,
            usage: result.usage
        };
    }

    /**
     * 并行执行工具
     */
    private async executeToolsParallel(
        toolCalls: ToolCall[],
        context: NodeExecutionContext
    ): Promise<ToolCallLog[]> {
        const results = await Promise.all(
            toolCalls.map(call => this.executeSingleTool(call, context))
        );
        return results;
    }

    /**
     * 顺序执行工具
     */
    private async executeToolsSequential(
        toolCalls: ToolCall[],
        context: NodeExecutionContext
    ): Promise<ToolCallLog[]> {
        const results: ToolCallLog[] = [];
        for (const call of toolCalls) {
            const result = await this.executeSingleTool(call, context);
            results.push(result);
        }
        return results;
    }

    /**
     * 执行单个工具
     */
    private async executeSingleTool(
        toolCall: ToolCall,
        context: NodeExecutionContext
    ): Promise<ToolCallLog> {
        const startTime = Date.now();
        const toolName = toolCall.function.name;
        let args: Record<string, unknown> = {};

        try {
            args = JSON.parse(toolCall.function.arguments);
        } catch {
            args = { raw: toolCall.function.arguments };
        }

        logger.debug(`[Agent] 执行工具: ${toolName}`, args);

        try {
            let result: string;

            if (toolName.startsWith('kb_retrieve_')) {
                // KB 检索
                const kbId = toolName.replace('kb_retrieve_', '');
                const kbResult = await kbRetrieveExecutor.execute({
                    ...context,
                    node: {
                        ...context.node,
                        config: {
                            ...context.node.config,
                            query: args.query as string,
                            kbId: kbId !== 'default' ? kbId : undefined,
                            topK: (args.top_k as number) || 5
                        }
                    }
                });
                result = JSON.stringify(kbResult.outputs);
            } else if (toolName.startsWith('mcp_')) {
                // MCP 工具调用
                const mcpToolName = toolName.replace('mcp_', '');
                const mcpResult = await mcpToolCallExecutor.execute({
                    ...context,
                    node: {
                        ...context.node,
                        config: {
                            ...context.node.config,
                            toolName: mcpToolName,
                            parameters: args
                        }
                    }
                });
                result = JSON.stringify(mcpResult.outputs);
            } else if (toolName === 'code_execute') {
                // 代码执行（简化版，实际应使用沙箱）
                result = '代码执行功能暂未启用';
            } else if (toolName === 'http_request') {
                // HTTP 请求（简化版）
                result = 'HTTP 请求功能暂未启用';
            } else {
                result = `未知工具: ${toolName}`;
            }

            const duration = Date.now() - startTime;
            logger.debug(`[Agent] 工具执行完成: ${toolName} duration=${duration}ms`);

            return {
                id: toolCall.id,
                name: toolName,
                arguments: args,
                result,
                duration_ms: duration,
                success: true
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : String(error);

            logger.error(`[Agent] 工具执行失败: ${toolName}`, error);

            return {
                id: toolCall.id,
                name: toolName,
                arguments: args,
                result: `工具执行失败: ${errorMsg}`,
                duration_ms: duration,
                success: false
            };
        }
    }

    /**
     * 解析节点配置
     */
    private parseConfig(node: NodeConfig): AgentConfig {
        const nodeConfig = node.config as any;
        return {
            model: nodeConfig.model || 'deepseek-chat',
            system_prompt: nodeConfig.system_prompt,
            tools: nodeConfig.tools || [],
            max_iterations: nodeConfig.max_iterations || 5,
            max_tokens: nodeConfig.max_tokens || 10000,
            timeout_ms: nodeConfig.timeout_ms || 120000,
            temperature: nodeConfig.temperature ?? 0.7,
            parallel_tool_calls: nodeConfig.parallel_tool_calls ?? true,
            memory_enabled: nodeConfig.memory_enabled ?? false
        };
    }

    /**
     * 创建错误对象
     */
    private createError(code: string, message: string, type: NodeErrorType): NodeError {
        return { code, message, type };
    }
}

export default new AgentNodeExecutor();
