/**
 * 创建流程执行记录表
 */

exports.up = function (knex) {
  return knex.schema.createTable('pipeline_executions', function (table) {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('schema_id').notNullable().comment('流程模板ID');
    table.string('execution_mode').notNullable().comment('执行模式: mock/real');
    table
      .string('status')
      .notNullable()
      .defaultTo('pending')
      .comment('状态: pending/running/completed/failed/cancelled');
    table.json('input_data').comment('输入数据');
    table.json('output_data').comment('输出数据');
    table.json('execution_context').comment('执行上下文');
    table.json('execution_metadata').comment('执行元数据');
    table.timestamp('started_at').nullable().comment('开始时间');
    table.timestamp('completed_at').nullable().comment('完成时间');
    table.integer('duration_ms').comment('执行时长(毫秒)');
    table.text('error_message').comment('错误信息');
    table.json('error_details').comment('错误详情');
    table.integer('created_by').unsigned().comment('创建者ID');

    // 索引
    table.index(['schema_id']);
    table.index(['status']);
    table.index(['execution_mode']);
    table.index(['created_at']);
    table.index(['started_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('pipeline_executions');
};
