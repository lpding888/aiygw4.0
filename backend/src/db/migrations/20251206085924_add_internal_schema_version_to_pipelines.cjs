
exports.up = function (knex) {
    return knex.schema.table('pipeline_schemas', function (table) {
        table.integer('schema_version').defaultTo(0).notNullable().comment('Internal Schema Version: 0=Legacy, 1=V1(Enterprise)');
        table.index(['schema_version']);
    });
};

exports.down = function (knex) {
    return knex.schema.table('pipeline_schemas', function (table) {
        table.dropIndex(['schema_version']);
        table.dropColumn('schema_version');
    });
};
