/**
 * Claude Provider (Anthropic)
 * 支持 Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku 等模型
 */

import logger from '../../utils/logger.js';
import { createHttpClient } from '../../utils/httpClient.js';

export interface ClaudeProviderInput {
  model?: string; // claude-3-5-sonnet-20241022, claude-3-opus-20240229, claude-3-haiku-20240307
  prompt: string; // 用户提示词
  systemPrompt?: string; // 系统提示词
  temperature?: number; // 0-1, 默认1
  maxTokens?: number; // 最大输出token数，默认4096
  imageUrl?: string; // 可选：图片URL（Claude 3支持）
  imageMediaType?: string; // 图片类型：image/jpeg, image/png, image/gif, image/webp
  apiKey?: string; // Anthropic API Key
}

export interface ClaudeProviderResult {
  text: string; // AI返回的文本
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string; // 实际使用的模型
  stopReason: string; // end_turn, max_tokens, stop_sequence
}

// Claude API 响应类型
interface ClaudeResponse {
  content: Array<{
    type: string;
    text?: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
  stop_reason: string;
}

type ClaudeMessageContent =
  | {
    type: 'image';
    source: {
      type: 'url';
      url: string;
      media_type?: string;
    };
  }
  | {
    type: 'text';
    text: string;
  };

interface ClaudeRequestPayload {
  model: string;
  messages: Array<{
    role: 'user';
    content: ClaudeMessageContent[];
  }>;
  max_tokens: number;
  temperature: number;
  system?: string;
}

class ClaudeProvider {
  private config?: { apiKey?: string; baseURL?: string };

  private httpClient = createHttpClient({
    serviceName: 'claude',
    timeoutMs: 60000,
    maxRetries: 2
  });

  constructor(config?: { apiKey?: string; baseURL?: string }) {
    this.config = config;
  }

  async execute(input: ClaudeProviderInput, taskId: string): Promise<ClaudeProviderResult> {
    const {
      model = 'claude-3-5-sonnet-20241022',
      prompt,
      systemPrompt,
      temperature = 1,
      maxTokens = 4096,
      imageUrl,
      imageMediaType = 'image/jpeg',
      apiKey
    } = input;

    if (!prompt) {
      throw new Error('缺少必要参数: prompt');
    }

    // 获取API Key
    const claudeApiKey = apiKey || this.config?.apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!claudeApiKey) {
      throw new Error('未配置Claude API Key，请设置环境变量 ANTHROPIC_API_KEY 或在参数中传入');
    }

    const baseURL = this.config?.baseURL || 'https://api.anthropic.com/v1/messages';

    try {
      logger.info(`[ClaudeProvider] 开始调用Claude taskId=${taskId} model=${model} baseURL=${baseURL}`);

      // 构建消息内容
      const messageContent: ClaudeMessageContent[] = [];

      // 如果有图片，先添加图片
      if (imageUrl) {
        // 如果是URL，需要先下载转base64（或者直接传URL，看API支持）
        // Claude API要求图片是base64格式
        messageContent.push({
          type: 'image',
          source: {
            type: 'url',
            url: imageUrl,
            media_type: imageMediaType
          }
        });
      }

      // 添加文本提示
      messageContent.push({
        type: 'text',
        text: prompt
      });

      // 调用Claude API
      const requestData: ClaudeRequestPayload = {
        model,
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ],
        max_tokens: maxTokens,
        temperature
      };

      // 如果有系统提示词，添加到请求中
      if (systemPrompt) {
        requestData.system = systemPrompt;
      }

      const response = await this.httpClient.request<ClaudeResponse>({
        method: 'POST',
        url: baseURL,
        headers: {
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        data: requestData
      });

      const data = response.data as ClaudeResponse;
      const textContent = data.content?.find((c) => c.type === 'text');
      if (!textContent || !textContent.text) {
        throw new Error('Claude返回数据格式错误');
      }

      const result: ClaudeProviderResult = {
        text: textContent.text,
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
        },
        model: data.model,
        stopReason: data.stop_reason
      };

      logger.info(`[ClaudeProvider] 调用成功 taskId=${taskId} tokens=${result.usage.totalTokens}`);

      return result;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ClaudeProvider] 调用失败 taskId=${taskId} error=${err.message}`, {
        taskId,
        error: err
      });
      throw err;
    }
  }
}

export default ClaudeProvider;
