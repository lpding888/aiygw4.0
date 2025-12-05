import logger from '../../utils/logger.js';
import { createHttpClient } from '../../utils/httpClient.js';
import aiHelperService from '../aiHelper.service.js';

export interface DeepSeekProviderInput {
  prompt: string;
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
  private readonly httpClient = createHttpClient({
    serviceName: 'deepseek',
    timeoutMs: 60000,
    maxRetries: 2
  });

  private readonly fallbackEndpoint = 'https://api.deepseek.com/chat/completions';

  async execute(input: DeepSeekProviderInput, taskId: string): Promise<DeepSeekProviderResult> {
    const {
      prompt,
      systemPrompt = 'You are a helpful assistant.',
      model,
      temperature = 0.3,
      maxTokens = 2000,
      apiKey
    } = input;

    if (!prompt) {
      throw new Error('缺少必要参数: prompt');
    }

    const runtimeConfig = await aiHelperService.getRuntimeConfig({ apiKey });
    const deepseekApiKey = runtimeConfig.apiKey;
    if (!deepseekApiKey) {
      throw new Error(
        '未配置DeepSeek API Key，请在系统配置中填写或设置环境变量 DEEPSEEK_API_KEY'
      );
    }

    const resolvedEndpoint = runtimeConfig.chatEndpoint ?? this.fallbackEndpoint;
    const resolvedModel = model ?? runtimeConfig.defaultModel ?? 'deepseek-chat';

    try {
      logger.info(
        `[DeepSeekProvider] 开始调用 taskId=${taskId} model=${resolvedModel} endpoint=${resolvedEndpoint}`
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
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
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
