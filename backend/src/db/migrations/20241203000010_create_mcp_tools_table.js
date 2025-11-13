/**
 * 创建MCP工具表
 */

exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('mcp_tools');
  if (exists) {
    return;
  }
  return knex.schema.createTable('mcp_tools', function (table) {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('endpoint_id').notNullable().comment('MCP端点ID');
    table.string('name').notNullable().comment('工具名称');
    table.text('description').comment('工具描述');
    table.string('category').comment('工具分类');
    table.json('input_schema').comment('输入参数Schema');
    table.json('output_schema').comment('输出参数Schema');
    table.boolean('enabled').defaultTo(true).comment('是否启用');
    table.string('status').defaultTo('active').comment('状态: active/inactive/error');
    table.json('metadata').comment('工具元数据');
    table.timestamp('last_tested_at').nullable().comment('最后测试时间');
    table.json('last_test_result').comment('最后测试结果');
    table.timestamps(true, true);

    // 索引
    table.index(['endpoint_id']);
    table.index(['enabled']);
    table.index(['status']);
    table.index(['category']);
    table.index(['last_tested_at']);
  });
};

exports.down = async function (knex) {
  const exists = await knex.schema.hasTable('mcp_tools');
  if (!exists) {
    return;
  }
  return knex.schema.dropTable('mcp_tools');
};
