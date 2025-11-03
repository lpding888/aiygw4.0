/**
 * MCP终端表迁移
 */

exports.up = function(knex) {
  return knex.schema.createTable('mcp_endpoints', (table) => {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('name').notNullable().comment('终端名称');
    table.text('description').comment('描述');
    table.string('provider').notNullable().comment('供应商');
    table.string('endpoint_url').notNullable().comment('终端URL');
    table.string('protocol_version').defaultTo('2024-11-05').comment('协议版本');
    table.json('capabilities').defaultTo('{}').comment('能力声明');
    table.json('tools').defaultTo('[]').comment('工具列表');
    table.string('auth_type').notNullable().defaultTo('none').comment('认证类型: none/bearer/api_key');
    table.text('auth_secret').comment('认证密钥');
    table.json('metadata').defaultTo('{}').comment('元数据');
    table.boolean('enabled').defaultTo(true).comment('是否启用');
    table.string('status').defaultTo('active').comment('状态: active/inactive/error');
    table.text('error_message').comment('错误信息');
    table.timestamp('last_tested_at').nullable().comment('最后测试时间');
    table.json('last_test_result').comment('最后测试结果');
    integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    integer('updated_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index(['provider', 'enabled']);
    table.index(['status']);
    table.index(['enabled']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('mcp_endpoints');
};