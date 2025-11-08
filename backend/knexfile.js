import 'dotenv/config';
const parseIntWithFallback = (value, fallback) => {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};
const baseConnection = {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseIntWithFallback(process.env.DB_PORT, 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD,
    charset: 'utf8mb4'
};
const config = {
    development: {
        client: 'mysql2',
        connection: {
            ...baseConnection,
            database: process.env.DB_NAME ?? 'ai_photo'
        },
        pool: {
            min: parseIntWithFallback(process.env.DATABASE_POOL_MIN, 2),
            max: parseIntWithFallback(process.env.DATABASE_POOL_MAX, 10),
            acquireTimeoutMillis: 60_000,
            createTimeoutMillis: 30_000,
            destroyTimeoutMillis: 5_000,
            idleTimeoutMillis: 30_000,
            reapIntervalMillis: 1_000,
            createRetryIntervalMillis: 200,
            propagateCreateError: false
        },
        migrations: {
            directory: './src/db/migrations',
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: './src/db/seeds'
        }
    },
    test: {
        client: 'mysql2',
        connection: {
            ...baseConnection,
            database: 'test_ai_photo'
        },
        pool: {
            min: 2,
            max: 5
        },
        migrations: {
            directory: './src/db/migrations',
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: './src/db/seeds'
        }
    },
    production: {
        client: 'mysql2',
        connection: {
            ...baseConnection,
            database: process.env.DB_NAME ?? 'ai_photo'
        },
        pool: {
            min: parseIntWithFallback(process.env.DATABASE_POOL_MIN, 5),
            max: parseIntWithFallback(process.env.DATABASE_POOL_MAX, 20),
            acquireTimeoutMillis: 60_000,
            createTimeoutMillis: 30_000,
            destroyTimeoutMillis: 5_000,
            idleTimeoutMillis: 300_000,
            reapIntervalMillis: 1_000,
            createRetryIntervalMillis: 100,
            propagateCreateError: false
        },
        migrations: {
            directory: './src/db/migrations',
            tableName: 'knex_migrations'
        }
    }
};
export default config;
//# sourceMappingURL=knexfile.js.map