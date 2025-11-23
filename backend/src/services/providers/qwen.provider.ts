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
      logger.info(
        `[QwenProvider] 开始调用通义千问 taskId=${taskId} model=${model}`
      );

      // 构建消息
      const messages: any[] = [];

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
          content: [
            { text: prompt },
            { image: imageUrl }
          ]
        });
      } else {
        messages.push({
          role: 'user',
          content: prompt
        });
      }

      // 调用通义千问API
      const response = await this.httpClient.request({
        method: 'POST',
        url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        headers: {
          'Authorization': `Bearer ${qwenApiKey}`,
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

      // 检查返回状态
      if (response.data.code) {
        throw new Error(`通义千问API错误: ${response.data.code} - ${response.data.message}`);
      }

      const choice = response.data.output?.choices?.[0];
      if (!choice) {
        throw new Error('通义千问返回数据格式错误');
      }

      const result: QwenProviderResult = {
        text: choice.message.content,
        usage: {
          inputTokens: response.data.usage?.input_tokens || 0,
          outputTokens: response.data.usage?.output_tokens || 0,
          totalTokens: response.data.usage?.total_tokens || 0
        },
        model: response.data.output?.model || model,
        finishReason: choice.finish_reason
      };

      logger.info(
        `[QwenProvider] 调用成功 taskId=${taskId} tokens=${result.usage.totalTokens}`
      );

      return result;
    } catch (error: any) {
      logger.error(
        `[QwenProvider] 调用失败 taskId=${taskId} error=${error.message}`,
        { taskId, error }
      );
      throw error;
    }
  }
}

export default QwenProvider;
