/**
 * 扩展tasks表支持视频生成功能
 * 新增字段：coverUrl(智能封面), thumbnailUrl(GIF预览)
 */
exports.up = async function (knex) {
  const hasCover = await knex.schema.hasColumn('tasks', 'coverUrl');
  const hasThumbnail = await knex.schema.hasColumn('tasks', 'thumbnailUrl');

  if (hasCover && hasThumbnail) {
    console.log('✔ tasks表已包含coverUrl/thumbnailUrl，跳过重复添加');
    return;
  }

  await knex.schema.table('tasks', (table) => {
    if (!hasCover) {
      table.text('coverUrl').nullable().comment('视频智能封面URL');
    }
    if (!hasThumbnail) {
      table.text('thumbnailUrl').nullable().comment('视频GIF预览URL');
    }
  });

  console.log('✓ tasks表扩展成功 - 新增coverUrl和thumbnailUrl字段');
};

exports.down = async function (knex) {
  const dropColumnIfExists = async (column) => {
    const exists = await knex.schema.hasColumn('tasks', column);
    if (!exists) return;
    await knex.schema.table('tasks', (table) => {
      table.dropColumn(column);
    });
  };

  await dropColumnIfExists('coverUrl');
  await dropColumnIfExists('thumbnailUrl');
};
