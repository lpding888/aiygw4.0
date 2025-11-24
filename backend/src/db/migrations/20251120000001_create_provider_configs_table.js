/**
 * 创建 Provider 配置表
 * 用于存储各类 Provider 的核心配置信息
 */

exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('provider_configs');
  if (exists) {
    console.log('⚠️  provider_configs 表已存在，跳过创建');
    return;
  }

  console.log('📦 创建 provider_configs 表...');

  return knex.schema.createTable('provider_configs', (table) => {
    // 主键
    table.string('provider_id', 64).primary().comment('Provider唯一标识');

    // 基本信息
    table.string('provider_name', 100).notNullable().comment('Provider名称');
    table
      .string('type', 50)
      .notNullable()
      .comment('Provider类型: runninghub/scf/sync_image/email等');
    table.text('description').nullable().comment('描述信息');

    // 核心配置（JSON格式，灵活存储各种配置）
    table.json('config').notNullable().comment('Provider配置（JSON格式）');

    // 状态控制
    table.boolean('is_enabled').defaultTo(true).notNullable().comment('是否启用');
    table.integer('priority').defaultTo(100).comment('优先级（数字越小优先级越高）');

    // 软删除
    table.timestamp('deleted_at').nullable().comment('删除时间（软删除）');

    // 元数据
    table.json('metadata').nullable().comment('额外元数据');

    // 时间戳
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    // 索引
    table.index('is_enabled', 'idx_enabled');
    table.index('type', 'idx_type');
    table.index('deleted_at', 'idx_deleted');
    table.index(['type', 'is_enabled'], 'idx_type_enabled');
  });
};

exports.down = async function (knex) {
  const exists = await knex.schema.hasTable('provider_configs');
  if (!exists) {
    console.log('⚠️  provider_configs 表不存在，跳过删除');
    return;
  }

  console.log('🗑️  删除 provider_configs 表...');
  return knex.schema.dropTable('provider_configs');
};
