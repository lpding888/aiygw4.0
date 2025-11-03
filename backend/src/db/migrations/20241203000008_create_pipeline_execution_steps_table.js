/**
 * 创建流程执行步骤表
 */

exports.up = function(knex) {
  return knex.schema.createTable('pipeline_execution_steps', function(table) {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('execution_id').notNullable().comment('执行记录ID');
    table.string('node_id').notNullable().comment('节点ID');
    table.string('node_type').notNullable().comment('节点类型');
    table.string('status').notNullable().defaultTo('pending').comment('状态: pending/running/completed/failed/skipped');
    table.json('input_data').comment('节点输入数据');
    table.json('output_data').comment('节点输出数据');
    table.json('config').comment('节点配置');
    table.timestamp('started_at').nullable().comment('开始时间');
    table.timestamp('completed_at').nullable().comment('完成时间');
    table.integer('duration_ms').comment('执行时长(毫秒)');
    table.text('error_message').comment('错误信息');
    table.integer('retry_count').defaultTo(0).comment('重试次数');
    table.json('metadata').comment('步骤元数据');

    // 索引
    table.index(['execution_id']);
    table.index(['node_id']);
    table.index(['status']);
    table.index(['started_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('pipeline_execution_steps');
};