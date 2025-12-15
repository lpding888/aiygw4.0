/**
 * 添加CMS AI配置项到系统配置表
 *
 * 允许管理员在后台配置CMS模块使用的AI模型
 */
exports.up = async function (knex) {
  const now = knex.fn.now();

  // 检查配置是否已存在
  const existing = await knex('system_configs')
    .whereIn('config_key', [
      'cms_ai_default_provider',
      'cms_ai_default_model',
      'cms_ai_translation_model',
      'cms_ai_summary_model'
    ])
    .select('config_key');

  const existingKeys = existing.map((r) => r.config_key);

  const configsToInsert = [
    {
      config_key: 'cms_ai_default_provider',
      config_value: JSON.stringify('hunyuan'),
      config_type: 'string',
      category: 'cms_ai',
      description: 'CMS模块默认AI服务商（可选：hunyuan, openai, claude等）',
      created_at: now,
      updated_at: now
    },
    {
      config_key: 'cms_ai_default_model',
      config_value: JSON.stringify('hunyuan-lite'),
      config_type: 'string',
      category: 'cms_ai',
      description: 'CMS模块默认AI模型',
      created_at: now,
      updated_at: now
    },
    {
      config_key: 'cms_ai_translation_model',
      config_value: JSON.stringify('gpt-4o-mini'),
      config_type: 'string',
      category: 'cms_ai',
      description: '翻译任务使用的AI模型（建议使用多语言能力强的模型）',
      created_at: now,
      updated_at: now
    },
    {
      config_key: 'cms_ai_summary_model',
      config_value: JSON.stringify('hunyuan-lite'),
      config_type: 'string',
      category: 'cms_ai',
      description: '摘要生成使用的AI模型',
      created_at: now,
      updated_at: now
    }
  ].filter((config) => !existingKeys.includes(config.config_key));

  if (configsToInsert.length > 0) {
    await knex('system_configs').insert(configsToInsert);
  }

  console.log(`[Migration] 已添加 ${configsToInsert.length} 个CMS AI配置项`);
};

exports.down = async function (knex) {
  await knex('system_configs')
    .whereIn('config_key', [
      'cms_ai_default_provider',
      'cms_ai_default_model',
      'cms_ai_translation_model',
      'cms_ai_summary_model'
    ])
    .delete();

  console.log('[Migration] 已删除CMS AI配置项');
};
