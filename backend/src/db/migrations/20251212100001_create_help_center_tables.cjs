/**
 * 创建帮助中心表（分类和文章）
 */
exports.up = async function (knex) {
  // 帮助分类表
  await knex.schema.createTable('help_categories', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().comment('分类名称');
    table.string('slug', 100).notNullable().unique().comment('URL标识');
    table.string('description', 500).comment('分类描述');
    table.string('icon', 50).comment('图标');
    table.integer('sort_order').defaultTo(0).comment('排序');
    table.boolean('is_active').defaultTo(true).comment('是否启用');
    table.integer('parent_id').unsigned().comment('父分类ID');
    table.timestamps(true, true);

    table.foreign('parent_id').references('id').inTable('help_categories').onDelete('SET NULL');
    table.index(['is_active', 'sort_order']);
  });

  // 帮助文章表
  await knex.schema.createTable('help_articles', (table) => {
    table.increments('id').primary();
    table.integer('category_id').unsigned().comment('所属分类');
    table.string('title', 200).notNullable().comment('文章标题');
    table.string('slug', 200).notNullable().unique().comment('URL标识');
    table.text('content').comment('文章内容（Markdown）');
    table.text('summary').comment('摘要');
    table.string('keywords', 500).comment('关键词，逗号分隔');
    table.enum('status', ['draft', 'published', 'archived']).defaultTo('draft').comment('状态');
    table.integer('view_count').defaultTo(0).comment('浏览次数');
    table.integer('helpful_count').defaultTo(0).comment('有帮助数');
    table.integer('not_helpful_count').defaultTo(0).comment('无帮助数');
    table.integer('sort_order').defaultTo(0).comment('排序');
    table.integer('created_by').unsigned().comment('创建者');
    table.integer('updated_by').unsigned().comment('更新者');
    table.timestamps(true, true);

    table.foreign('category_id').references('id').inTable('help_categories').onDelete('SET NULL');
    table.index(['status', 'sort_order']);
    table.index('category_id');
  });

  console.log('[Migration] 帮助中心表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('help_articles');
  await knex.schema.dropTableIfExists('help_categories');
  console.log('[Migration] 帮助中心表已删除');
};
