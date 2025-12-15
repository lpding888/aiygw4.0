/**
 * 创建标签系统表
 */
exports.up = async function (knex) {
  // 标签表
  await knex.schema.createTable('tags', (table) => {
    table.increments('id').primary();
    table.string('name', 50).notNullable().comment('标签名称');
    table.string('slug', 50).notNullable().unique().comment('URL标识');
    table.string('color', 20).comment('标签颜色');
    table.string('icon', 50).comment('图标');
    table.text('description').comment('描述');
    table.string('category', 50).comment('标签分类');
    table.integer('use_count').defaultTo(0).comment('使用次数');
    table.boolean('is_active').defaultTo(true).comment('是否启用');
    table.integer('sort_order').defaultTo(0).comment('排序');
    table.timestamps(true, true);

    table.index(['category', 'is_active']);
  });

  // 标签关联表（多态关联）
  await knex.schema.createTable('taggables', (table) => {
    table.increments('id').primary();
    table.integer('tag_id').unsigned().notNullable().comment('标签ID');
    table
      .string('taggable_type', 50)
      .notNullable()
      .comment('关联类型：showcase/template/article等');
    table.integer('taggable_id').unsigned().notNullable().comment('关联ID');
    table.timestamps(true, true);

    table.foreign('tag_id').references('id').inTable('tags').onDelete('CASCADE');
    table.unique(['tag_id', 'taggable_type', 'taggable_id']);
    table.index(['taggable_type', 'taggable_id']);
  });

  console.log('[Migration] 标签系统表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('taggables');
  await knex.schema.dropTableIfExists('tags');
};
