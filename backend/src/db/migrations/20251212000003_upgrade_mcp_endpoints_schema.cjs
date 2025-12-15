/**
 * 升级 mcp_endpoints 表结构以匹配当前可用的 HTTP MCP 实现。
 *
 * 说明：
 * - 旧表结构来自早期 stdio/http/websocket 版本。
 * - 现阶段只保留 HTTP MCP（/initialize、/tools、/tools/:name/execute）。
 * - 本迁移只“新增字段 + 迁移兼容数据”，不删除旧字段，避免线上历史数据风险。
 */

exports.up = async function (knex) {
  const tableName = 'mcp_endpoints';
  const exists = await knex.schema.hasTable(tableName);
  if (!exists) return;

  const addColumnIfMissing = async (column, addFn) => {
    const hasCol = await knex.schema.hasColumn(tableName, column);
    if (!hasCol) {
      await knex.schema.table(tableName, addFn);
    }
  };

  // 新版字段
  await addColumnIfMissing('endpoint_url', (table) => {
    table.string('endpoint_url', 500).nullable().comment('HTTP MCP Endpoint base URL');
  });
  await addColumnIfMissing('api_key', (table) => {
    table.string('api_key', 64).nullable().comment('Encrypted API key id (KMS)');
  });
  await addColumnIfMissing('protocol_version', (table) => {
    table.string('protocol_version', 32).nullable().comment('MCP protocol version');
  });
  await addColumnIfMissing('capabilities', (table) => {
    table.json('capabilities').nullable().comment('MCP capabilities');
  });
  await addColumnIfMissing('supported_tools', (table) => {
    table.json('supported_tools').nullable().comment('Discovered MCP tools');
  });
  await addColumnIfMissing('healthy', (table) => {
    table.boolean('healthy').defaultTo(false).comment('Endpoint health');
  });
  await addColumnIfMissing('timeout_ms', (table) => {
    table.integer('timeout_ms').nullable().comment('HTTP timeout(ms)');
  });
  await addColumnIfMissing('max_retries', (table) => {
    table.integer('max_retries').nullable().comment('HTTP max retries');
  });
  await addColumnIfMissing('metadata', (table) => {
    table.json('metadata').nullable().comment('Extra metadata');
  });
  await addColumnIfMissing('last_sync_at', (table) => {
    table.timestamp('last_sync_at').nullable().comment('Last tool sync time');
  });
  await addColumnIfMissing('last_error', (table) => {
    table.text('last_error').nullable().comment('Last error message');
  });
  await addColumnIfMissing('updated_by', (table) => {
    table.integer('updated_by').unsigned().nullable().comment('Last updater');
  });

  const now = new Date();

  // 兼容旧数据：endpoint_url / 超时 / 重试 / 工具等
  await knex(tableName)
    .whereNull('endpoint_url')
    .update({
      endpoint_url: knex.raw('connection_string'),
      updated_at: now
    });

  await knex(tableName).whereNull('protocol_version').update({
    protocol_version: '2024-11-05',
    updated_at: now
  });

  await knex(tableName)
    .whereNull('capabilities')
    .update({
      capabilities: JSON.stringify([]),
      updated_at: now
    });

  await knex(tableName)
    .whereNull('supported_tools')
    .update({
      supported_tools: knex.raw('available_tools'),
      updated_at: now
    });

  await knex(tableName)
    .whereNull('timeout_ms')
    .update({
      timeout_ms: knex.raw('timeout'),
      updated_at: now
    });

  await knex(tableName)
    .whereNull('max_retries')
    .update({
      max_retries: knex.raw('retry_count'),
      updated_at: now
    });

  await knex(tableName)
    .whereNull('metadata')
    .update({
      metadata: JSON.stringify({}),
      updated_at: now
    });

  await knex(tableName)
    .whereNull('last_sync_at')
    .update({
      last_sync_at: knex.raw('COALESCE(last_tested_at, last_connected_at)'),
      updated_at: now
    });

  await knex(tableName)
    .whereNull('updated_by')
    .update({
      updated_by: knex.raw('created_by'),
      updated_at: now
    });

  // 旧版 stdio/websocket 端点现阶段无法在 HTTP MCP 中使用，统一下线避免误用
  await knex(tableName).whereNotNull('server_type').whereNot('server_type', 'http').update({
    enabled: false,
    status: 'inactive',
    healthy: false,
    updated_at: now
  });

  // 根据状态初始化 healthy
  await knex(tableName)
    .whereNull('healthy')
    .update({
      healthy: knex.raw("CASE WHEN status='active' THEN 1 ELSE 0 END"),
      updated_at: now
    });
};

exports.down = async function () {
  // 不回滚结构，避免线上回滚带来二次不一致。
};
