/**
 * 创建工作流审批表
 */
exports.up = async function (knex) {
  // 工作流定义表
  await knex.schema.createTable('workflows', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('code', 50).notNullable().unique();
    table.text('description');
    table.string('entity_type', 50).comment('关联实体类型');
    table.boolean('is_active').defaultTo(true);
    table.integer('created_by').unsigned();
    table.timestamps(true, true);
  });

  // 工作流步骤表
  await knex.schema.createTable('workflow_steps', (table) => {
    table.increments('id').primary();
    table.integer('workflow_id').unsigned().notNullable();
    table.string('name', 100).notNullable();
    table.integer('step_order').notNullable();
    table.enum('type', ['approval', 'notification', 'condition', 'action']).defaultTo('approval');
    table.text('config').comment('步骤配置JSON');
    table.string('approver_role', 50).comment('审批角色');
    table.integer('approver_user_id').unsigned().comment('指定审批人');
    table.integer('timeout_hours').comment('超时小时数');
    table.enum('timeout_action', ['auto_approve', 'auto_reject', 'escalate']).comment('超时处理');
    table.timestamps(true, true);
    table.foreign('workflow_id').references('id').inTable('workflows').onDelete('CASCADE');
    table.index('workflow_id');
  });

  // 工作流实例表
  await knex.schema.createTable('workflow_instances', (table) => {
    table.increments('id').primary();
    table.integer('workflow_id').unsigned().notNullable();
    table.string('entity_type', 50).notNullable();
    table.integer('entity_id').unsigned().notNullable();
    table.integer('current_step').defaultTo(1);
    table
      .enum('status', ['pending', 'in_progress', 'approved', 'rejected', 'cancelled'])
      .defaultTo('pending');
    table.text('history').comment('审批历史JSON数组');
    table.integer('initiated_by').unsigned();
    table.datetime('started_at');
    table.datetime('completed_at');
    table.timestamps(true, true);
    table.foreign('workflow_id').references('id').inTable('workflows').onDelete('CASCADE');
    table.index(['entity_type', 'entity_id']);
    table.index('status');
  });

  console.log('[Migration] 工作流审批表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('workflow_instances');
  await knex.schema.dropTableIfExists('workflow_steps');
  await knex.schema.dropTableIfExists('workflows');
};
