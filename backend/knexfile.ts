import 'dotenv/config';
import knexConfig, { type Environment as KnexEnvironment } from './src/config/knex-config.js';

export default knexConfig;
export type { KnexEnvironment };
