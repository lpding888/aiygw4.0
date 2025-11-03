/**
 * MCP测试记录表迁移
 */

exports.up = function(knex) {
  return knex.schema.createTable('mcp_test_logs', (table) => {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('endpoint_id').references('id').inTable('mcp_endpoints').onDelete('CASCADE');
    table.string('test_type').notNullable().comment('测试类型: connection/tools/execution');
    table.json('request_data').comment('请求数据');
    table.json('response_data').comment('响应数据');
    table.string('status').notNullable().comment('测试状态: success/failed/error');
    table.integer('response_time_ms').comment('响应时间(ms)');
    table.text('error_message').comment('错误信息');
    table.string('tested_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index(['endpoint_id']);
    table.index(['test_type']);
    table.index(['status']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('mcp_test_logs');
};