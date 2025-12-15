/**
 * 创建通知中心表
 */

const createTableIfMissing = async (knex, tableName, builder) => {
  const exists = await knex.schema.hasTable(tableName);
  if (!exists) {
    await knex.schema.createTable(tableName, builder);
    console.log(`[Migration] 创建表 ${tableName}`);
  } else {
    console.log(`[Migration] 表 ${tableName} 已存在，跳过`);
  }
};

exports.up = async function (knex) {
  // 通知表
  await createTableIfMissing(knex, 'notifications', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().comment('接收用户ID，NULL表示全局通知');
    table.string('title', 200).notNullable().comment('通知标题');
    table.text('content').comment('通知内容');
    table
      .enum('type', ['system', 'order', 'task', 'promotion', 'update', 'alert'])
      .defaultTo('system');
    table.enum('priority', ['low', 'normal', 'high', 'urgent']).defaultTo('normal');
    table.string('link_url', 500).comment('跳转链接');
    table.string('icon', 50).comment('图标');
    table.text('metadata').comment('附加数据JSON');
    table.boolean('is_read').defaultTo(false);
    table.datetime('read_at').comment('阅读时间');
    table.datetime('expires_at').comment('过期时间');
    table.integer('created_by').unsigned().comment('发送者');
    table.timestamps(true, true);

    table.index(['user_id', 'is_read', 'created_at']);
    table.index('type');
  });

  // 通知设置表
  await createTableIfMissing(knex, 'notification_settings', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().unique();
    table.boolean('email_enabled').defaultTo(true);
    table.boolean('push_enabled').defaultTo(true);
    table.boolean('sms_enabled').defaultTo(false);
    table.text('disabled_types').comment('禁用的通知类型JSON数组');
    table.text('quiet_hours').comment('免打扰时段JSON');
    table.timestamps(true, true);
  });

  console.log('[Migration] 通知中心表处理完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('notification_settings');
  await knex.schema.dropTableIfExists('notifications');
};
