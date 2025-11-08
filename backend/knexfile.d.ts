import 'dotenv/config';
import type { Knex } from 'knex';
type Environment = 'development' | 'test' | 'production';
declare const config: Record<Environment, Knex.Config>;
export default config;
export type { Environment as KnexEnvironment };
//# sourceMappingURL=knexfile.d.ts.map