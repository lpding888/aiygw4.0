/**
 * 创建流程校验历史表
 */

exports.up = function (knex) {
  return knex.schema.createTable('pipeline_validations', function (table) {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('schema_id').notNullable().comment('流程模板ID');
    table.string('validation_type').notNullable().comment('校验类型');
    table.string('status').notNullable().comment('校验状态: passed/failed/warning');
    table.json('validation_result').comment('校验结果详情');
    table.text('error_message').comment('错误信息');
    table.integer('execution_time_ms').comment('执行时间(毫秒)');
    table.json('validation_metrics').comment('校验指标');

    // 审计字段
    table.integer('triggered_by').unsigned().comment('触发者ID');
    table.timestamps(true, true);

    // 注释外键约束，避免兼容性问题
    // table.foreign('schema_id')
    //   .references('id')
    //   .inTable('pipeline_schemas')
    //   .onDelete('CASCADE');

    // 索引
    table.index(['schema_id']);
    table.index(['validation_type']);
    table.index(['status']);
    table.index(['created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable('pipeline_validations');
};
