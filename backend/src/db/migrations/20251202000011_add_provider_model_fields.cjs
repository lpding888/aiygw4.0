/**
 * 为 provider_endpoints 表新增模型相关字段
 */

const TABLE_NAME = 'provider_endpoints';

exports.up = async function (knex) {
  const exists = await knex.schema.hasTable(TABLE_NAME);
  if (!exists) {
    console.log(`⚠️  ${TABLE_NAME} 表不存在，跳过模型字段迁移`);
    return;
  }

  const hasDefaultModel = await knex.schema.hasColumn(TABLE_NAME, 'default_model');
  const hasModelCatalog = await knex.schema.hasColumn(TABLE_NAME, 'model_catalog');

  if (!hasDefaultModel || !hasModelCatalog) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      if (!hasDefaultModel) {
        table.string('default_model', 200).nullable().comment('默认使用的模型');
      }
      if (!hasModelCatalog) {
        table
          .json('model_catalog')
          .nullable()
          .comment('最近一次健康检查或解析得到的模型列表');
      }
    });
    console.log('✓ provider_endpoints 表已添加模型字段');
  } else {
    console.log('✓ provider_endpoints 表已存在模型字段，跳过');
  }
};

exports.down = async function (knex) {
  const exists = await knex.schema.hasTable(TABLE_NAME);
  if (!exists) {
    return;
  }

  const hasDefaultModel = await knex.schema.hasColumn(TABLE_NAME, 'default_model');
  const hasModelCatalog = await knex.schema.hasColumn(TABLE_NAME, 'model_catalog');

  if (hasDefaultModel || hasModelCatalog) {
    await knex.schema.alterTable(TABLE_NAME, (table) => {
      if (hasDefaultModel) {
        table.dropColumn('default_model');
      }
      if (hasModelCatalog) {
        table.dropColumn('model_catalog');
      }
    });
    console.log('✓ provider_endpoints 表模型字段已回滚');
  }
};
