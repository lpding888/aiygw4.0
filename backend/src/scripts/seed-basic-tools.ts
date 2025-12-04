import 'dotenv/config';
import { db } from '../config/database.js';
import { nanoid } from 'nanoid';
import logger from '../utils/logger.js';

async function seed() {
  logger.info('开始注入基础积木...');

  const tools = [
    {
      name: 'DeepSeek 大脑',
      key: 'deepseek_chat',
      category: 'llm',
      desc: '智能文本生成与意图识别',
      schema: [
        {
          name: 'systemPrompt',
          label: '系统人设',
          type: 'text',
          default: '你是一个专业的AI助手',
          description: '设定AI的行为模式'
        },
        {
          name: 'userPrompt',
          label: '用户指令',
          type: 'text',
          required: true,
          description: '用户的输入内容，支持{{变量}}'
        },
        {
          name: 'responseFormat',
          label: '输出格式',
          type: 'string',
          default: 'text',
          description: '可选 json_object 强制输出JSON'
        }
      ]
    },
    {
      name: '腾讯云 CI 修图',
      key: 'tencent_ci',
      category: 'image_process',
      desc: '图片抠图、压缩、格式转换',
      schema: [
        {
          name: 'imageUrl',
          label: '图片链接',
          type: 'string',
          required: true,
          description: '输入图片的URL'
        },
        {
          name: 'operations',
          label: '操作指令',
          type: 'text',
          default: '[]',
          description: 'JSON格式的操作列表'
        }
      ]
    }
  ];

  for (const tool of tools) {
    const featureId = nanoid();

    // 检查是否存在，存在则更新
    const existing = await db('feature_definitions').where('feature_key', tool.key).first();

    if (existing) {
      await db('feature_definitions')
        .where('feature_key', tool.key)
        .update({
          name: tool.name,
          display_name: tool.name,
          description: tool.desc,
          metadata: JSON.stringify({ form_schema: tool.schema }),
          updated_at: new Date()
        });
      logger.info(`更新积木: ${tool.name}`);
    } else {
      await db('feature_definitions').insert({
        feature_id: featureId,
        feature_key: tool.key,
        name: tool.name,
        display_name: tool.name,
        category: tool.category,
        description: tool.desc,
        type: 'api_tool',
        is_enabled: true,
        quota_cost: 1,
        metadata: JSON.stringify({ form_schema: tool.schema }),
        created_at: new Date(),
        updated_at: new Date()
      });
      logger.info(`新建积木: ${tool.name}`);
    }
  }

  logger.info('✅ 基础积木注入完成！请刷新前端页面。');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
