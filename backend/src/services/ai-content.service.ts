/**
 * AI内容服务
 *
 * 为CMS模块提供AI内容生成能力
 */

import { aiGateway } from './ai-gateway.service.js';
import systemConfigService from './systemConfig.service.js';
import logger from '../utils/logger.js';

/**
 * AI生成文案结果
 */
interface GeneratedText {
  key: string;
  texts: Record<string, string>; // language -> text
}

/**
 * SEO分析结果
 */
interface SeoAnalysis {
  score: number;
  title: string;
  description: string;
  keywords: string[];
  suggestions: string[];
}

/**
 * AI内容服务类
 */
class AiContentService {
  /**
   * 获取CMS模块使用的AI模型配置
   */
  private async getAiConfig(): Promise<{ provider: string; model: string }> {
    try {
      const provider = await systemConfigService.get('cms_ai_default_provider');
      const model = await systemConfigService.get('cms_ai_default_model');

      return {
        provider: typeof provider === 'string' ? provider : 'hunyuan',
        model: typeof model === 'string' ? model : 'hunyuan-lite'
      };
    } catch (error) {
      logger.warn('[AiContentService] 获取AI配置失败，使用默认值:', error);
      return { provider: 'hunyuan', model: 'hunyuan-lite' };
    }
  }

  /**
   * 获取特定任务的AI模型
   */
  private async getTaskModel(taskType: 'translation' | 'summary' | 'default'): Promise<string> {
    try {
      const configKey =
        taskType === 'translation'
          ? 'cms_ai_translation_model'
          : taskType === 'summary'
            ? 'cms_ai_summary_model'
            : 'cms_ai_default_model';

      const model = await systemConfigService.get(configKey);
      return typeof model === 'string' ? model : 'hunyuan-lite';
    } catch {
      return 'hunyuan-lite';
    }
  }

  /**
   * 生成多语言文案
   *
   * @param key - 文案键名
   * @param description - 文案描述/用途说明
   * @param languages - 需要生成的语言列表
   * @param style - 文案风格
   * @param maxLength - 最大长度
   */
  async generateText(
    key: string,
    description: string,
    languages: string[] = ['zh-CN'],
    style: 'formal' | 'casual' | 'marketing' = 'formal',
    maxLength: number = 100
  ): Promise<GeneratedText> {
    const { model } = await this.getAiConfig();

    const styleGuide = {
      formal: '正式、专业',
      casual: '轻松、友好',
      marketing: '有吸引力、促进转化'
    };

    const prompt = `你是一个专业的网站文案撰写专家。
请根据以下要求生成网站文案：

文案用途：${description}
风格要求：${styleGuide[style]}
字数限制：每种语言不超过${maxLength}字
需要语言：${languages.join(', ')}

请以JSON格式返回，格式为：
{
  ${languages.map((lang) => `"${lang}": "对应语言的文案内容"`).join(',\n  ')}
}

只返回JSON，不要其他说明。`;

    try {
      const response = await aiGateway.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      });

      const content = response.choices[0]?.message?.content || '{}';
      // 提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const texts = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      logger.info('[AiContentService] 文案生成成功:', { key, languages });
      return { key, texts };
    } catch (error) {
      logger.error('[AiContentService] 文案生成失败:', error);
      throw new Error('AI文案生成失败，请稍后重试');
    }
  }

  /**
   * 润色/优化文案
   *
   * @param text - 原始文案
   * @param style - 目标风格
   */
  async polishText(
    text: string,
    style: 'formal' | 'casual' | 'marketing' = 'formal'
  ): Promise<string> {
    const { model } = await this.getAiConfig();

    const styleGuide = {
      formal: '更加正式、专业',
      casual: '更加轻松、友好、口语化',
      marketing: '更加有吸引力、促进用户行动'
    };

    const prompt = `请润色以下文案，使其${styleGuide[style]}：

原始文案：${text}

要求：
1. 保持原意不变
2. 优化表达方式
3. 直接返回润色后的文案，不要其他说明`;

    try {
      const response = await aiGateway.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      });

      const polished = response.choices[0]?.message?.content?.trim() || text;
      logger.info('[AiContentService] 文案润色成功');
      return polished;
    } catch (error) {
      logger.error('[AiContentService] 文案润色失败:', error);
      throw new Error('AI文案润色失败，请稍后重试');
    }
  }

  /**
   * 翻译文案
   *
   * @param text - 原始文案
   * @param fromLang - 源语言
   * @param toLangs - 目标语言列表
   */
  async translateText(
    text: string,
    fromLang: string = 'zh-CN',
    toLangs: string[]
  ): Promise<Record<string, string>> {
    const model = await this.getTaskModel('translation');

    const prompt = `请将以下${fromLang}文本翻译成指定语言：

原文：${text}

目标语言：${toLangs.join(', ')}

请以JSON格式返回，格式为：
{
  ${toLangs.map((lang) => `"${lang}": "翻译后的内容"`).join(',\n  ')}
}

要求：
1. 保持原意准确
2. 符合目标语言的表达习惯
3. 只返回JSON，不要其他说明`;

    try {
      const response = await aiGateway.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3 // 翻译用较低温度保持准确性
      });

      const content = response.choices[0]?.message?.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const translations = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      logger.info('[AiContentService] 翻译成功:', { fromLang, toLangs });
      return translations;
    } catch (error) {
      logger.error('[AiContentService] 翻译失败:', error);
      throw new Error('AI翻译失败，请稍后重试');
    }
  }

  /**
   * 生成公告摘要
   *
   * @param content - 公告内容
   * @param maxLength - 摘要最大长度
   */
  async generateSummary(content: string, maxLength: number = 50): Promise<string> {
    const model = await this.getTaskModel('summary');

    const prompt = `请为以下公告内容生成一个简短摘要：

公告内容：
${content}

要求：
1. 摘要不超过${maxLength}字
2. 保留核心信息
3. 语言简洁有力
4. 直接返回摘要内容，不要其他说明`;

    try {
      const response = await aiGateway.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5
      });

      const summary = response.choices[0]?.message?.content?.trim() || '';
      logger.info('[AiContentService] 摘要生成成功');
      return summary.slice(0, maxLength);
    } catch (error) {
      logger.error('[AiContentService] 摘要生成失败:', error);
      throw new Error('AI摘要生成失败，请稍后重试');
    }
  }

  /**
   * SEO内容分析与优化建议
   *
   * @param content - 页面内容
   * @param pageType - 页面类型
   */
  async analyzeSeo(
    content: string,
    pageType: 'home' | 'product' | 'article' | 'landing' = 'home'
  ): Promise<SeoAnalysis> {
    const { model } = await this.getAiConfig();

    const prompt = `作为SEO专家，请分析以下${pageType}页面内容并给出优化建议：

页面内容：
${content.slice(0, 3000)}

请以JSON格式返回分析结果：
{
  "score": 0-100的SEO评分,
  "title": "建议的页面标题（60字符以内）",
  "description": "建议的meta描述（160字符以内）",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "suggestions": ["优化建议1", "优化建议2", "优化建议3"]
}

只返回JSON，不要其他说明。`;

    try {
      const response = await aiGateway.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5
      });

      const responseContent = response.choices[0]?.message?.content || '{}';
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      logger.info('[AiContentService] SEO分析完成');
      return {
        score: analysis.score || 50,
        title: analysis.title || '',
        description: analysis.description || '',
        keywords: analysis.keywords || [],
        suggestions: analysis.suggestions || []
      };
    } catch (error) {
      logger.error('[AiContentService] SEO分析失败:', error);
      throw new Error('AI SEO分析失败，请稍后重试');
    }
  }

  /**
   * 生成图片描述（Alt文本）
   *
   * @param imageUrl - 图片URL
   * @param context - 上下文描述
   */
  async generateImageAlt(imageUrl: string, context?: string): Promise<string> {
    const { model } = await this.getAiConfig();

    // 注意：这里需要支持多模态的模型才能分析图片
    // 如果模型不支持，则基于上下文生成通用描述
    const prompt = context
      ? `请为一张${context}相关的图片生成简短的Alt文本描述（50字以内）：`
      : '请生成一段通用的Banner图片Alt文本描述（50字以内）：';

    try {
      const response = await aiGateway.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      });

      const alt = response.choices[0]?.message?.content?.trim() || '精选推荐图片';
      logger.info('[AiContentService] 图片Alt生成成功');
      return alt.slice(0, 100);
    } catch (error) {
      logger.error('[AiContentService] 图片Alt生成失败:', error);
      return context ? `${context}相关图片` : '精选推荐图片';
    }
  }
}

export default new AiContentService();
