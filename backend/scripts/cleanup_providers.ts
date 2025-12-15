
import knex from 'knex';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function cleanupProviders() {
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

    console.log(`[Cleanup] Connecting to database ${dbConfig.connection.host}:${dbConfig.connection.port}/${dbConfig.connection.database}...`);

    const db = knex(dbConfig);

    try {
        // Define patterns to delete
        const patterns = [
            'internal_scf_%',
            'ai_gen_%',
            'invalid_%'
        ];

        // Delete providers matching patterns
        for (const pattern of patterns) {
            const count = await db('provider_endpoints')
                .where('provider_ref', 'like', pattern)
                .del();
            console.log(`[Cleanup] Deleted ${count} records matching '${pattern}'`);
        }

        // Also delete specific junk refs if they exist
        const specificRefs = ['invalid-input', 'chrome-devtools'];
        const countSpecific = await db('provider_endpoints')
            .whereIn('provider_ref', specificRefs)
            .del();
        console.log(`[Cleanup] Deleted ${countSpecific} specific junk records`);

        console.log('[Cleanup] Cleanup completed successfully.');
    } catch (error) {
        console.error('[Cleanup] Error during cleanup:', error);
    } finally {
        await db.destroy();
    }
}

cleanupProviders();
