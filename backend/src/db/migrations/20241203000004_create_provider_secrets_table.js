/**
 * 创建供应商密钥表
 */

exports.up = function(knex) {
  return knex.schema.createTable('provider_secrets', (table) {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('provider_id').notNullable().comment('供应商ID');
    table.text('encrypted_secret').notNullable().comment('加密的密钥');
    table.string('iv').notNullable().comment('初始化向量');
    table.timestamps(true, true);

    // 外键约束
    table.foreign('provider_id')
      .references('id')
      .inTable('provider_endpoints')
      .onDelete('CASCADE');

    // 索引
    table.index(['provider_id']);

    // 唯一约束
    table.unique(['provider_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('provider_secrets');
};