/**
 * 确保 feature_definitions 表结构与 FeatureCatalogService 使用的字段保持一致
 * - 为缺失列创建 schema
 * - 回填关键字段的数据
 * - 设置 NOT NULL / 默认值，避免再次出现列缺失导致的 500 报错
 */

const TABLE_NAME = 'feature_definitions';

const ensureColumn = async (knex, columnName, alterCallback) => {
  const exists = await knex.schema.hasColumn(TABLE_NAME, columnName);
  if (!exists) {
    await knex.schema.table(TABLE_NAME, alterCallback);
  }
};

const backfillIfEmpty = async (knex, columnName, valueExpression) => {
  await knex(TABLE_NAME)
    .where((builder) => {
      builder.whereNull(columnName).orWhere(columnName, '');
    })
    .update({ [columnName]: valueExpression });
};

exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    throw new Error(
      'feature_definitions 表不存在，请先执行基础迁移（20231029000001_create_feature_definitions_table）'
    );
  }

  await ensureColumn(knex, 'feature_id', (table) => {
    table.string('feature_id', 100).nullable().comment('功能ID(兼容旧字段，默认与feature_key一致)');
  });
  await ensureColumn(knex, 'display_name', (table) => {
    table.string('display_name', 200).nullable().comment('显示名称');
  });
  await ensureColumn(knex, 'is_enabled', (table) => {
    table.boolean('is_enabled').notNullable().defaultTo(true).comment('是否启用');
  });
  await ensureColumn(knex, 'plan_required', (table) => {
    table.string('plan_required', 50).nullable().comment('所需套餐级别');
  });
  await ensureColumn(knex, 'access_scope', (table) => {
    table.string('access_scope', 20).nullable().comment('访问范围(plan/whitelist)');
  });
  await ensureColumn(knex, 'allowed_accounts', (table) => {
    table.text('allowed_accounts').nullable().comment('白名单用户列表(JSON字符串)');
  });
  await ensureColumn(knex, 'quota_cost', (table) => {
    table.integer('quota_cost').nullable().comment('配额消耗数量');
  });
  await ensureColumn(knex, 'rate_limit_policy', (table) => {
    table.string('rate_limit_policy', 100).nullable().comment('限流策略描述');
  });
  await ensureColumn(knex, 'output_type', (table) => {
    table.string('output_type', 50).nullable().comment('输出类型(singleImage/video/text等)');
  });
  await ensureColumn(knex, 'save_to_asset_library', (table) => {
    table.boolean('save_to_asset_library').notNullable().defaultTo(false).comment('是否自动入素材库');
  });
  await ensureColumn(knex, 'form_schema_ref', (table) => {
    table.string('form_schema_ref', 100).nullable().comment('表单Schema引用ID');
  });
  await ensureColumn(knex, 'pipeline_schema_ref', (table) => {
    table.string('pipeline_schema_ref', 100).nullable().comment('Pipeline Schema引用ID');
  });
  await ensureColumn(knex, 'deleted_at', (table) => {
    table.timestamp('deleted_at').nullable().comment('删除时间(软删除)');
  });

  // === 回填数据，保证 NOT NULL 约束不会失败 ===
  await backfillIfEmpty(knex, 'feature_id', knex.ref('feature_key'));

  const hasNameColumn = await knex.schema.hasColumn(TABLE_NAME, 'name');
  const displayNameValue = hasNameColumn
    ? knex.raw('COALESCE(??, ??)', ['name', 'feature_key'])
    : knex.ref('feature_key');
  await backfillIfEmpty(knex, 'display_name', displayNameValue);

  const hasIsActiveColumn = await knex.schema.hasColumn(TABLE_NAME, 'is_active');
  if (hasIsActiveColumn) {
    await knex(TABLE_NAME)
      .whereNull('is_enabled')
      .update('is_enabled', knex.raw('CASE WHEN ?? IS NULL THEN 1 ELSE ?? END', ['is_active', 'is_active']));
  }
  await knex(TABLE_NAME).whereNull('is_enabled').update('is_enabled', 1);

  await knex(TABLE_NAME).whereNull('plan_required').update('plan_required', 'basic');
  await knex(TABLE_NAME).whereNull('access_scope').update('access_scope', 'plan');
  await knex(TABLE_NAME).whereNull('quota_cost').update('quota_cost', 1);
  await knex(TABLE_NAME).whereNull('output_type').update('output_type', 'singleImage');
  await knex(TABLE_NAME)
    .whereNull('save_to_asset_library')
    .update('save_to_asset_library', 0);

  // === 设置 NOT NULL 及默认值 ===
  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.string('feature_id', 100).notNullable().comment('功能ID(兼容旧字段，默认与feature_key一致)').alter();
    table.string('display_name', 200).notNullable().comment('显示名称').alter();
    table.boolean('is_enabled').notNullable().defaultTo(true).comment('是否启用').alter();
    table.string('plan_required', 50).notNullable().defaultTo('basic').comment('所需套餐级别').alter();
    table.string('access_scope', 20).notNullable().defaultTo('plan').comment('访问范围(plan/whitelist)').alter();
    table.integer('quota_cost').notNullable().defaultTo(1).comment('配额消耗数量').alter();
    table
      .string('output_type', 50)
      .notNullable()
      .defaultTo('singleImage')
      .comment('输出类型(singleImage/video/text等)')
      .alter();
    table
      .boolean('save_to_asset_library')
      .notNullable()
      .defaultTo(false)
      .comment('是否自动入素材库')
      .alter();
  });
};

exports.down = async function (knex) {
  // 该迁移仅用于补齐/校准 schema，不执行 destructive rollback
  // 如果确需回滚，请使用备份或手动调整列结构
  await knex.schema.table(TABLE_NAME, () => undefined);
};
