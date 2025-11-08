/**
 * CMS功能配置表
 */

exports.up = function(knex) {
  return knex.schema.createTable('cms_features', (table) => {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('key').notNullable().unique().comment('功能键');
    table.string('name').notNullable().comment('功能名称');
    table.text('description').comment('功能描述');
    table.string('category').notNullable().comment('功能分类');
    table.boolean('enabled').defaultTo(true).comment('是否启用');
    table.string('status').defaultTo('draft').comment('状态: draft/published/archived');
    table.json('config').defaultTo('{}').comment('功能配置');
    table.json('menu').defaultTo('{}').comment('菜单配置');
    table.json('metadata').defaultTo('{}').comment('元数据');
    table.string('version').defaultTo('1.0.0').comment('版本号');
    table.timestamp('published_at').nullable().comment('发布时间');
    integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    integer('updated_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index(['enabled']);
    table.index(['status']);
    table.index(['category']);
    table.index(['published_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('cms_features');
};