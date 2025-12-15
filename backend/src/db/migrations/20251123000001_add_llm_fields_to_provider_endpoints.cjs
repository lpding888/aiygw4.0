/**
 * 为provider_endpoints表添加LLM Provider所需字段
 * 保持向后兼容，添加新字段而不删除旧字段
 */

exports.up = async function (knex) {
  const tableName = 'provider_endpoints';

  // 检查表是否存在
  const tableExists = await knex.schema.hasTable(tableName);
  if (!tableExists) {
    console.log('⚠️  provider_endpoints表不存在，跳过');
    return;
  }

  // 检查是否已经有provider_ref字段（如果有则跳过）
  const hasProviderRefColumn = await knex.schema.hasColumn(tableName, 'provider_ref');
  if (hasProviderRefColumn) {
    console.log('✓ provider_endpoints表已包含provider_ref字段，跳过');
    return;
  }

  console.log('⏳ 开始为provider_endpoints表添加LLM字段...');

  await knex.schema.alterTable(tableName, (table) => {
    // 添加新字段（nullable，保持向后兼容）
    table.string('provider_ref', 100).nullable().comment('供应商引用ID(llm_openai/llm_claude等)');
    table.string('type', 50).nullable().comment('Provider类型(openai/claude/qwen等)');
    table.text('description').nullable().comment('详细描述');
    table.string('base_url', 500).nullable().comment('API基础URL');
    table.integer('weight').nullable().defaultTo(100).comment('权重');
    table.integer('timeout').nullable().defaultTo(60000).comment('超时时间(ms)');
    table.integer('retry').nullable().defaultTo(2).comment('重试次数');
    table.boolean('enabled').nullable().defaultTo(true).comment('是否启用');
    table.string('status', 20).nullable().defaultTo('inactive').comment('状态');
    table.timestamp('last_tested_at').nullable().comment('最后测试时间');
    table.json('last_test_result').nullable().comment('最后测试结果');
    table.integer('created_by').unsigned().nullable().comment('创建者ID');

    // 添加索引
    table.index(['provider_ref']);
    table.index(['enabled']);
    table.index(['status']);
    table.index(['type']);
  });

  console.log('✓ provider_endpoints表字段添加成功');
};

exports.down = async function (knex) {
  const tableName = 'provider_endpoints';

  await knex.schema.alterTable(tableName, (table) => {
    // 删除新增的列
    table.dropColumn('provider_ref');
    table.dropColumn('type');
    table.dropColumn('description');
    table.dropColumn('base_url');
    table.dropColumn('weight');
    table.dropColumn('timeout');
    table.dropColumn('retry');
    table.dropColumn('enabled');
    table.dropColumn('status');
    table.dropColumn('last_tested_at');
    table.dropColumn('last_test_result');
    table.dropColumn('created_by');
  });

  console.log('✓ 回滚成功：删除LLM相关字段');
};
