/**
 * 创建多租户相关表
 * 包含：tenants(租户表)、tenant_members(租户成员表)
 */

const createTableIfMissing = async (knex, tableName, builder) => {
    const exists = await knex.schema.hasTable(tableName);
    if (!exists) {
        await knex.schema.createTable(tableName, builder);
        console.log(`[Migration] 创建表 ${tableName}`);
    } else {
        console.log(`[Migration] 表 ${tableName} 已存在，跳过`);
    }
};

const addColumnIfMissing = async (knex, tableName, columnName, builder) => {
    const exists = await knex.schema.hasColumn(tableName, columnName);
    if (!exists) {
        await knex.schema.alterTable(tableName, builder);
        console.log(`[Migration] 为表 ${tableName} 添加列 ${columnName}`);
    } else {
        console.log(`[Migration] 表 ${tableName} 的列 ${columnName} 已存在，跳过`);
    }
};

exports.up = async function (knex) {
    // 1. 创建租户表
    await createTableIfMissing(knex, 'tenants', (table) => {
        table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
        table.string('name', 200).notNullable().comment('租户名称');
        table.enum('type', ['personal', 'distributor', 'enterprise'])
            .defaultTo('personal')
            .comment('租户类型: personal=个人, distributor=分销商, enterprise=企业');
        table.string('owner_id', 36).notNullable().comment('租户所有者用户ID');
        table.string('avatar', 500).nullable().comment('租户头像URL');
        table.text('description').nullable().comment('租户描述');

        // 配置信息
        table.bigInteger('storage_quota').defaultTo(10 * 1024 * 1024 * 1024).comment('存储配额(字节),默认10GB');
        table.bigInteger('used_storage').defaultTo(0).comment('已用存储(字节)');
        table.json('allowed_features').nullable().comment('允许使用的功能列表');
        table.json('settings').nullable().comment('租户设置');
        table.json('branding').nullable().comment('品牌定制(企业客户用)');

        // 关联分销商
        table.string('distributor_id', 36).nullable().comment('关联的分销商ID');

        // 状态
        table.enum('status', ['active', 'suspended', 'deleted'])
            .defaultTo('active')
            .comment('租户状态');

        // 时间戳
        table.datetime('created_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
        table.datetime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        table.datetime('deleted_at').nullable();

        // 索引
        table.index('owner_id', 'idx_tenants_owner');
        table.index('type', 'idx_tenants_type');
        table.index('status', 'idx_tenants_status');
        table.index('distributor_id', 'idx_tenants_distributor');
    });

    // 2. 创建租户成员表
    await createTableIfMissing(knex, 'tenant_members', (table) => {
        table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
        table.string('tenant_id', 36).notNullable().comment('租户ID');
        table.string('user_id', 36).notNullable().comment('用户ID');
        table.enum('role', ['owner', 'admin', 'member', 'viewer'])
            .defaultTo('member')
            .comment('成员角色');
        table.enum('status', ['active', 'invited', 'removed'])
            .defaultTo('active')
            .comment('成员状态');
        table.string('invited_by', 36).nullable().comment('邀请人ID');
        table.datetime('joined_at').nullable().comment('加入时间');
        table.datetime('created_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
        table.datetime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

        // 唯一约束
        table.unique(['tenant_id', 'user_id'], 'uk_tenant_members');

        // 索引
        table.index('tenant_id', 'idx_tenant_members_tenant');
        table.index('user_id', 'idx_tenant_members_user');
        table.index('role', 'idx_tenant_members_role');
        table.index('status', 'idx_tenant_members_status');
    });

    // 3. 为核心表添加 tenant_id 字段
    await addColumnIfMissing(knex, 'tasks', 'tenant_id', (table) => {
        table.string('tenant_id', 36).nullable().after('userId').comment('所属租户ID');
        table.index('tenant_id', 'idx_tasks_tenant');
    });

    await addColumnIfMissing(knex, 'assets', 'tenant_id', (table) => {
        table.string('tenant_id', 36).nullable().after('user_id').comment('所属租户ID');
        table.index('tenant_id', 'idx_assets_tenant');
    });

    await addColumnIfMissing(knex, 'orders', 'tenant_id', (table) => {
        table.string('tenant_id', 36).nullable().after('userId').comment('所属租户ID');
        table.index('tenant_id', 'idx_orders_tenant');
    });

    // 4. 为已有分销商创建对应租户（数据迁移）
    const distributors = await knex('distributors').where('status', 'active').select('*');

    for (const dist of distributors) {
        const tenantId = knex.raw('UUID()');

        // 创建租户
        await knex('tenants').insert({
            id: tenantId,
            name: dist.real_name || `分销商${dist.id.slice(0, 6)}`,
            type: 'distributor',
            owner_id: dist.user_id,
            distributor_id: dist.id,
            status: 'active',
        });

        // 添加分销商为租户所有者
        await knex('tenant_members').insert({
            id: knex.raw('UUID()'),
            tenant_id: tenantId,
            user_id: dist.user_id,
            role: 'owner',
            status: 'active',
            joined_at: knex.raw('CURRENT_TIMESTAMP'),
        });
    }

    console.log(`[Migration] 已为 ${distributors.length} 个分销商创建对应租户`);
};

exports.down = async function (knex) {
    // 删除核心表的 tenant_id 字段
    const hasTasksTenantId = await knex.schema.hasColumn('tasks', 'tenant_id');
    if (hasTasksTenantId) {
        await knex.schema.alterTable('tasks', (table) => {
            table.dropIndex('tenant_id', 'idx_tasks_tenant');
            table.dropColumn('tenant_id');
        });
    }

    const hasAssetsTenantId = await knex.schema.hasColumn('assets', 'tenant_id');
    if (hasAssetsTenantId) {
        await knex.schema.alterTable('assets', (table) => {
            table.dropIndex('tenant_id', 'idx_assets_tenant');
            table.dropColumn('tenant_id');
        });
    }

    const hasOrdersTenantId = await knex.schema.hasColumn('orders', 'tenant_id');
    if (hasOrdersTenantId) {
        await knex.schema.alterTable('orders', (table) => {
            table.dropIndex('tenant_id', 'idx_orders_tenant');
            table.dropColumn('tenant_id');
        });
    }

    // 删除租户相关表
    await knex.schema.dropTableIfExists('tenant_members');
    await knex.schema.dropTableIfExists('tenants');
};
