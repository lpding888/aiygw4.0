/**
 * 创建定时发布表
 */
exports.up = async function (knex) {
  await knex.schema.createTable('scheduled_tasks', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table
      .string('entity_type', 50)
      .notNullable()
      .comment('实体类型：announcement/banner/campaign等');
    table.integer('entity_id').unsigned().notNullable();
    table.enum('action', ['publish', 'unpublish', 'update', 'delete', 'notify']).notNullable();
    table.text('payload').comment('操作参数JSON');
    table.datetime('scheduled_at').notNullable();
    table.datetime('executed_at');
    table
      .enum('status', ['pending', 'processing', 'completed', 'failed', 'cancelled'])
      .defaultTo('pending');
    table.text('result').comment('执行结果');
    table.integer('retry_count').defaultTo(0);
    table.integer('max_retries').defaultTo(3);
    table.integer('created_by').unsigned();
    table.timestamps(true, true);
    table.index(['status', 'scheduled_at']);
    table.index(['entity_type', 'entity_id']);
  });

  console.log('[Migration] 定时发布表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('scheduled_tasks');
};
