-- 1. 检查迁移记录表
SELECT * FROM knex_migrations ORDER BY id DESC;

-- 2. 检查 provider_endpoints 表结构
DESCRIBE provider_endpoints;

-- 3. 检查表中是否有数据
SELECT COUNT(*) as total_rows FROM provider_endpoints;

-- 4. 查看表中的前几条数据（如果有的话）
SELECT * FROM provider_endpoints LIMIT 5;
