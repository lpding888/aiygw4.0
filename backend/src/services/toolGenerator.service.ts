import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import providerRegistryService from './provider-registry.service.js';
import { nanoid } from 'nanoid';
import * as providerRepo from '../repositories/providerEndpoints.repo.js';

/**
 * ToolGeneratorService (AI 学习机服务)
 * 核心功能：利用 LLM (DeepSeek) 阅读 API 文档，自动生成 GenericHttpProvider 配置
 */
class ToolGeneratorService {
  /**
   * 智能解析文档并生成积木
   * @param docText - 用户粘贴的 API 文档内容 (curl命令、接口说明等)
   * @param category - 积木分类 (如: image_generation, video_generation)
   */
  async generateFromDoc(docText: string, category: string = 'custom_tool'): Promise<any> {
    logger.info('[ToolGenerator] 开始解析文档...');

    // 1. 构造 Prompt，让 DeepSeek 扮演 "架构师"
    const systemPrompt = `你是一个资深的系统架构师。
你的任务是阅读用户提供的 API 文档片段（通常是 curl 命令或接口说明），并将其转换为我们系统内部的 "GenericHttpProvider" 标准配置 JSON。

目标 JSON 结构 (GenericHttpProvider Schema):
{
  "name": "工具名称(中文)",
  "description": "简短描述功能",
  "config": {
    "req_template": {
      "method": "POST 或 GET",
      "url": "完整的API请求地址，其中动态参数用 {{var}} 表示，如 https://api.com/v1/users/{{userId}}",
      "headers": { "Header名": "Header值 (动态值用 {{var}})" },
      "body": { "参数名": "{{参数名}}" },
      "timeout": 30000,
      "polling": {  // [关键] 如果是异步任务(如AI生图)，必须生成此字段；如果是同步接口，此字段为 null
        "url": "轮询状态的URL，支持 {{data.taskId}} 引用初始响应",
        "method": "GET",
        "headers": { "Authorization": "Bearer {{apiKey}}" },
        "interval": 3000,
        "timeout": 300000,
        "successCondition": "status == 'SUCCESS' (请根据文档推断成功标志)",
        "failCondition": "status == 'FAILED'",
        "resultPath": "data.output_url (提取最终结果的路径)"
      },
      "extractPath": "data.id (如果是同步接口，提取结果的路径)"
    },
    "variables": {
      "apiKey": "", 
      "prompt": "",
      "imageUrl": ""
      // ... 列出所有用到的 {{var}} 变量，key为变量名，value为空字符串
    }
  }
}

重要指令：
1. **智能识别异步任务**：如果文档提到 "返回任务ID"、"异步处理"、"Webhook" 或 "查询状态"，请务必生成 `polling` 配置块。这是最核心的要求！
2. **变量提取**：将文档中的 api key、prompt、url 等参数提取为 `variables`，并在 url/headers/body 中用 `{{varName}}` 占位。
3. **严格 JSON 格式**：请直接返回 JSON 字符串，**严禁**使用 Markdown 代码块（例如 \`\`\`json ... \`\`\`），也不要包含任何解释性文字。`;

    const userPrompt = `请解析以下 API 文档，生成积木配置：\n\n${docText}`;

    // 2. 调用 DeepSeek (通过统一注册服务)
    // 使用 providerRegistryService 调用 'llm_deepseek'
    // OpenAIProvider 的 execute 方法返回 { text: string, ... }
    const input: any = { systemPrompt, prompt: userPrompt, model: 'deepseek-chat', temperature: 0.1 };
    const taskId = 'tool_gen_' + Date.now();

    const result = await providerRegistryService.execute(
      'llm_deepseek',
      'execute',
      [input, taskId]
    );

    let toolConfig;
    const content = result.text; // OpenAIProvider 返回的是 text 字段

    // 尝试解析 JSON
    if (content) {
      try {
        // 清洗 Markdown 标记
        const sanitizedContent = content
          .replace(/^```json\s*/, '')
          .replace(/^```\s*/, '')
          .replace(/\s*```$/, '')
          .trim();

        toolConfig = JSON.parse(sanitizedContent);
      } catch (e) {
        logger.error('[ToolGenerator] JSON 手动解析失败', { content, error: e });
      }
    }

    if (!toolConfig) {
      throw new Error('AI 解析失败，未能生成有效的 JSON 配置。请检查日志中的原始内容。');
    }

    logger.info('[ToolGenerator] AI 解析成功:', toolConfig);

    // 3. 存入 provider_endpoints 表 (积木仓库)
    const providerRef = `ai_gen_${nanoid(6).toLowerCase()}`;

    await providerRepo.createProviderEndpoint({
      provider_ref: providerRef,
      provider_name: toolConfig.name,
      endpoint_url: toolConfig.config.req_template.url,
      auth_type: 'api_key',
      credentials: { api_key: 'placeholder' },
      config: toolConfig.config,
      enabled: true
    });

    logger.info(`[ToolGenerator] 新积木已注册: ${providerRef} (${toolConfig.name})`);

    return {
      success: true,
      providerRef,
      name: toolConfig.name,
      config: toolConfig.config
    };
  }
}

export default new ToolGeneratorService();
