import knex from 'knex';
import knexConfig, { type Environment as KnexEnvironment } from './knex-config.js';

const environment = (process.env.NODE_ENV ?? 'development') as KnexEnvironment;
const config = knexConfig[environment] ?? knexConfig.development;

export const db = knex(config);

export type Database = typeof db;
