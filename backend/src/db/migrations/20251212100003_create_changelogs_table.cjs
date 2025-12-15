/**
 * 创建更新日志表
 */
exports.up = async function (knex) {
  await knex.schema.createTable('changelogs', (table) => {
    table.increments('id').primary();
    table.string('version', 50).notNullable().comment('版本号');
    table.string('title', 200).notNullable().comment('标题');
    table.text('content').comment('详细内容（Markdown）');
    table.text('summary').comment('简短摘要');
    table
      .enum('type', ['major', 'minor', 'patch', 'hotfix'])
      .defaultTo('minor')
      .comment('版本类型');
    table.text('features').comment('新功能列表，JSON数组');
    table.text('improvements').comment('改进列表，JSON数组');
    table.text('fixes').comment('修复列表，JSON数组');
    table.text('breaking_changes').comment('破坏性变更，JSON数组');
    table.enum('status', ['draft', 'published']).defaultTo('draft').comment('状态');
    table.date('release_date').comment('发布日期');
    table.integer('created_by').unsigned().comment('创建者');
    table.timestamps(true, true);

    table.index(['status', 'release_date']);
    table.index('version');
  });

  console.log('[Migration] 更新日志表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('changelogs');
  console.log('[Migration] 更新日志表已删除');
};
