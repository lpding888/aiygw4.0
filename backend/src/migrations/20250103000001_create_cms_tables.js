/**
 * CMS系统核心表结构迁移
 *
 * 包含以下表：
 * - features: 功能配置管理
 * - config_snapshots: 配置快照
 * - provider_endpoints: 供应商端点配置
 * - provider_secrets: 供应商敏感信息（加密存储）
 * - mcp_endpoints: MCP连接管理
 * - pipeline_schemas: 流程模式定义
 * - prompt_versions: 提示词版本管理
 */

exports.up = async function(knex) {
  // 1. 功能配置表
  await knex.schema.createTable('features', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('key', 100).notNullable().unique().comment('功能唯一标识');
    table.string('name', 200).notNullable().comment('功能名称');
    table.text('description').comment('功能描述');
    table.enum('category', ['image', 'video', 'text', 'system']).defaultTo('image').comment('功能分类');
    table.json('config').comment('功能配置JSON');
    table.boolean('enabled').defaultTo(true).comment('是否启用');
    table.string('menu_path', 200).comment('菜单路径');
    table.string('icon', 100).comment('图标');
    table.string('color', 20).comment('主题色');
    table.integer('quota_cost').defaultTo(1).comment('配额消耗');
    table.enum('access_scope', ['all', 'plan', 'whitelist']).defaultTo('all').comment('访问范围');
    table.json('allowed_accounts').comment('允许访问的账号列表');
    table.string('output_type', 50).defaultTo('singleImage').comment('输出类型');
    table.boolean('save_to_asset_library').defaultTo(true).comment('是否保存到素材库');

    // 版本控制
    table.string('version', 20).defaultTo('1.0.0').comment('版本号');
    table.string('status', 20).defaultTo('draft').comment('状态: draft/published/archived');
    table.timestamp('published_at').nullable().comment('发布时间');

    // 审计字段
    table.uuid('created_by').nullable().comment('创建人');
    table.uuid('updated_by').nullable().comment('更新人');
    table.timestamps(true, true);

    // 索引
    table.index(['enabled', 'status']);
    table.index(['category']);
    table.index(['access_scope']);
    table.index(['published_at']);
    table.index(['created_by']);
  });

  // 2. 配置快照表
  await knex.schema.createTable('config_snapshots', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('scope', 100).notNullable().comment('快照范围: features/menus/ui等');
    table.string('key', 200).nullable().comment('配置键名');
    table.string('version', 20).notNullable().comment('版本号');
    table.text('snapshot_data').comment('快照数据JSON');
    table.text('description').comment('快照描述');
    table.enum('action', ['create', 'update', 'delete', 'publish', 'rollback']).notNullable().comment('操作类型');

    // 状态管理
    table.string('status', 20).defaultTo('active').comment('状态: active/rollback/deleted');
    table.boolean('is_current').defaultTo(false).comment('是否为当前版本');

    // 审计字段
    table.uuid('created_by').nullable().comment('创建人');
    table.timestamps(true, true);

    // 索引
    table.index(['scope', 'key', 'version']);
    table.index(['status', 'is_current']);
    table.index(['created_by']);
    table.unique(['scope', 'key', 'version']);
  });

  // 3. 供应商端点配置表
  await knex.schema.createTable('provider_endpoints', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('name', 100).notNullable().comment('供应商名称');
    table.string('type', 50).notNullable().comment('供应商类型: ai/image/video等');
    table.string('base_url', 500).notNullable().comment('基础URL');
    table.string('api_key', 100).comment('API密钥标识（不存储实际密钥）');
    table.string('handler_key', 100).comment('处理密钥标识');
    table.json('config').comment('供应商配置');
    table.integer('weight').defaultTo(1).comment('权重');
    table.integer('timeout_ms').defaultTo(30000).comment('超时时间(毫秒)');
    table.integer('max_retries').defaultTo(3).comment('最大重试次数');
    table.boolean('enabled').defaultTo(true).comment('是否启用');
    table.text('description').comment('描述');

    // 健康检查
    table.boolean('healthy').defaultTo(true).comment('是否健康');
    table.timestamp('last_check_at').nullable().comment('最后检查时间');
    table.text('last_error').nullable().comment('最后错误信息');

    // 审计字段
    table.uuid('created_by').nullable().comment('创建人');
    table.uuid('updated_by').nullable().comment('更新人');
    table.timestamps(true, true);

    // 索引
    table.index(['type', 'enabled']);
    table.index(['healthy']);
    table.index(['weight']);
    table.index(['created_by']);
  });

  // 4. 供应商敏感信息表（加密存储）
  await knex.schema.createTable('provider_secrets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('provider_id').notNullable().comment('供应商ID');
    table.string('secret_type', 50).notNullable().comment('密钥类型: api_key/handler_key等');
    table.text('encrypted_value').notNullable().comment('加密后的密钥值');
    table.string('encryption_version', 20).defaultTo('v1').comment('加密版本');
    table.string('algorithm', 50).defaultTo('AES-256-GCM').comment('加密算法');
    table.string('key_id', 100).comment('密钥ID');
    table.text('metadata').comment('元数据JSON');

    // 审计字段
    table.uuid('created_by').nullable().comment('创建人');
    table.timestamps(true, true);

    // 外键约束
    table.foreign('provider_id').references('id').inTable('provider_endpoints').onDelete('CASCADE');

    // 索引
    table.index(['provider_id', 'secret_type']);
    table.index(['key_id']);
  });

  // 5. MCP端点管理表
  await knex.schema.createTable('mcp_endpoints', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('name', 100).notNullable().comment('MCP服务名称');
    table.string('transport_type', 20).notNullable().comment('传输类型: http/ws/stdio');
    table.string('endpoint_url', 500).comment('端点URL');
    table.string('command', 500).comment('命令行(stdio模式)');
    table.json('config').comment('MCP配置');
    table.text('tools_schema').comment('工具模式JSON');
    table.string('access_token', 200).comment('访问令牌');
    table.integer('timeout_ms').defaultTo(10000).comment('超时时间');
    table.integer('max_connections').defaultTo(10).comment('最大连接数');
    table.boolean('enabled').defaultTo(true).comment('是否启用');
    table.text('description').comment('描述');

    // 状态管理
    table.boolean('connected').defaultTo(false).comment('是否已连接');
    table.timestamp('last_discover_at').nullable().comment('最后发现时间');
    table.timestamp('last_test_at').nullable().comment('最后测试时间');
    table.text('last_error').nullable().comment('最后错误');

    // 审计字段
    table.uuid('created_by').nullable().comment('创建人');
    table.uuid('updated_by').nullable().comment('更新人');
    table.timestamps(true, true);

    // 索引
    table.index(['transport_type', 'enabled']);
    table.index(['connected']);
    table.index(['created_by']);
  });

  // 6. 流程模式定义表
  await knex.schema.createTable('pipeline_schemas', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('name', 200).notNullable().comment('流程名称');
    table.text('description').comment('流程描述');
    table.json('nodes').notNullable().comment('节点定义JSON');
    table.json('edges').notNullable().comment('边定义JSON');
    table.json('variables').comment('变量定义JSON');
    table.string('category', 50).comment('分类');
    table.json('metadata').comment('元数据JSON');

    // 验证状态
    table.boolean('validated').defaultTo(false).comment('是否已验证');
    table.text('validation_errors').nullable().comment('验证错误信息');
    table.timestamp('validated_at').nullable().comment('验证时间');

    // 版本管理
    table.string('version', 20).defaultTo('1.0.0').comment('版本号');
    table.string('status', 20).defaultTo('draft').comment('状态: draft/published/archived');

    // 审计字段
    table.uuid('created_by').nullable().comment('创建人');
    table.uuid('updated_by').nullable().comment('更新人');
    table.timestamps(true, true);

    // 索引
    table.index(['status', 'validated']);
    table.index(['category']);
    table.index(['created_by']);
  });

  // 7. 提示词版本管理表
  await knex.schema.createTable('prompt_versions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('template_key', 100).notNullable().comment('模板键名');
    table.string('version', 20).notNullable().comment('版本号');
    table.text('template_content').notNullable().comment('模板内容');
    table.json('variables').comment('变量定义JSON');
    table.text('description').comment('版本描述');
    table.string('category', 50).comment('分类');
    table.json('metadata').comment('元数据JSON');
    table.boolean('is_current').defaultTo(false).comment('是否为当前版本');

    // 状态管理
    table.string('status', 20).defaultTo('draft').comment('状态: draft/published/archived');
    table.timestamp('published_at').nullable().comment('发布时间');

    // 审计字段
    table.uuid('created_by').nullable().comment('创建人');
    table.timestamps(true, true);

    // 索引
    table.index(['template_key', 'version']);
    table.index(['template_key', 'is_current']);
    table.index(['status']);
    table.index(['created_by']);
    table.unique(['template_key', 'version']);
  });

  console.log('CMS系统表结构创建完成');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('prompt_versions');
  await knex.schema.dropTableIfExists('pipeline_schemas');
  await knex.schema.dropTableIfExists('mcp_endpoints');
  await knex.schema.dropTableIfExists('provider_secrets');
  await knex.schema.dropTableIfExists('provider_endpoints');
  await knex.schema.dropTableIfExists('config_snapshots');
  await knex.schema.dropTableIfExists('features');

  console.log('CMS系统表结构删除完成');
};