/**
 * 创建定价配置表
 */
exports.up = async function (knex) {
  await knex.schema.createTable('pricing_configs', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().comment('配置名称');
    table.string('code', 50).notNullable().unique().comment('配置代码');
    table.text('description').comment('描述');
    table
      .enum('type', ['discount', 'coupon', 'bundle', 'tier', 'special'])
      .defaultTo('discount')
      .comment('类型');
    table.decimal('discount_percent', 5, 2).comment('折扣百分比');
    table.decimal('discount_amount', 10, 2).comment('折扣金额');
    table.decimal('min_order_amount', 10, 2).comment('最低订单金额');
    table.integer('max_uses').comment('最大使用次数');
    table.integer('used_count').defaultTo(0).comment('已使用次数');
    table.integer('max_uses_per_user').comment('每用户最大使用次数');
    table.text('applicable_plans').comment('适用套餐，JSON数组');
    table.text('excluded_plans').comment('排除套餐，JSON数组');
    table.text('conditions').comment('其他条件，JSON对象');
    table.boolean('stackable').defaultTo(false).comment('可叠加');
    table
      .enum('status', ['draft', 'active', 'paused', 'expired'])
      .defaultTo('draft')
      .comment('状态');
    table.datetime('start_time').comment('开始时间');
    table.datetime('end_time').comment('结束时间');
    table.integer('priority').defaultTo(0).comment('优先级');
    table.integer('created_by').unsigned().comment('创建者');
    table.timestamps(true, true);

    table.index(['status', 'type']);
    table.index(['start_time', 'end_time']);
  });

  console.log('[Migration] 定价配置表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('pricing_configs');
  console.log('[Migration] 定价配置表已删除');
};
