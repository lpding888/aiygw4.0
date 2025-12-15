/**
 * 创建表单生成器表
 */
exports.up = async function (knex) {
  // 表单定义表
  await knex.schema.createTable('forms', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('slug', 100).notNullable().unique();
    table.text('description');
    table
      .enum('type', ['feedback', 'survey', 'contact', 'application', 'custom'])
      .defaultTo('custom');
    table.text('settings').comment('表单设置JSON');
    table.string('success_message', 500);
    table.string('redirect_url', 500);
    table.boolean('notify_admin').defaultTo(true);
    table.string('notify_email', 200);
    table.enum('status', ['draft', 'active', 'closed']).defaultTo('draft');
    table.datetime('start_time');
    table.datetime('end_time');
    table.integer('max_submissions');
    table.integer('submission_count').defaultTo(0);
    table.integer('created_by').unsigned();
    table.timestamps(true, true);
    table.index('status');
  });

  // 表单字段表
  await knex.schema.createTable('form_fields', (table) => {
    table.increments('id').primary();
    table.integer('form_id').unsigned().notNullable();
    table.string('name', 100).notNullable();
    table.string('label', 200).notNullable();
    table
      .enum('type', [
        'text',
        'textarea',
        'email',
        'phone',
        'number',
        'select',
        'radio',
        'checkbox',
        'date',
        'file',
        'rating',
        'hidden'
      ])
      .notNullable();
    table.text('options').comment('选项JSON数组');
    table.string('placeholder', 200);
    table.string('default_value', 500);
    table.text('validation').comment('验证规则JSON');
    table.boolean('required').defaultTo(false);
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    table.foreign('form_id').references('id').inTable('forms').onDelete('CASCADE');
    table.index('form_id');
  });

  // 表单提交表
  await knex.schema.createTable('form_submissions', (table) => {
    table.increments('id').primary();
    table.integer('form_id').unsigned().notNullable();
    table.integer('user_id').unsigned();
    table.text('data').comment('提交数据JSON');
    table.string('ip_address', 50);
    table.string('user_agent', 500);
    table.enum('status', ['pending', 'reviewed', 'replied', 'archived']).defaultTo('pending');
    table.text('admin_notes');
    table.integer('reviewed_by').unsigned();
    table.datetime('reviewed_at');
    table.timestamps(true, true);
    table.foreign('form_id').references('id').inTable('forms').onDelete('CASCADE');
    table.index(['form_id', 'status']);
  });

  console.log('[Migration] 表单生成器表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('form_submissions');
  await knex.schema.dropTableIfExists('form_fields');
  await knex.schema.dropTableIfExists('forms');
};
