/**
 * 创建API限流配置表
 */
exports.up = async function (knex) {
  await knex.schema.createTable('rate_limit_configs', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('path_pattern', 200).notNullable().comment('路径模式，支持通配符');
    table.string('method', 10).defaultTo('*').comment('HTTP方法，*表示所有');
    table.integer('window_seconds').notNullable().defaultTo(60).comment('时间窗口(秒)');
    table.integer('max_requests').notNullable().defaultTo(100).comment('最大请求数');
    table.enum('scope', ['global', 'ip', 'user', 'api_key']).defaultTo('ip').comment('限流范围');
    table.boolean('is_active').defaultTo(true);
    table.text('whitelist_ips').comment('白名单IP，JSON数组');
    table.text('whitelist_users').comment('白名单用户ID，JSON数组');
    table.string('error_message', 500).defaultTo('请求过于频繁，请稍后再试');
    table.integer('priority').defaultTo(0).comment('优先级，高优先');
    table.timestamps(true, true);
    table.index(['is_active', 'priority']);
  });

  // 插入默认配置
  await knex('rate_limit_configs').insert([
    {
      name: '全局默认',
      path_pattern: '/*',
      window_seconds: 60,
      max_requests: 100,
      scope: 'ip',
      priority: 0
    },
    {
      name: '登录接口',
      path_pattern: '/api/auth/login',
      window_seconds: 300,
      max_requests: 5,
      scope: 'ip',
      priority: 10
    },
    {
      name: 'AI接口',
      path_pattern: '/api/*/ai-*',
      window_seconds: 60,
      max_requests: 10,
      scope: 'user',
      priority: 10
    }
  ]);

  console.log('[Migration] API限流配置表创建完成');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('rate_limit_configs');
};
