/**
 * 基础能力冒烟测试
 * 艹！改用ESM import，不再用复杂的require逻辑！
 *
 * 🟢 已修复：setup.ts Mock了所有SDK，现在可以正常加载模块
 */

// 🟢 现在可以正常运行，setup.ts已经Mock了所有依赖
describe('Basic Smoke Tests', () => {
  it('should load config modules without error', async () => {
    // 艹！用动态import加载模块，避免import.meta的问题
    const dbModule = await import('../../src/config/database.js');
    expect(dbModule.db).toBeDefined();
  });

  it('should load utils modules without error', async () => {
    const redisModule = await import('../../src/utils/redis.js');
    expect(redisModule.RedisManager).toBeDefined();

    const loggerModule = await import('../../src/utils/logger.js');
    const logger = loggerModule.default ?? loggerModule;
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should load cache module without error', async () => {
    const cacheModule = await import('../../src/cache/config-cache.js');
    const cacheService = cacheModule.default ?? cacheModule;
    expect(typeof cacheService.getOrSet).toBe('function');
    expect(typeof cacheService.invalidate).toBe('function');
  });

  it('should load services without error', async () => {
    await expect(import('../../src/services/feature-catalog.service.js')).resolves.toBeDefined();
    await expect(import('../../src/services/security.service.js')).resolves.toBeDefined();
  });

  it('should load routes without error', async () => {
    // 艹！features.routes.js不存在，改成实际存在的providers.routes.ts
    await expect(import('../../src/routes/admin/providers.routes.js')).resolves.toBeDefined();
  });

  it('should load middlewares without error', async () => {
    await expect(import('../../src/middlewares/auth.middleware.js')).resolves.toBeDefined();
  });

  it('should have required test helpers on global scope', () => {
    expect(typeof (global as any).createMockUser).toBe('function');
    expect(typeof (global as any).createMockFeature).toBe('function');
    expect(typeof (global as any).randomString).toBe('function');
  });
});
