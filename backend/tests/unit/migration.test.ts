// 艹！直接导入knexfile.ts而不是编译后的.js，让ts-jest处理
import knexConfig from '../../knexfile.ts';

// 🟢 已修复：改用TS源文件导入，避免Jest处理编译后的ESM
describe('Knex configuration', () => {
  it('defines development, test, and production environments', () => {
    expect(knexConfig.development).toBeDefined();
    expect(knexConfig.test).toBeDefined();
    expect(knexConfig.production).toBeDefined();
  });

  it('each environment exposes client, connection, and migrations directory', () => {
    for (const [env, config] of Object.entries(knexConfig)) {
      expect((config as any).client).toBeTruthy();
      expect((config as any).connection).toBeTruthy();
      expect((config as any).migrations).toBeTruthy();
      expect((config as any).migrations.directory).toContain('migrations');
    }
  });
});
