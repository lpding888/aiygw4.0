/**
 * 创建供应商端点表
 */

exports.up = function(knex) {
  return knex.schema.createTable('provider_endpoints', (table) => {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('name').notNullable().comment('供应商名称');
    table.text('description').comment('供应商描述');
    table.string('type').notNullable().comment('供应商类型');
    table.string('base_url').notNullable().comment('基础URL');
    table.integer('weight').defaultTo(100).comment('权重');
    table.integer('timeout').defaultTo(5000).comment('超时时间(ms)');
    table.integer('retry').defaultTo(3).comment('重试次数');
    table.boolean('enabled').defaultTo(true).comment('是否启用');
    table.string('status').defaultTo('inactive').comment('状态: inactive/active/error');
    table.timestamp('last_tested_at').nullable().comment('最后测试时间');
    table.json('last_test_result').comment('最后测试结果');
    table.integer('created_by').unsigned().comment('创建者ID');
    table.timestamps(true, true);

    // 索引
    table.index(['enabled']);
    table.index(['status']);
    table.index(['type']);
    table.index(['last_tested_at']);
    table.index(['weight']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('provider_endpoints');
};