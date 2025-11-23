
import 'dotenv/config';
import knex from 'knex';
import { knexConfig } from '../src/config/knex-config';

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error('Please provide an email');
        process.exit(1);
    }

    const environment = (process.env.NODE_ENV ?? 'development') as keyof typeof knexConfig;
    const config = knexConfig[environment];
    const db = knex(config);

    try {
        console.log(`Checking user ${email} in ${environment} mode...`);
        const user = await db('users')
            .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
            .first();

        if (user) {
            console.log('User found:', JSON.stringify(user, null, 2));
        } else {
            console.error(`User ${email} not found.`);
        }
    } catch (error) {
        console.error('Error checking user:', error);
    } finally {
        await db.destroy();
    }
}

main();
