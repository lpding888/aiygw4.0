/**
 * 创建MCP端点表
 */

exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('mcp_endpoints');
  if (exists) {
    return;
  }

  return knex.schema.createTable('mcp_endpoints', function (table) {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('name').notNullable().comment('MCP端点名称');
    table.text('description').comment('端点描述');
    table.string('endpoint_url', 500).notNullable().comment('MCP服务基础URL或stdio命令');
    table.string('api_key').notNullable().comment('KMS存储的API密钥ID');
    table.string('protocol_version').defaultTo('2024-11-05').comment('协议版本');
    table.json('capabilities').comment('服务能力');
    table.json('supported_tools').comment('已同步的工具列表');
    table.string('status').defaultTo('inactive').comment('状态: inactive/active/error');
    table.boolean('healthy').defaultTo(false).comment('健康状态');
    table.integer('timeout_ms').defaultTo(30000).comment('超时时间(ms)');
    table.integer('max_retries').defaultTo(3).comment('重试次数');
    table.boolean('enabled').defaultTo(true).comment('是否启用');
    table.json('metadata').comment('端点元数据');
    table.timestamp('last_sync_at').nullable().comment('最后同步时间');
    table.text('last_error').comment('最后错误信息');
    table.string('created_by').comment('创建者ID');
    table.string('updated_by').comment('更新者ID');
    table.timestamps(true, true);

    // 索引
    table.index(['enabled']);
    table.index(['status']);
    table.index(['healthy']);
    table.index(['last_sync_at']);
  });
};

exports.down = async function (knex) {
  const exists = await knex.schema.hasTable('mcp_endpoints');
  if (!exists) {
    return;
  }
  return knex.schema.dropTable('mcp_endpoints');
};
