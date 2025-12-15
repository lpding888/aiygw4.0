/**
 * 创建案例展示表
 */
exports.up = async function (knex) {
  await knex.schema.createTable('showcases', (table) => {
    table.increments('id').primary();
    table.string('title', 200).notNullable().comment('案例标题');
    table.string('slug', 200).notNullable().unique().comment('URL标识');
    table.text('description').comment('案例描述');
    table.text('highlights').comment('亮点，JSON数组');
    table.string('cover_image', 500).comment('封面图URL');
    table.text('images').comment('图片列表，JSON数组');
    table.string('before_image', 500).comment('处理前图片');
    table.string('after_image', 500).comment('处理后图片');
    table.string('category', 50).comment('分类：clothing/shoes/accessories');
    table.string('style', 50).comment('风格：street/studio/indoor');
    table.string('customer_name', 100).comment('客户名称');
    table.string('customer_avatar', 500).comment('客户头像');
    table.text('customer_quote').comment('客户评价');
    table.enum('status', ['draft', 'published', 'archived']).defaultTo('draft').comment('状态');
    table.integer('view_count').defaultTo(0).comment('浏览次数');
    table.integer('like_count').defaultTo(0).comment('点赞数');
    table.boolean('is_featured').defaultTo(false).comment('是否精选');
    table.integer('sort_order').defaultTo(0).comment('排序');
    table.integer('created_by').unsigned().comment('创建者');
    table.timestamps(true, true);

    table.index(['status', 'is_featured', 'sort_order']);
    table.index('category');
  });

  console.log('[Migration] 案例展示表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('showcases');
  console.log('[Migration] 案例展示表已删除');
};
