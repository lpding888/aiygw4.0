/**
 * 创建活动页表
 */
exports.up = async function (knex) {
  await knex.schema.createTable('campaigns', (table) => {
    table.increments('id').primary();
    table.string('name', 200).notNullable().comment('活动名称');
    table.string('slug', 200).notNullable().unique().comment('URL标识');
    table.string('title', 200).comment('页面标题');
    table.text('description').comment('活动描述');
    table.text('content').comment('页面内容（Markdown或HTML）');
    table.string('cover_image', 500).comment('封面图');
    table.string('background_image', 500).comment('背景图');
    table.string('background_color', 20).comment('背景色');
    table.text('custom_css').comment('自定义CSS');
    table.text('custom_js').comment('自定义JS');
    table
      .enum('type', ['promotion', 'holiday', 'launch', 'event', 'other'])
      .defaultTo('promotion')
      .comment('活动类型');
    table.text('cta_buttons').comment('行动按钮配置，JSON数组');
    table.text('countdown').comment('倒计时配置，JSON对象');
    table.text('prizes').comment('奖品配置，JSON数组');
    table.text('rules').comment('活动规则');
    table
      .enum('status', ['draft', 'scheduled', 'active', 'ended', 'archived'])
      .defaultTo('draft')
      .comment('状态');
    table.datetime('start_time').comment('开始时间');
    table.datetime('end_time').comment('结束时间');
    table.integer('view_count').defaultTo(0).comment('浏览次数');
    table.integer('participation_count').defaultTo(0).comment('参与人数');
    table.text('seo_config').comment('SEO配置，JSON对象');
    table.integer('created_by').unsigned().comment('创建者');
    table.timestamps(true, true);

    table.index(['status', 'start_time', 'end_time']);
    table.index('type');
  });

  console.log('[Migration] 活动页表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('campaigns');
  console.log('[Migration] 活动页表已删除');
};
