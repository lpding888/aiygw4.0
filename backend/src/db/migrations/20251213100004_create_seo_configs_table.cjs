/**
 * 创建SEO管理表
 */
exports.up = async function (knex) {
  await knex.schema.createTable('seo_configs', (table) => {
    table.increments('id').primary();
    table.string('page_path', 200).notNullable().unique().comment('页面路径');
    table.string('page_name', 100).comment('页面名称');
    table.string('title', 200).comment('页面标题');
    table.text('description').comment('Meta描述');
    table.text('keywords').comment('关键词');
    table.string('og_title', 200).comment('OG标题');
    table.text('og_description').comment('OG描述');
    table.string('og_image', 500).comment('OG图片');
    table.string('og_type', 50).defaultTo('website');
    table.string('twitter_card', 50).defaultTo('summary_large_image');
    table.string('canonical_url', 500).comment('规范URL');
    table.text('structured_data').comment('结构化数据JSON-LD');
    table.boolean('no_index').defaultTo(false);
    table.boolean('no_follow').defaultTo(false);
    table.integer('priority').defaultTo(50).comment('sitemap优先级0-100');
    table.string('change_freq', 20).defaultTo('weekly').comment('更新频率');
    table.integer('updated_by').unsigned();
    table.timestamps(true, true);

    table.index('page_path');
  });

  // 插入默认SEO配置
  await knex('seo_configs').insert([
    {
      page_path: '/',
      page_name: '首页',
      title: 'AI服装图片处理 - 一键生成专业模特图',
      priority: 100
    },
    { page_path: '/pricing', page_name: '定价', title: '会员套餐 - AI服装处理', priority: 80 },
    {
      page_path: '/workspace',
      page_name: '工作台',
      title: '工作台 - AI服装处理',
      no_index: true,
      priority: 0
    }
  ]);

  console.log('[Migration] SEO管理表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('seo_configs');
};
