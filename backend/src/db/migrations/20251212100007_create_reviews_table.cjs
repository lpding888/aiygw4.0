/**
 * 创建用户评价表
 */
exports.up = async function (knex) {
  await knex.schema.createTable('reviews', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().comment('评价用户ID');
    table.string('user_name', 100).comment('用户名（可匿名）');
    table.string('user_avatar', 500).comment('用户头像');
    table.integer('rating').notNullable().comment('评分1-5');
    table.string('title', 200).comment('评价标题');
    table.text('content').comment('评价内容');
    table.text('images').comment('评价图片，JSON数组');
    table.string('product_type', 50).comment('产品类型：ai_model/basic_edit');
    table.integer('task_id').unsigned().comment('关联任务ID');
    table.boolean('is_verified').defaultTo(false).comment('已验证购买');
    table.boolean('is_featured').defaultTo(false).comment('精选评价');
    table
      .enum('status', ['pending', 'approved', 'rejected', 'hidden'])
      .defaultTo('pending')
      .comment('状态');
    table.text('admin_reply').comment('管理员回复');
    table.datetime('admin_reply_at').comment('回复时间');
    table.integer('helpful_count').defaultTo(0).comment('有帮助数');
    table.integer('sort_order').defaultTo(0).comment('排序');
    table.timestamps(true, true);

    table.index(['status', 'is_featured', 'rating']);
    table.index('user_id');
  });

  console.log('[Migration] 用户评价表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('reviews');
};
