/**
 * 创建 KMS 密钥存储表
 *
 * 用于保存经过应用层加密后的密钥，统一由 kms.service 管理。
 */

exports.up = async function up(knex) {
  const tableExists = await knex.schema.hasTable('kms_secrets');
  if (tableExists) {
    return;
  }

  await knex.schema.createTable('kms_secrets', (table) => {
    table.string('id').primary().comment('密钥引用 ID（业务自定义或自动生成）');
    table.string('reference').nullable().comment('业务侧引用描述');
    table.string('scope').nullable().comment('作用域/业务域，便于筛选');
    table.text('ciphertext').notNullable().comment('密文，hex 编码');
    table.string('iv', 32).notNullable().comment('初始化向量，hex 编码');
    table.string('auth_tag', 32).notNullable().comment('GCM 校验标签，hex 编码');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['scope']);
    table.index(['reference']);
  });
};

exports.down = async function down(knex) {
  const tableExists = await knex.schema.hasTable('kms_secrets');
  if (!tableExists) {
    return;
  }

  await knex.schema.dropTable('kms_secrets');
};
