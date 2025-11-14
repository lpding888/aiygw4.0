/**
 * 创建 Casbin 策略表
 */

export async function up(knex) {
  const exists = await knex.schema.hasTable('casbin_rule');
  if (exists) return;

  await knex.schema.createTable('casbin_rule', (table) => {
    table.increments('id').primary();
    table.string('ptype', 32).notNullable().index();
    table.string('v0', 255).nullable().index();
    table.string('v1', 255).nullable().index();
    table.string('v2', 255).nullable();
    table.string('v3', 255).nullable();
    table.string('v4', 255).nullable();
    table.string('v5', 255).nullable();
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  const exists = await knex.schema.hasTable('casbin_rule');
  if (!exists) return;
  await knex.schema.dropTable('casbin_rule');
}
