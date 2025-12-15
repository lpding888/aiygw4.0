
exports.up = function (knex) {
  return knex.schema.alterTable('provider_endpoints', (table) => {
    table.json('config').nullable().comment('Provider扩展配置(GenericHttpProvider模板等)');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('provider_endpoints', (table) => {
    table.dropColumn('config');
  });
};
