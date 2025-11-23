/**
 * 扩展 verification_codes 表以完全支持邮箱验证码
 * - 将 phone 字段改为可空，允许只存邮箱
 * - 将 phone 长度扩展到 32 位，兼容国际号码
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('verification_codes', (table) => {
    table.string('phone', 32).nullable().comment('手机号').alter();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('verification_codes', (table) => {
    table.string('phone', 11).notNullable().comment('手机号').alter();
  });
};
