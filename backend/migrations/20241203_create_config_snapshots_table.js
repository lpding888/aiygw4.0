/**
 * 配置快照表
 */

exports.up = function(knex) {
  return knex.schema.createTable('config_snapshots', (table) => {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('scope').notNullable().comment('作用域');
    table.string('key').notNullable().comment('配置键');
    table.string('version').notNullable().comment('版本号');
    table.json('data').comment('快照数据');
    table.string('action').notNullable().comment('操作类型: create/update/delete/publish/rollback');
    table.text('description').comment('变更说明');
    table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index(['scope', 'key']);
    table.index(['scope', 'key', 'version']);
    table.index(['created_at']);

    table.unique(['scope', 'key', 'version']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('config_snapshots');
};