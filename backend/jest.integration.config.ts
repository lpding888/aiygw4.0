import baseConfig from './jest.config.ts';
import type { Config } from 'jest';

const config: Config = {
  ...baseConfig,
  displayName: 'integration',
  testMatch: ['**/tests/integration/**/*.test.(ts|js)'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.integration.ts'],
  testTimeout: 30000
};

export default config;
