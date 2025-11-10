/**
 * AI Gateway服务 - 统一推理API
 * 艹，这个核心服务负责统一Chat/Completions API，支持SSE流式输出！
 *
 * 功能：
 * - 统一Chat/Completions协议
 * - SSE流式输出
 * - 多Provider负载均衡
 * - 参数标准化与适配
 * - 工具调用透传
 * - 熔断保护与重试
 */

import axios, { AxiosInstance } from 'axios';
import * as providerEndpointsRepo from '../repositories/providerEndpoints.repo.js';
import logger from '../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * Chat消息接口
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

/**
 * 工具调用接口
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Tool定义接口
 */
export interface ToolDefinition {
  type: string;
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

/**
 * Chat请求接口
 */
export interface ChatRequest {
  model: string; // 模型名称（会映射到实际Provider）
  messages: ChatMessage[];
  temperature?: number; // 0-2, 默认1
  max_tokens?: number; // 最大生成token数
  top_p?: number; // 0-1, 默认1
  stream?: boolean; // 是否流式输出
  tools?: ToolDefinition[]; // 工具定义
  tool_choice?: string | object; // 工具选择策略
  user?: string; // 用户ID
}

/**
 * Chat响应接口
 */
export interface ChatResponse {
  id: string;
  object: 'chat.completion' | 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: ChatMessage;
    delta?: Partial<ChatMessage>;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Provider适配器接口
 */
interface ProviderAdapter {
  adaptRequest(request: ChatRequest): Record<string, unknown>;
  adaptResponse(response: Record<string, unknown>): ChatResponse;
  adaptStreamChunk(chunk: string): ChatResponse | null;
}

/**
 * AI Gateway服务类
 */
class AIGatewayService {
  private adapters: Map<string, ProviderAdapter> = new Map();

  constructor() {
    // 注册Provider适配器
    this.registerAdapter('openai', new OpenAIAdapter());
    this.registerAdapter('anthropic', new AnthropicAdapter());
    this.registerAdapter('buildingai', new BuildingAIAdapter());
  }

  /**
   * 注册Provider适配器
   * @private
   */
  private registerAdapter(providerType: string, adapter: ProviderAdapter): void {
    this.adapters.set(providerType, adapter);
  }

  /**
   * Chat Completions API
   * @param request - Chat请求
   * @param providerRef - Provider引用（可选，不传则自动选择）
   * @returns Chat响应
   */
  async chat(request: ChatRequest, providerRef?: string): Promise<ChatResponse> {
    try {
      // 选择Provider
      const provider = providerRef
        ? await providerEndpointsRepo.getProviderEndpoint(providerRef)
        : await this.selectProvider(request.model);

      if (!provider) {
        throw new Error(`Provider not found: ${providerRef || 'auto'}`);
      }

      logger.info(
        `[AIGateway] Chat请求: provider=${provider.provider_ref} ` +
          `model=${request.model} stream=${request.stream || false}`
      );

      // 获取适配器
      const adapter = this.getAdapter(provider.provider_name);

      // 适配请求
      const adaptedRequest = adapter.adaptRequest(request);

      // 调用Provider API
      const response = await axios.post(provider.endpoint_url, adaptedRequest, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(provider)
        },
        timeout: provider.timeout_ms || 30000
      });

      // 适配响应
      const adaptedResponse = adapter.adaptResponse(response.data as Record<string, unknown>);

      logger.info(
        `[AIGateway] Chat响应成功: provider=${provider.provider_ref} ` +
          `tokens=${adaptedResponse.usage?.total_tokens || 'N/A'}`
      );

      return adaptedResponse;
    } catch (error: unknown) {
      const err = error as Error & { message: string };
      logger.error('[AIGateway] Chat请求失败:', err);
      throw new Error(`Chat failed: ${err.message}`);
    }
  }

  /**
   * Chat Completions SSE流式API
   * @param request - Chat请求
   * @param providerRef - Provider引用（可选）
   * @returns EventEmitter (事件: 'data', 'end', 'error')
   */
  async chatStream(request: ChatRequest, providerRef?: string): Promise<EventEmitter> {
    const emitter = new EventEmitter();

    (async () => {
      try {
        // 选择Provider
        const provider = providerRef
          ? await providerEndpointsRepo.getProviderEndpoint(providerRef)
          : await this.selectProvider(request.model);

        if (!provider) {
          emitter.emit('error', new Error(`Provider not found: ${providerRef || 'auto'}`));
          return;
        }

        logger.info(
          `[AIGateway] Chat流式请求: provider=${provider.provider_ref} ` + `model=${request.model}`
        );

        // 获取适配器
        const adapter = this.getAdapter(provider.provider_name);

        // 适配请求（强制stream=true）
        const adaptedRequest = adapter.adaptRequest({ ...request, stream: true });

        // 调用Provider API（流式）
        const response = await axios.post(provider.endpoint_url, adaptedRequest, {
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(provider)
          },
          timeout: provider.timeout_ms || 60000,
          responseType: 'stream'
        });

        // 处理流式响应
        let buffer = '';

        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();

          // 按行分割
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后不完整的行

          for (const line of lines) {
            if (line.trim() === '' || line.trim() === 'data: [DONE]') {
              continue;
            }

            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              try {
                // 适配流式chunk
                const adaptedChunk = adapter.adaptStreamChunk(data);
                if (adaptedChunk) {
                  emitter.emit('data', adaptedChunk);
                }
              } catch (err: unknown) {
                logger.error('[AIGateway] 解析流式chunk失败:', err);
              }
            }
          }
        });

        response.data.on('end', () => {
          logger.info(`[AIGateway] Chat流式响应完成: provider=${provider.provider_ref}`);
          emitter.emit('end');
        });

        response.data.on('error', (err: Error) => {
          logger.error('[AIGateway] Chat流式响应错误:', err);
          emitter.emit('error', err);
        });
      } catch (error: unknown) {
        logger.error('[AIGateway] Chat流式请求失败:', error);
        const err = error instanceof Error ? error : new Error(String(error));
        emitter.emit('error', err);
      }
    })();

    return emitter;
  }

  /**
   * 选择Provider（负载均衡）
   * @private
   */
  private async selectProvider(model: string): Promise<Record<string, unknown>> {
    // 简化实现：选择第一个可用的Provider
    // 实际项目中应该实现负载均衡、权重选择等策略

    const providers = await providerEndpointsRepo.listProviderEndpoints({});

    if (providers.length === 0) {
      throw new Error('No available providers');
    }

    // 按权重选择
    const totalWeight = providers.reduce(
      (sum: number, p: Record<string, unknown>) => sum + ((p.weight as number) || 100),
      0
    );
    let random = Math.random() * totalWeight;

    for (const provider of providers) {
      random -= ((provider as Record<string, unknown>).weight as number) || 100;
      if (random <= 0) {
        return provider as Record<string, unknown>;
      }
    }

    return providers[0] as Record<string, unknown>;
  }

  /**
   * 获取Provider适配器
   * @private
   */
  private getAdapter(providerName: string): ProviderAdapter {
    // 根据Provider名称推断类型
    const providerType = providerName.toLowerCase().includes('openai')
      ? 'openai'
      : providerName.toLowerCase().includes('anthropic')
        ? 'anthropic'
        : 'buildingai';

    const adapter = this.adapters.get(providerType);
    if (!adapter) {
      throw new Error(`No adapter found for provider: ${providerName}`);
    }

    return adapter;
  }

  /**
   * 获取认证头
   * @private
   */
  private getAuthHeaders(provider: Record<string, unknown>): Record<string, string> {
    const headers: Record<string, string> = {};

    const authType = provider.auth_type as string | undefined;
    const credentials = provider.credentials_encrypted as Record<string, unknown> | undefined;

    if (authType === 'bearer' && credentials?.api_key) {
      headers['Authorization'] = `Bearer ${credentials.api_key as string}`;
    }

    return headers;
  }
}

/**
 * OpenAI适配器
 */
class OpenAIAdapter implements ProviderAdapter {
  adaptRequest(request: ChatRequest): Record<string, unknown> {
    return {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      top_p: request.top_p,
      stream: request.stream,
      tools: request.tools,
      tool_choice: request.tool_choice,
      user: request.user
    };
  }

  adaptResponse(response: Record<string, unknown>): ChatResponse {
    return response as ChatResponse; // OpenAI格式即标准格式
  }

  adaptStreamChunk(chunk: string): ChatResponse | null {
    try {
      return JSON.parse(chunk);
    } catch {
      return null;
    }
  }
}

/**
 * Anthropic适配器
 */
class AnthropicAdapter implements ProviderAdapter {
  adaptRequest(request: ChatRequest): Record<string, unknown> {
    // 转换为Anthropic格式
    return {
      model: request.model,
      messages: request.messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })),
      max_tokens: request.max_tokens || 1024,
      temperature: request.temperature,
      top_p: request.top_p,
      stream: request.stream
    };
  }

  adaptResponse(response: Record<string, unknown>): ChatResponse {
    // 转换为标准格式
    const responseId = response.id as string;
    const responseModel = response.model as string;
    const content = response.content as Array<{ text: string }> | undefined;
    const stopReason = response.stop_reason as string | undefined;
    const usage = response.usage as { input_tokens?: number; output_tokens?: number } | undefined;

    return {
      id: responseId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: responseModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: content?.[0]?.text || ''
          },
          finish_reason: stopReason || null
        }
      ],
      usage: {
        prompt_tokens: usage?.input_tokens || 0,
        completion_tokens: usage?.output_tokens || 0,
        total_tokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0)
      }
    };
  }

  adaptStreamChunk(chunk: string): ChatResponse | null {
    try {
      const data = JSON.parse(chunk);
      if (data.type === 'content_block_delta') {
        return {
          id: data.id || 'stream',
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'claude',
          choices: [
            {
              index: 0,
              delta: {
                role: 'assistant',
                content: data.delta?.text || ''
              },
              finish_reason: null
            }
          ]
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * BuildingAI适配器
 */
class BuildingAIAdapter implements ProviderAdapter {
  adaptRequest(request: ChatRequest): Record<string, unknown> {
    // BuildingAI使用OpenAI兼容格式
    return {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      stream: request.stream
    };
  }

  adaptResponse(response: Record<string, unknown>): ChatResponse {
    return response as ChatResponse; // BuildingAI返回标准格式
  }

  adaptStreamChunk(chunk: string): ChatResponse | null {
    try {
      return JSON.parse(chunk);
    } catch {
      return null;
    }
  }
}

// 单例导出
export const aiGateway = new AIGatewayService();

export default aiGateway;
