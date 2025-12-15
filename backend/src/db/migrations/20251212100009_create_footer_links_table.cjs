/**
 * 创建页脚链接表
 */
exports.up = async function (knex) {
  await knex.schema.createTable('footer_links', (table) => {
    table.increments('id').primary();
    table.string('group_name', 50).notNullable().comment('分组名称');
    table.string('group_key', 50).notNullable().comment('分组标识');
    table.string('title', 100).notNullable().comment('链接标题');
    table.string('url', 500).comment('链接URL');
    table.string('icon', 50).comment('图标');
    table.boolean('is_external').defaultTo(false).comment('外部链接');
    table.boolean('is_active').defaultTo(true).comment('是否启用');
    table.integer('sort_order').defaultTo(0).comment('排序');
    table.timestamps(true, true);

    table.index(['group_key', 'is_active', 'sort_order']);
  });

  console.log('[Migration] 页脚链接表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('footer_links');
};
