-- 清理损坏的迁移记录
DELETE FROM knex_migrations
WHERE name IN (
  '20251128000001_fix_provider_endpoints_schema.cjs',
  '20251128000002_add_dynamic_provider_fields.cjs'
);

-- 查看清理后的迁移记录
SELECT * FROM knex_migrations ORDER BY id DESC LIMIT 10;
