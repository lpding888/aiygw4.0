/**
 * 创建媒体库表
 */
exports.up = async function (knex) {
  // 媒体文件夹表
  await knex.schema.createTable('media_folders', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('slug', 100).notNullable();
    table.integer('parent_id').unsigned();
    table.string('path', 500).comment('完整路径');
    table.integer('created_by').unsigned();
    table.timestamps(true, true);

    table.foreign('parent_id').references('id').inTable('media_folders').onDelete('CASCADE');
    table.index('parent_id');
  });

  // 媒体文件表
  await knex.schema.createTable('media_files', (table) => {
    table.increments('id').primary();
    table.integer('folder_id').unsigned();
    table.string('name', 200).notNullable();
    table.string('original_name', 200).comment('原始文件名');
    table.string('file_path', 500).notNullable();
    table.string('url', 500).notNullable();
    table.string('thumbnail_url', 500).comment('缩略图');
    table.enum('type', ['image', 'video', 'audio', 'document', 'other']).defaultTo('image');
    table.string('mime_type', 100);
    table.string('extension', 20);
    table.integer('size').unsigned().comment('文件大小(bytes)');
    table.integer('width').unsigned().comment('图片/视频宽度');
    table.integer('height').unsigned().comment('图片/视频高度');
    table.integer('duration').unsigned().comment('视频/音频时长(秒)');
    table.string('alt_text', 200);
    table.text('description');
    table.text('metadata').comment('EXIF等元数据JSON');
    table.text('tags').comment('标签JSON数组');
    table.integer('use_count').defaultTo(0);
    table.integer('created_by').unsigned();
    table.timestamps(true, true);

    table.foreign('folder_id').references('id').inTable('media_folders').onDelete('SET NULL');
    table.index(['folder_id', 'type']);
    table.index('created_by');
  });

  console.log('[Migration] 媒体库表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('media_files');
  await knex.schema.dropTableIfExists('media_folders');
};
