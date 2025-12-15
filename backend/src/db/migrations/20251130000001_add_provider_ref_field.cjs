/**
 * 添加 provider_ref 字段到 provider_endpoints 表
 */

exports.up = async function (knex) {
  const tableName = 'provider_endpoints';

  // 检查表是否存在
  const tableExists = await knex.schema.hasTable(tableName);
  if (!tableExists) {
    console.log('⚠️  provider_endpoints表不存在，跳过');
    return;
  }

  // 检查是否已经有provider_ref字段
  const hasProviderRefColumn = await knex.schema.hasColumn(tableName, 'provider_ref');
  if (hasProviderRefColumn) {
    console.log('✓ provider_ref字段已存在，跳过');
    return;
  }

  console.log('⏳ 开始添加provider_ref字段...');

  await knex.schema.alterTable(tableName, (table) => {
    table.string('provider_ref', 100).nullable().comment('供应商引用ID(llm_openai/llm_claude等)');
    table.index(['provider_ref']);
  });

  console.log('✓ provider_ref字段添加成功');
};

exports.down = async function (knex) {
  const tableName = 'provider_endpoints';

  // 检查字段是否存在
  const hasColumn = await knex.schema.hasColumn(tableName, 'provider_ref');
  if (!hasColumn) {
    console.log('✓ provider_ref字段不存在，无需回滚');
    return;
  }

  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn('provider_ref');
  });

  console.log('✓ 回滚成功：删除provider_ref字段');
};
