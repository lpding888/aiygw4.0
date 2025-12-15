/**
 * 为 provider_endpoints 添加 capabilities 列
 * 存储模型能力信息（tool_use, vision, streaming 等）
 */

exports.up = function (knex) {
    return knex.schema.alterTable('provider_endpoints', (table) => {
        table.json('capabilities').nullable().comment('模型能力声明(tool_use, vision, streaming, json_mode, max_context等)');
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('provider_endpoints', (table) => {
        table.dropColumn('capabilities');
    });
};
