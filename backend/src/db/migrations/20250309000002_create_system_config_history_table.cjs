/**
 * 系统配置历史表
 * 记录每次敏感配置的增删改操作
 */

exports.up = function (knex) {
  return knex.schema.createTable('system_config_history', (table) => {
    table.increments('id').primary().comment('历史记录ID');
    table.integer('config_id').unsigned().nullable().comment('system_configs.id');
    table.string('config_key', 120).notNullable().comment('配置键');
    table
      .enum('action', ['create', 'update', 'delete', 'rollback', 'import'])
      .notNullable()
      .comment('操作类型');
    table.json('old_snapshot').nullable().comment('变更前快照(JSON)');
    table.json('new_snapshot').nullable().comment('变更后快照(JSON)');
    table.boolean('is_secret').defaultTo(false).comment('是否敏感配置');
    table.integer('version').unsigned().notNullable().defaultTo(1).comment('版本号');
    table.string('changed_by', 64).nullable().comment('操作者ID');
    table.string('changed_by_name', 100).nullable().comment('操作者名称');
    table.string('source', 50).nullable().comment('来源: ui/api/import脚本等');
    table.string('ip_address', 50).nullable().comment('操作IP');
    table.string('user_agent', 255).nullable().comment('UA');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['config_key', 'created_at']);
    table.index(['action']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('system_config_history');
};
