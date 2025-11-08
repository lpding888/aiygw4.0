import baseConfig from './jest.config.ts';
import type { Config } from 'jest';

const config: Config = {
  ...baseConfig,
  displayName: 'unit',
  testMatch: ['**/tests/unit/**/*.test.(ts|js)'],
  // 艹！必须加载setup.ts，里面有Redis、Logger、tencentcloud SDK的Mock！
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/server.ts', '!src/config/database.ts']
};

export default config;
