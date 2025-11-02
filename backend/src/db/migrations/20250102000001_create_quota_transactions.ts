import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('quota_transactions', (table) => {
    table.string('id', 32).primary();
    table.string('task_id', 32).notNullable().unique();
    table.string('user_id', 32).notNullable();
    table.integer('amount').notNullable();
    table.enum('phase', ['reserved', 'confirmed', 'cancelled']).notNullable();
    table.boolean('idempotent_done').defaultTo(true);
    table.timestamps(true, true);

    table.index('task_id');
    table.index('user_id');
    table.index('phase');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('quota_transactions');
}