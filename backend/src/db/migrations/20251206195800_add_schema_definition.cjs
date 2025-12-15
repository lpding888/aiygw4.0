
exports.up = function (knex) {
    return knex.schema.table('pipeline_schemas', function (table) {
        table.text('schema_definition').nullable().comment('V1 Protocol Definition (JSON)');
    });
};

exports.down = function (knex) {
    return knex.schema.table('pipeline_schemas', function (table) {
        table.dropColumn('schema_definition');
    });
};
