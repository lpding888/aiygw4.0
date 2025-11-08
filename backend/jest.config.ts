import { pathsToModuleNameMapper } from 'ts-jest';
import type { Config } from 'jest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const tsConfig = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'tsconfig.json'), 'utf-8')
) as {
  compilerOptions?: {
    paths?: Record<string, string[]>;
  };
};

const config: Config = {
  testEnvironment: 'node',
  preset: 'ts-jest/presets/default-esm',
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: './tsconfig.json',
        diagnostics: false
      }
    ]
  },
  moduleNameMapper: {
    ...(tsConfig.compilerOptions?.paths
      ? pathsToModuleNameMapper(tsConfig.compilerOptions.paths, { prefix: '<rootDir>/' })
      : {}),
    // Map ESM-style .js imports in src to their TS sources for ts-jest
    '^<rootDir>/src/(.*)\\.js$': '<rootDir>/src/$1.ts'
  },
  extensionsToTreatAsEsm: ['.ts'],
  resolver: '<rootDir>/jest.resolver.cjs',
  testMatch: ['**/tests/**/*.test.(ts|js)'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx,js}', '!src/server.ts'],
  coverageDirectory: 'coverage',
  // 艹！必须让 Jest transform uuid 和 nanoid 这些纯ESM包！
  transformIgnorePatterns: ['node_modules/(?!(uuid|nanoid)/)']
};

export default config;
