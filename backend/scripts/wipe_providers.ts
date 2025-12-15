
import knex from 'knex';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function wipeAllProviders() {
    const dbConfig = {
        client: 'mysql2',
        connection: {
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'ai_photo_generating',
            charset: 'utf8mb4',
        },
        pool: { min: 0, max: 7 }
    };

    console.log(`[Wipe] Connecting to database ${dbConfig.connection.host}:${dbConfig.connection.port}/${dbConfig.connection.database}...`);

    const db = knex(dbConfig);

    try {
        // Delete all providers
        const count = await db('provider_endpoints').del();
        console.log(`[Wipe] Deleted ${count} provider records. Table should be empty now.`);

    } catch (error) {
        console.error('[Wipe] Error during wipe:', error);
    } finally {
        await db.destroy();
    }
}

wipeAllProviders();
