import logger from '../../utils/logger.js';
import { createHttpClient } from '../../utils/httpClient.js';
import aiHelperService from '../aiHelper.service.js';

export interface DeepSeekProviderInput {
  prompt: string;
  messages?: Array<{ role: string; content: string }>; // 支持完整历史
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

export interface DeepSeekProviderResult {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

interface DeepSeekResponse {
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
  model: string;
}

class DeepSeekProvider {
  private config?: { apiKey?: string; baseURL?: string };

  private readonly httpClient = createHttpClient({
    serviceName: 'deepseek',
    timeoutMs: 60000,
    maxRetries: 2
  });

  private readonly fallbackEndpoint = 'https://api.deepseek.com/chat/completions';

  constructor(config?: { apiKey?: string; baseURL?: string }) {
    this.config = config;
  }

  async execute(input: DeepSeekProviderInput, taskId: string): Promise<DeepSeekProviderResult> {
    const {
      prompt,
      messages,
      systemPrompt = 'You are a helpful assistant.',
      model,
      temperature = 0.3,
      maxTokens = 2000,
      apiKey
    } = input;

    // 如果传入了 messages，则 prompt 可选 (但通常我们会把 prompt 追加到 messages 最后)
    if (!prompt && (!messages || messages.length === 0)) {
      throw new Error('缺少必要参数: prompt 或 messages');
    }

    const runtimeConfig = await aiHelperService.getRuntimeConfig({ apiKey: apiKey || this.config?.apiKey });
    const deepseekApiKey = runtimeConfig.apiKey;
    if (!deepseekApiKey) {
      throw new Error(
        '未配置DeepSeek API Key，请在系统配置中填写或设置环境变量 DEEPSEEK_API_KEY'
      );
    }

    let endpoint = this.config?.baseURL || runtimeConfig.chatEndpoint || this.fallbackEndpoint;

    // 智能修正: 如果是 DeepSeek 且 URL 不包含 chat/completions，自动追加
    if (endpoint.includes('deepseek.com') && !endpoint.includes('/chat/completions')) {
      // 去除末尾斜杠
      endpoint = endpoint.replace(/\/$/, '');
      endpoint = `${endpoint}/chat/completions`;
    }

    const resolvedEndpoint = endpoint;
    const resolvedModel = model ?? runtimeConfig.defaultModel ?? 'deepseek-chat';

    // 构造最终的消息列表
    let finalMessages: Array<{ role: string; content: string }> = [];

    if (messages && messages.length > 0) {
      finalMessages = [...messages];
      // 如果有 prompt，追加到最后作为 user 消息
      if (prompt) {
        finalMessages.push({ role: 'user', content: prompt });
      }
      // 确保第一条是 system (如果输入里没有的话，且有默认systemPrompt)
      if (finalMessages.length > 0 && finalMessages[0].role !== 'system') {
        finalMessages.unshift({ role: 'system', content: systemPrompt });
      }
    } else {
      // 旧模式：仅 prompt
      finalMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];
    }

    try {
      logger.info(
        `[DeepSeekProvider] 开始调用 taskId=${taskId} model=${resolvedModel} endpoint=${resolvedEndpoint} msgCount=${finalMessages.length}`
      );

      const response = await this.httpClient.request<DeepSeekResponse>({
        method: 'POST',
        url: resolvedEndpoint,
        headers: {
          Authorization: `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          model: resolvedModel,
          messages: finalMessages,
          temperature,
          max_tokens: maxTokens
        }
      });

      const data = response.data as DeepSeekResponse;
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error('DeepSeek 返回数据格式错误');
      }

      const result: DeepSeekProviderResult = {
        text: choice.message.content,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0
        },
        model: data.model
      };

      logger.info(
        `[DeepSeekProvider] 调用成功 taskId=${taskId} tokens=${result.usage.totalTokens}`
      );

      return result;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[DeepSeekProvider] 调用失败 taskId=${taskId} error=${err.message}`, {
        taskId,
        error: err
      });
      throw err;
    }
  }
}

export default DeepSeekProvider;
