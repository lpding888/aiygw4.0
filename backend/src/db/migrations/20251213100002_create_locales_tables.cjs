/**
 * 创建多语言管理表
 */
exports.up = async function (knex) {
  // 语言配置表
  await knex.schema.createTable('locales', (table) => {
    table.increments('id').primary();
    table.string('code', 10).notNullable().unique().comment('语言代码 zh-CN/en-US');
    table.string('name', 50).notNullable().comment('语言名称');
    table.string('native_name', 50).comment('原生名称');
    table.string('flag_icon', 50).comment('国旗图标');
    table.boolean('is_default').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    table.integer('sort_order').defaultTo(0);
    table.timestamps(true, true);
  });

  // 翻译表
  await knex.schema.createTable('translations', (table) => {
    table.increments('id').primary();
    table.string('locale_code', 10).notNullable();
    table.string('namespace', 50).defaultTo('common').comment('命名空间');
    table.string('key', 200).notNullable().comment('翻译键');
    table.text('value').comment('翻译值');
    table.text('description').comment('描述');
    table.boolean('is_verified').defaultTo(false);
    table.integer('updated_by').unsigned();
    table.timestamps(true, true);

    table.unique(['locale_code', 'namespace', 'key']);
    table.index(['namespace', 'key']);
  });

  // 插入默认语言
  await knex('locales').insert([
    { code: 'zh-CN', name: '简体中文', native_name: '简体中文', is_default: true, sort_order: 0 },
    { code: 'en-US', name: 'English', native_name: 'English', is_active: true, sort_order: 1 }
  ]);

  console.log('[Migration] 多语言管理表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('translations');
  await knex.schema.dropTableIfExists('locales');
};
