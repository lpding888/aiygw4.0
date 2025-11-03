/**
 * 创建MCP端点表
 */

exports.up = function(knex) {
  return knex.schema.createTable('mcp_endpoints', function(table) {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('name').notNullable().comment('MCP端点名称');
    table.text('description').comment('端点描述');
    table.string('server_type').notNullable().comment('服务器类型: stdio/http/websocket');
    table.string('connection_string').notNullable().comment('连接字符串');
    table.json('connection_config').comment('连接配置');
    table.json('auth_config').comment('认证配置');
    table.boolean('enabled').defaultTo(true).comment('是否启用');
    table.string('status').defaultTo('inactive').comment('状态: inactive/active/error');
    table.integer('timeout').defaultTo(30000).comment('超时时间(ms)');
    table.integer('retry_count').defaultTo(3).comment('重试次数');
    table.timestamp('last_connected_at').nullable().comment('最后连接时间');
    table.timestamp('last_tested_at').nullable().comment('最后测试时间');
    table.json('last_test_result').comment('最后测试结果');
    table.json('server_info').comment('服务器信息');
    table.json('available_tools').comment('可用工具列表');
    table.integer('created_by').unsigned().comment('创建者ID');
    table.timestamps(true, true);

    // 索引
    table.index(['enabled']);
    table.index(['status']);
    table.index(['server_type']);
    table.index(['last_connected_at']);
    table.index(['last_tested_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('mcp_endpoints');
};