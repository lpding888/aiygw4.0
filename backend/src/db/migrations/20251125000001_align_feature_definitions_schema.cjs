/**
 * 将 legacy feature_definitions 表对齐到新的功能目录 schema
 */

const addColumnIfMissing = async (knex, columnName, builder) => {
  const hasColumn = await knex.schema.hasColumn('feature_definitions', columnName);
  if (!hasColumn) {
    await knex.schema.alterTable('feature_definitions', (table) => {
      builder(table);
    });
  }
};

const dropColumnIfExists = async (knex, columnName) => {
  const hasColumn = await knex.schema.hasColumn('feature_definitions', columnName);
  if (hasColumn) {
    await knex.schema.alterTable('feature_definitions', (table) => {
      table.dropColumn(columnName);
    });
  }
};

exports.up = async function up(knex) {
  await addColumnIfMissing(knex, 'name', (table) => {
    table.string('name', 200).nullable().comment('功能名称');
  });

  await addColumnIfMissing(knex, 'type', (table) => {
    table.string('type', 50).nullable().defaultTo('basic').comment('功能类型');
  });

  await addColumnIfMissing(knex, 'is_active', (table) => {
    table.boolean('is_active').nullable().defaultTo(true).comment('是否激活');
    table.index(['is_active'], 'idx_feature_defs_active');
  });

  await addColumnIfMissing(knex, 'is_public', (table) => {
    table.boolean('is_public').nullable().defaultTo(true).comment('是否公开');
    table.index(['is_public'], 'idx_feature_defs_public');
  });

  await addColumnIfMissing(knex, 'tags', (table) => {
    table.json('tags').nullable().comment('功能标签');
  });

  await addColumnIfMissing(knex, 'metadata', (table) => {
    table.json('metadata').nullable().comment('功能元数据');
  });

  await addColumnIfMissing(knex, 'icon', (table) => {
    table.string('icon', 200).nullable().comment('功能图标URL');
  });

  await addColumnIfMissing(knex, 'version', (table) => {
    table.string('version', 20).nullable().defaultTo('1.0.0').comment('功能版本');
  });

  await addColumnIfMissing(knex, 'requirements', (table) => {
    table.json('requirements').nullable().comment('功能要求');
  });

  await addColumnIfMissing(knex, 'limits', (table) => {
    table.json('limits').nullable().comment('使用限制');
  });

  await addColumnIfMissing(knex, 'pricing', (table) => {
    table.json('pricing').nullable().comment('定价信息');
  });

  await addColumnIfMissing(knex, 'released_at', (table) => {
    table.timestamp('released_at').nullable().comment('发布时间');
    table.index(['released_at'], 'idx_feature_defs_release');
  });

  await addColumnIfMissing(knex, 'deprecated_at', (table) => {
    table.timestamp('deprecated_at').nullable().comment('废弃时间');
  });

  // 数据回填
  const baseQuery = knex('feature_definitions');

  // 名称与激活状态
  await baseQuery.update({
    name: knex.raw('COALESCE(name, display_name)'),
    type: knex.raw("COALESCE(type, 'basic')"),
    is_active: knex.raw('COALESCE(is_active, is_enabled, 1)'),
    version: knex.raw("COALESCE(version, '1.0.0')"),
    released_at: knex.raw('COALESCE(released_at, created_at)')
  });

  await knex('feature_definitions').update({
    is_public: knex.raw(
      "COALESCE(is_public, CASE WHEN access_scope = 'whitelist' THEN 0 ELSE 1 END)"
    )
  });
};

exports.down = async function down(knex) {
  await dropColumnIfExists(knex, 'deprecated_at');
  await dropColumnIfExists(knex, 'released_at');
  await dropColumnIfExists(knex, 'pricing');
  await dropColumnIfExists(knex, 'limits');
  await dropColumnIfExists(knex, 'requirements');
  await dropColumnIfExists(knex, 'version');
  await dropColumnIfExists(knex, 'icon');
  await dropColumnIfExists(knex, 'metadata');
  await dropColumnIfExists(knex, 'tags');
  await dropColumnIfExists(knex, 'is_public');
  await dropColumnIfExists(knex, 'is_active');
  await dropColumnIfExists(knex, 'type');
  await dropColumnIfExists(knex, 'name');
};
