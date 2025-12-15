/**
 * 创建弹窗管理表
 */
exports.up = async function (knex) {
  await knex.schema.createTable('popups', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().comment('弹窗名称');
    table.string('title', 200).comment('弹窗标题');
    table.text('content').comment('弹窗内容');
    table.string('image_url', 500).comment('弹窗图片');
    table.string('link_url', 500).comment('跳转链接');
    table.string('button_text', 50).comment('按钮文字');
    table
      .enum('type', ['welcome', 'promotion', 'notification', 'survey', 'exit_intent', 'custom'])
      .defaultTo('notification')
      .comment('弹窗类型');
    table
      .enum('position', ['center', 'bottom', 'top', 'bottom_right', 'bottom_left'])
      .defaultTo('center')
      .comment('显示位置');
    table
      .enum('size', ['small', 'medium', 'large', 'fullscreen'])
      .defaultTo('medium')
      .comment('尺寸');
    table.text('trigger_rules').comment('触发规则，JSON对象');
    table.integer('delay_seconds').defaultTo(0).comment('延迟显示秒数');
    table
      .integer('display_frequency')
      .defaultTo(1)
      .comment('显示频率：0=每次，1=每天一次，7=每周一次');
    table.text('target_pages').comment('目标页面，JSON数组，空则全站');
    table.text('target_audience').comment('目标用户，JSON对象');
    table.boolean('show_close_button').defaultTo(true).comment('显示关闭按钮');
    table.boolean('close_on_backdrop').defaultTo(true).comment('点击背景关闭');
    table.text('custom_style').comment('自定义样式，JSON对象');
    table
      .enum('status', ['draft', 'active', 'paused', 'archived'])
      .defaultTo('draft')
      .comment('状态');
    table.datetime('start_time').comment('开始时间');
    table.datetime('end_time').comment('结束时间');
    table.integer('impression_count').defaultTo(0).comment('展示次数');
    table.integer('click_count').defaultTo(0).comment('点击次数');
    table.integer('close_count').defaultTo(0).comment('关闭次数');
    table.integer('priority').defaultTo(0).comment('优先级，数字越大优先级越高');
    table.integer('created_by').unsigned().comment('创建者');
    table.timestamps(true, true);

    table.index(['status', 'priority']);
    table.index('type');
  });

  console.log('[Migration] 弹窗管理表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('popups');
  console.log('[Migration] 弹窗管理表已删除');
};
