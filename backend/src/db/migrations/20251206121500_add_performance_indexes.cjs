/**
 * 性能优化: 添加缺失的索引
 */
exports.up = async function (knex) {
    const ensureIndex = async (tableName, columns, indexName) => {
        try {
            const [rows] = await knex.raw(`SHOW INDEX FROM ?? WHERE Key_name = ?`, [tableName, indexName]);
            if (rows.length === 0) {
                await knex.schema.alterTable(tableName, (table) => {
                    table.index(columns, indexName);
                });
                console.log(`Added index ${indexName} to ${tableName}`);
            } else {
                console.log(`Index ${indexName} already exists on ${tableName}`);
            }
        } catch (error) {
            console.warn(`Failed to add index ${indexName}: ${error.message}`);
        }
    };

    // Users 表索引
    await ensureIndex('users', 'created_at', 'idx_users_created_at');
    await ensureIndex('users', 'isMember', 'idx_users_is_member');
    await ensureIndex('users', ['isMember', 'quota_expireAt'], 'idx_users_member_expire');

    // Tasks 表索引
    await ensureIndex('tasks', 'created_at', 'idx_tasks_created_at');

    // Orders 表索引
    await ensureIndex('orders', 'status', 'idx_orders_status');
};

exports.down = async function (knex) {
    try {
        await knex.schema.alterTable('orders', (table) => {
            table.dropIndex('status', 'idx_orders_status');
        });

        await knex.schema.alterTable('tasks', (table) => {
            table.dropIndex('created_at', 'idx_tasks_created_at');
        });

        await knex.schema.alterTable('users', (table) => {
            table.dropIndex(['isMember', 'quota_expireAt'], 'idx_users_member_expire');
            table.dropIndex('isMember', 'idx_users_is_member');
            table.dropIndex('created_at', 'idx_users_created_at');
        });
    } catch (e) {
        console.warn('Migration down failed (indices might not exist)', e);
    }
};
