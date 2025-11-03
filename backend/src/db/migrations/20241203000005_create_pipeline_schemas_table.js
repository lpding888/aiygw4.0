/**
 * 创建流程模板表
 */

exports.up = function(knex) {
  return knex.schema.createTable('pipeline_schemas', function(table) {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('name').notNullable().comment('流程名称');
    table.text('description').comment('流程描述');
    table.string('category').notNullable().comment('流程分类');
    table.string('version').notNullable().defaultTo('1.0.0').comment('版本号');

    // 流程结构定义
    table.json('schema_definition').notNullable().comment('流程结构定义');
    table.json('node_definitions').notNullable().comment('节点定义');
    table.json('edge_definitions').notNullable().comment('边定义');

    // 变量定义
    table.json('input_schema').comment('输入参数结构');
    table.json('output_schema').comment('输出参数结构');
    table.json('variable_mappings').comment('变量映射关系');

    // 校验规则
    table.json('validation_rules').comment('校验规则');
    table.json('constraints').comment('约束条件');

    // 状态和元数据
    table.string('status').defaultTo('draft').comment('状态: draft/active/deprecated');
    table.boolean('is_valid').defaultTo(false).comment('是否通过校验');
    table.text('validation_errors').comment('校验错误信息');

    // 审计字段
    table.integer('created_by').unsigned().comment('创建者ID');
    table.integer('updated_by').unsigned().comment('更新者ID');
    table.timestamps(true, true);

    // 索引
    table.index(['category', 'status']);
    table.index(['version']);
    table.index(['is_valid']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('pipeline_schemas');
};