/**
 * OpenAI Provider
 * 支持 GPT-4, GPT-4o, GPT-3.5-turbo 等模型
 */

import logger from '../../utils/logger.js';
import { createHttpClient } from '../../utils/httpClient.js';

export interface OpenAIProviderInput {
  model?: string; // gpt-4, gpt-4o, gpt-3.5-turbo
  prompt: string; // 用户提示词
  systemPrompt?: string; // 系统提示词
  temperature?: number; // 0-2, 默认1
  maxTokens?: number; // 最大输出token数
  imageUrl?: string; // 可选：图片URL（GPT-4o支持）
  apiKey?: string; // OpenAI API Key（优先使用此处，否则从环境变量读取）
}

export interface OpenAIProviderResult {
  text: string; // AI返回的文本
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string; // 实际使用的模型
}

// OpenAI API 响应类型
interface OpenAIResponse {
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

type OpenAIMessage =
  | {
    role: 'system';
    content: string;
  }
  | {
    role: 'user';
    content: string;
  }
  | {
    role: 'user';
    content: Array<
      | {
        type: 'text';
        text: string;
      }
      | {
        type: 'image_url';
        image_url: {
          url: string;
        };
      }
    >;
  };

class OpenAIProvider {
  private config?: { apiKey?: string; baseURL?: string };

  private httpClient = createHttpClient({
    serviceName: 'openai',
    timeoutMs: 60000,
    maxRetries: 2
  });

  constructor(config?: { apiKey?: string; baseURL?: string }) {
    this.config = config;
  }

  async execute(input: OpenAIProviderInput, taskId: string): Promise<OpenAIProviderResult> {
    const {
      model = 'gpt-4o',
      prompt,
      systemPrompt = 'You are a helpful assistant.',
      temperature = 0.7,
      maxTokens = 2000,
      imageUrl,
      apiKey
    } = input;

    if (!prompt) {
      throw new Error('缺少必要参数: prompt');
    }

    // 获取API Key
    const openaiApiKey = apiKey || this.config?.apiKey || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('未配置OpenAI API Key，请设置环境变量 OPENAI_API_KEY 或在参数中传入');
    }

    const baseURL = this.config?.baseURL || 'https://api.openai.com/v1/chat/completions';

    try {
      logger.info(`[OpenAIProvider] 开始调用OpenAI taskId=${taskId} model=${model} baseURL=${baseURL}`);

      // 构建消息
      const messages: OpenAIMessage[] = [{ role: 'system', content: systemPrompt }];

      // 如果有图片URL，使用多模态格式
      if (imageUrl && (model.includes('gpt-4o') || model.includes('gpt-4-vision'))) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      // 调用OpenAI API
      const response = await this.httpClient.request<OpenAIResponse>({
        method: 'POST',
        url: baseURL,
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        }
      });

      const data = response.data as OpenAIResponse;
      const choice = data.choices?.[0];
      if (!choice) {
        throw new Error('OpenAI返回数据格式错误');
      }

      const result: OpenAIProviderResult = {
        text: choice.message.content,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        },
        model: data.model
      };

      logger.info(`[OpenAIProvider] 调用成功 taskId=${taskId} tokens=${result.usage.totalTokens}`);

      return result;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[OpenAIProvider] 调用失败 taskId=${taskId} error=${err.message}`, {
        taskId,
        error: err
      });
      throw err;
    }
  }
}

export default OpenAIProvider;
