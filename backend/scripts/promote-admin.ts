import 'dotenv/config';
import knex from 'knex';
import { knexConfig } from '../src/config/knex-config.js';

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Please provide a user ID');
    process.exit(1);
  }

  const environment = (process.env.NODE_ENV ?? 'development') as keyof typeof knexConfig;
  const config = knexConfig[environment];
  const db = knex(config);

  try {
    console.log(`Connecting to database in ${String(environment)} mode...`);
    const affected = await db('users').where({ id: userId }).update({ role: 'admin' });

    if (affected) {
      console.log(`User ${userId} promoted to admin successfully.`);
    } else {
      console.error(`User ${userId} not found.`);
    }
  } catch (error) {
    console.error('Error promoting user:', error);
  } finally {
    await db.destroy();
  }
}

main();
