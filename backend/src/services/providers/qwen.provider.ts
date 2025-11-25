/**
 * 通义千问 Provider (Qwen)
 * 支持阿里云通义千问系列模型
 */

import logger from '../../utils/logger.js';
import { createHttpClient } from '../../utils/httpClient.js';

export interface QwenProviderInput {
  model?: string; // qwen-max, qwen-plus, qwen-turbo, qwen-vl-max (多模态)
  prompt: string; // 用户提示词
  systemPrompt?: string; // 系统提示词
  temperature?: number; // 0-2, 默认1
  maxTokens?: number; // 最大输出token数
  imageUrl?: string; // 可选：图片URL（qwen-vl系列支持）
  apiKey?: string; // 通义千问 API Key
}

export interface QwenProviderResult {
  text: string; // AI返回的文本
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string; // 实际使用的模型
  finishReason: string; // stop, length
}

// 通义千问 API 响应类型
interface QwenResponse {
  code?: string;
  message?: string;
  output: {
    choices: Array<{
      message: {
        content: string;
      };
      finish_reason: string;
    }>;
    model?: string;
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

type QwenMessage =
  | {
      role: 'system';
      content: string;
    }
  | {
      role: 'user';
      content:
        | string
        | Array<
            | {
                text: string;
              }
            | {
                image: string;
              }
          >;
    };

class QwenProvider {
  private httpClient = createHttpClient({
    serviceName: 'qwen',
    timeoutMs: 60000,
    maxRetries: 2
  });

  async execute(input: QwenProviderInput, taskId: string): Promise<QwenProviderResult> {
    const {
      model = 'qwen-max',
      prompt,
      systemPrompt,
      temperature = 1,
      maxTokens = 2000,
      imageUrl,
      apiKey
    } = input;

    if (!prompt) {
      throw new Error('缺少必要参数: prompt');
    }

    // 获取API Key
    const qwenApiKey = apiKey || process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
    if (!qwenApiKey) {
      throw new Error('未配置通义千问API Key，请设置环境变量 DASHSCOPE_API_KEY 或在参数中传入');
    }

    try {
      logger.info(`[QwenProvider] 开始调用通义千问 taskId=${taskId} model=${model}`);

      // 构建消息
      const messages: QwenMessage[] = [];

      // 添加系统提示词
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      // 如果是多模态模型且有图片
      if (imageUrl && (model.includes('vl') || model.includes('vision'))) {
        messages.push({
          role: 'user',
          content: [{ text: prompt }, { image: imageUrl }]
        });
      } else {
        messages.push({
          role: 'user',
          content: prompt
        });
      }

      // 调用通义千问API
      const response = await this.httpClient.request<QwenResponse>({
        method: 'POST',
        url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        headers: {
          Authorization: `Bearer ${qwenApiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          model,
          input: {
            messages
          },
          parameters: {
            temperature,
            max_tokens: maxTokens,
            result_format: 'message'
          }
        }
      });

      const data = response.data as QwenResponse;

      // 检查返回状态
      if (data.code) {
        throw new Error(`通义千问API错误: ${data.code} - ${data.message}`);
      }

      const choice = data.output?.choices?.[0];
      if (!choice) {
        throw new Error('通义千问返回数据格式错误');
      }

      const result: QwenProviderResult = {
        text: choice.message.content,
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        },
        model: data.output?.model || model,
        finishReason: choice.finish_reason
      };

      logger.info(`[QwenProvider] 调用成功 taskId=${taskId} tokens=${result.usage.totalTokens}`);

      return result;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[QwenProvider] 调用失败 taskId=${taskId} error=${err.message}`, {
        taskId,
        error: err
      });
      throw err;
    }
  }
}

export default QwenProvider;
