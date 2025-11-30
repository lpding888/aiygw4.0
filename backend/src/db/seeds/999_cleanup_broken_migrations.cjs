/**
 * 清理损坏的迁移记录
 */
exports.seed = async function (knex) {
  console.log('🧹 开始清理损坏的迁移记录...');

  const missingMigrations = [
    '20251128000001_fix_provider_endpoints_schema.cjs',
    '20251128000002_add_dynamic_provider_fields.cjs'
  ];

  let totalDeleted = 0;

  for (const migrationName of missingMigrations) {
    const deleted = await knex('knex_migrations')
      .where('name', migrationName)
      .del();

    if (deleted > 0) {
      console.log(`✓ 已删除损坏的迁移记录: ${migrationName}`);
      totalDeleted += deleted;
    }
  }

  if (totalDeleted > 0) {
    console.log(`✅ 清理完成，共删除 ${totalDeleted} 条记录`);
  } else {
    console.log('ℹ️  没有找到需要清理的记录');
  }
};
