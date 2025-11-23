/**
 * 创建供应商密钥表
 */

exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('provider_secrets');
  if (exists) {
    return;
  }
  return knex.schema.createTable('provider_secrets', function (table) {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('provider_id').notNullable().comment('供应商ID');
    table.text('encrypted_secret').notNullable().comment('加密的密钥');
    table.string('iv').notNullable().comment('初始化向量');
    table.timestamps(true, true);

    // 注释外键约束，避免兼容性问题
    // table.foreign('provider_id')
    //   .references('id')
    //   .inTable('provider_endpoints')
    //   .onDelete('CASCADE');

    // 索引
    table.index(['provider_id']);

    // 唯一约束
    table.unique(['provider_id']);
  });
};

exports.down = async function (knex) {
  const exists = await knex.schema.hasTable('provider_secrets');
  if (!exists) {
    return;
  }
  return knex.schema.dropTable('provider_secrets');
};
