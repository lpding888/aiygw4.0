import logger from '../../utils/logger.js';
import { createHttpClient } from '../../utils/httpClient.js';
import systemConfigService from '../systemConfig.service.js';

export interface LlmInput {
  systemPrompt?: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  responseFormat?: 'text' | 'json_object'; // 支持强制 JSON 输出
}

export interface LlmResult {
  content: string;
  parsed?: Record<string, unknown>; // 如果是 JSON，自动解析
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface OpenAIChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class LlmProvider {
  private readonly httpClient;
  private apiKey: string | null = null;
  private apiUrl: string = 'https://api.openai.com/v1/chat/completions'; // 默认值，可配置

  constructor(private readonly providerRef: string) {
    logger.info(`[LlmProvider] 初始化 providerRef=${providerRef}`);
    // 初始化 HTTP 客户端
    this.httpClient = createHttpClient({
      serviceName: 'llm',
      timeoutMs: 60000, // LLM 比较慢，给 60s 超时
      maxRetries: 1
    });
  }

  /**
   * 获取配置 (支持多模型配置)
   */
  private async loadConfig(): Promise<void> {
    // 从系统配置里读 API Key 和 URL
    // 这里的 key 设计为 llm_provider_{ref}_api_key，支持多个 LLM 供应商
    const configKeyPrefix = `llm_${this.providerRef}`;

    const key = await systemConfigService.get(`${configKeyPrefix}_api_key`);
    const url = await systemConfigService.get(`${configKeyPrefix}_api_url`);

    if (key && typeof key === 'string') this.apiKey = key;
    if (url && typeof url === 'string') this.apiUrl = url;

    // 如果没配，尝试读取通用的 llm_default_api_key
    if (!this.apiKey) {
      const defaultKey = await systemConfigService.get('llm_default_api_key');
      if (defaultKey && typeof defaultKey === 'string') this.apiKey = defaultKey;
    }
  }

  async execute(input: LlmInput, taskId: string): Promise<LlmResult> {
    const {
      systemPrompt = 'You are a helpful assistant.',
      userPrompt,
      model = 'gpt-3.5-turbo',
      temperature = 0.7,
      responseFormat
    } = input;

    if (!userPrompt) {
      throw new Error('缺少必要参数: userPrompt');
    }

    try {
      await this.loadConfig();
      if (!this.apiKey) {
        throw new Error('LLM API Key 未配置');
      }

      logger.info(`[LlmProvider] 开始调用 LLM taskId=${taskId} model=${model}`);

      const requestBody: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature
      };

      // 如果要求返回 JSON
      if (responseFormat === 'json_object') {
        requestBody.response_format = { type: 'json_object' };
      }

      const response = await this.httpClient.post<OpenAIChatResponse>(this.apiUrl, requestBody, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const content = response?.choices?.[0]?.message?.content || '';
      const usage = {
        promptTokens: response?.usage?.prompt_tokens || 0,
        completionTokens: response?.usage?.completion_tokens || 0,
        totalTokens: response?.usage?.total_tokens || 0
      };

      logger.info(`[LlmProvider] 调用成功 taskId=${taskId} tokens=${usage.totalTokens}`);

      let parsed: Record<string, unknown> | undefined;

      // 尝试解析 JSON
      if (responseFormat === 'json_object' || content.trim().startsWith('{')) {
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          logger.warn(`[LlmProvider] JSON 解析失败: ${content.substring(0, 50)}...`);
        }
      }

      return {
        content,
        parsed,
        usage
      };
    } catch (error) {
      const err = error as Error;
      logger.error(`[LlmProvider] 执行失败 taskId=${taskId}`, error);
      throw err;
    }
  }
}

export default LlmProvider;
