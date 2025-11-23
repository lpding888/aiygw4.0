/**
 * 调整 users 表以支持邮箱登录
 */
exports.up = async function (knex) {
  const hasPhone = await knex.schema.hasColumn('users', 'phone');
  if (hasPhone) {
    await knex.schema.alterTable('users', (table) => {
      table.string('phone', 11).nullable().alter();
    });
  } else {
    await knex.schema.table('users', (table) => {
      table.string('phone', 11).nullable().comment('手机号');
    });
  }

  const [indexes] = await knex.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', [
    'users',
    'uq_users_email'
  ]);
  if (!indexes || indexes.length === 0) {
    await knex.schema.alterTable('users', (table) => {
      table.unique(['email'], 'uq_users_email');
    });
  }
};

exports.down = async function (knex) {
  const hasEmail = await knex.schema.hasColumn('users', 'email');
  if (hasEmail) {
    await knex.schema.alterTable('users', (table) => {
      table.dropUnique(['email'], 'uq_users_email');
    });
  }

  const hasPhone = await knex.schema.hasColumn('users', 'phone');
  if (hasPhone) {
    await knex.schema.alterTable('users', (table) => {
      table.string('phone', 11).notNullable().alter();
    });
  }
};
