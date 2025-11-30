import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import llmProvider from './providers/llm.provider.js';
import { nanoid } from 'nanoid';

/**
 * ToolGeneratorService (AI 学习机服务)
 * 核心功能：利用 LLM (DeepSeek) 阅读 API 文档，自动生成 Provider 配置
 */
class ToolGeneratorService {
  
  /**
   * 智能解析文档并生成积木
   * @param docText - 用户粘贴的 API 文档内容 (curl命令、接口说明等)
   * @param category - 积木分类 (如: image_generation, video_generation)
   */
  async generateFromDoc(docText: string, category: string = 'custom_tool'): Promise<any> {
    logger.info('[ToolGenerator] 开始解析文档...');

    // 1. 构造 Prompt，让 DeepSeek 扮演 "资深后端工程师"
    const systemPrompt = `你是一个资深的 API 接入工程师。
你的任务是阅读用户提供的 API 文档片段，并将其提取为结构化的 JSON 配置。

目标 JSON 结构如下：
{
  "provider_name": "工具名称(中文)",
  "description": "简短描述功能",
  "api_url": "完整的API请求地址",
  "method": "POST 或 GET",
  "headers": { "Header名": "Header值" },
  "params": [
    {
      "name": "参数字段名(如 prompt)",
      "label": "参数中文名(如 提示词)",
      "type": "string/number/boolean",
      "required": true,
      "default": "默认值",
      "description": "参数说明"
    }
  ]
}

注意事项：
1. 请智能推断参数的中文含义。
2. 忽略 API Key 等敏感信息，或者留空。
3. 如果文档里有 curl 示例，优先参考 curl。
4. 只返回纯 JSON 字符串，不要包含 Markdown 格式或解释文字。`;

    const userPrompt = `请解析以下 API 文档：\n\n${docText}`;

    // 2. 调用 DeepSeek (使用我们刚才做好的 LlmProvider)
    const result = await new (llmProvider as any)('deepseek').execute({
      systemPrompt,
      userPrompt,
      model: 'deepseek-chat',
      temperature: 0.1, // 越低越准确
      responseFormat: 'json_object'
    }, 'tool_gen_' + Date.now()); // 临时任务ID

    if (!result.parsed) {
      throw new Error('AI 解析失败，未能生成有效的 JSON 配置');
    }

    const toolConfig = result.parsed;
    logger.info('[ToolGenerator] AI 解析成功:', toolConfig);

    // 3. 将解析结果存入数据库，变成一个新的 Feature (积木)
    const featureKey = `tool_${nanoid(6).toLowerCase()}`;
    
    // 这里我们把 AI 分析出的 HTTP 配置，存成一个特殊的 Feature
    // 在 Pipeline 里，我们会用 HttpNode 来执行它
    const featureDefinition = {
      feature_id: nanoid(),
      feature_key: featureKey,
      name: toolConfig.provider_name,
      display_name: toolConfig.provider_name,
      description: toolConfig.description || 'AI 自动导入的工具',
      category: category,
      type: 'api_tool', // 标记为 API 工具
      is_enabled: true,
      // 关键：把 AI 分析出的参数结构存起来，前端根据这个渲染表单
      metadata: JSON.stringify({
        api_config: {
          url: toolConfig.api_url,
          method: toolConfig.method,
          headers: toolConfig.headers
        },
        form_schema: toolConfig.params // 前端表单配置
      }),
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('feature_definitions').insert(featureDefinition);

    logger.info(`[ToolGenerator] 积木已入库: ${featureKey}`);
    
    return featureDefinition;
  }
}

export default new ToolGeneratorService();
