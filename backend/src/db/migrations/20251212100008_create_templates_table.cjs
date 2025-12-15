/**
 * 创建模板库表
 */
exports.up = async function (knex) {
  await knex.schema.createTable('templates', (table) => {
    table.increments('id').primary();
    table.string('name', 200).notNullable().comment('模板名称');
    table.string('slug', 200).notNullable().unique().comment('URL标识');
    table.text('description').comment('描述');
    table.string('cover_image', 500).comment('封面图');
    table.text('preview_images').comment('预览图，JSON数组');
    table.string('category', 50).comment('分类：clothing/shoes/accessories');
    table.string('style', 50).comment('风格：street/studio/indoor');
    table.text('tags').comment('标签，JSON数组');
    table.text('config').comment('模板配置，JSON对象');
    table.text('prompt_template').comment('Prompt模板');
    table
      .enum('type', ['pose', 'background', 'style', 'composite'])
      .defaultTo('pose')
      .comment('类型');
    table.boolean('is_premium').defaultTo(false).comment('付费模板');
    table.integer('price_quota').defaultTo(0).comment('消耗配额');
    table.enum('status', ['draft', 'published', 'archived']).defaultTo('draft').comment('状态');
    table.integer('use_count').defaultTo(0).comment('使用次数');
    table.integer('like_count').defaultTo(0).comment('点赞数');
    table.boolean('is_featured').defaultTo(false).comment('精选');
    table.integer('sort_order').defaultTo(0).comment('排序');
    table.integer('created_by').unsigned().comment('创建者');
    table.timestamps(true, true);

    table.index(['status', 'is_featured', 'type']);
    table.index('category');
  });

  console.log('[Migration] 模板库表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('templates');
};
