/**
 * ConfigCache服务单元测试
 * 艹，这个测试文件覆盖4层缓存架构和Pub/Sub失效广播！
 */

// Mock依赖（必须在import之前）
const mockLRUCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  keys: jest.fn(() => []),
  size: 0,
  max: 1000,
  calculatedSize: 0,
};

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  subscribe: jest.fn(),
  publish: jest.fn(),
};

const mockFS = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdirSync: jest.fn(),
  existsSync: jest.fn(() => true),
};

const mockPath = {
  dirname: jest.fn(() => '/data'),
};

jest.mock('lru-cache', () => {
  return jest.fn(() => mockLRUCache);
});

jest.mock('../../src/utils/redis', () => mockRedis);
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock fs和path
jest.mock('fs', () => ({
  promises: mockFS,
  mkdirSync: mockFS.mkdirSync,
  existsSync: mockFS.existsSync,
}));

jest.mock('path', () => mockPath);

describe('ConfigCacheService', () => {
  let configCacheService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // 重新导入service以确保每次测试都是新实例
    configCacheService = require('../../src/cache/config-cache');
  });

  describe('getOrSet() - 多层缓存回源', () => {
    it('应该从L1 LRU缓存返回数据（缓存命中）', async () => {
      // Arrange
      const mockData = { id: 1, value: 'cached-data' };
      const now = Date.now();

      mockLRUCache.get.mockReturnValue({
        data: mockData,
        version: '1.0.0',
        timestamp: now,
        lruExpiry: now + 30000, // 未过期
        redisExpiry: now + 300000,
      });

      const fetcher = jest.fn();

      // Act
      const result = await configCacheService.getOrSet(
        { scope: 'test', key: 'item1', version: '1.0.0' },
        fetcher
      );

      // Assert
      expect(result).toEqual(mockData);
      expect(mockLRUCache.get).toHaveBeenCalledWith('config:test:item1:1.0.0');
      expect(fetcher).not.toHaveBeenCalled(); // 不应该调用fetcher
    });

    it('应该从L2 Redis缓存返回数据并回填LRU', async () => {
      // Arrange
      const mockData = { id: 2, value: 'redis-data' };
      mockLRUCache.get.mockReturnValue(null); // LRU未命中

      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          data: mockData,
          version: '1.0.0',
          timestamp: Date.now(),
        })
      );

      const fetcher = jest.fn();

      // Act
      const result = await configCacheService.getOrSet(
        { scope: 'test', key: 'item2' },
        fetcher
      );

      // Assert
      expect(result).toEqual(mockData);
      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockLRUCache.set).toHaveBeenCalled(); // 回填LRU
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('应该从L3 快照文件返回数据并回填上层缓存', async () => {
      // Arrange
      const mockData = { id: 3, value: 'snapshot-data' };
      const now = Date.now();

      mockLRUCache.get.mockReturnValue(null); // LRU未命中
      mockRedis.get.mockResolvedValue(null); // Redis未命中

      const mockSnapshot = {
        'test:item3:1.0.0': {
          data: mockData,
          version: '1.0.0',
          timestamp: now,
          expiry: now + 24 * 60 * 60 * 1000, // 未过期
        },
      };

      mockFS.readFile.mockResolvedValue(JSON.stringify(mockSnapshot));

      const fetcher = jest.fn();

      // Act
      const result = await configCacheService.getOrSet(
        { scope: 'test', key: 'item3', useSnapshot: true },
        fetcher
      );

      // Assert
      expect(result).toEqual(mockData);
      expect(mockFS.readFile).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled(); // 回填Redis
      expect(mockLRUCache.set).toHaveBeenCalled(); // 回填LRU
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('应该从L4 DB获取数据并写入所有缓存层', async () => {
      // Arrange
      const mockData = { id: 4, value: 'db-data' };

      mockLRUCache.get.mockReturnValue(null); // LRU未命中
      mockRedis.get.mockResolvedValue(null); // Redis未命中
      mockFS.readFile.mockRejectedValue(new Error('File not found')); // 快照未命中

      const fetcher = jest.fn().mockResolvedValue(mockData);

      // Mock成功写入
      mockFS.writeFile.mockResolvedValue(undefined);
      mockRedis.setex.mockResolvedValue('OK');

      // Act
      const result = await configCacheService.getOrSet(
        { scope: 'test', key: 'item4', useSnapshot: true },
        fetcher
      );

      // Assert
      expect(result).toEqual(mockData);
      expect(fetcher).toHaveBeenCalled(); // 应该调用fetcher
      expect(mockLRUCache.set).toHaveBeenCalled(); // 写入LRU
      expect(mockRedis.setex).toHaveBeenCalled(); // 写入Redis
      expect(mockFS.writeFile).toHaveBeenCalled(); // 写入快照
    });

    it('应该在所有缓存失效时降级到快照', async () => {
      // Arrange
      const mockData = { id: 5, value: 'fallback-data' };
      const now = Date.now();

      mockLRUCache.get.mockReturnValue(null);
      mockRedis.get.mockResolvedValue(null);

      // fetcher抛出错误，模拟DB不可用
      const fetcher = jest.fn().mockRejectedValue(new Error('DB connection failed'));

      // 快照可用
      const mockSnapshot = {
        'test:item5:1.0.0': {
          data: mockData,
          version: '1.0.0',
          timestamp: now,
          expiry: now + 24 * 60 * 60 * 1000,
        },
      };

      mockFS.readFile.mockResolvedValue(JSON.stringify(mockSnapshot));

      // Act
      const result = await configCacheService.getOrSet(
        { scope: 'test', key: 'item5', useSnapshot: true },
        fetcher
      );

      // Assert
      expect(result).toEqual(mockData);
      expect(fetcher).toHaveBeenCalled();
    });

    it('应该在所有缓存和快照都失效时抛出错误', async () => {
      // Arrange
      mockLRUCache.get.mockReturnValue(null);
      mockRedis.get.mockResolvedValue(null);
      mockFS.readFile.mockRejectedValue(new Error('File not found'));

      const dbError = new Error('DB connection failed');
      const fetcher = jest.fn().mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        configCacheService.getOrSet({ scope: 'test', key: 'error' }, fetcher)
      ).rejects.toThrow('DB connection failed');
    });
  });

  describe('invalidate() - 缓存失效', () => {
    it('应该发布失效广播并清除本地缓存', async () => {
      // Arrange
      mockRedis.publish.mockResolvedValue(1);

      // Act
      await configCacheService.invalidate('test', 'item1', '1.0.0');

      // Assert
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'cfg:invalidate',
        expect.stringContaining('"scope":"test"')
      );
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'cfg:invalidate',
        expect.stringContaining('"key":"item1"')
      );
    });

    it('应该在广播失败时仍然失效本地缓存', async () => {
      // Arrange
      mockRedis.publish.mockRejectedValue(new Error('Redis connection lost'));
      mockLRUCache.delete.mockReturnValue(true);

      // Act
      await configCacheService.invalidate('test', 'item1');

      // Assert - 不应该抛出错误
      expect(mockRedis.publish).toHaveBeenCalled();
    });
  });

  describe('getStats() - 缓存统计', () => {
    it('应该返回缓存统计信息', () => {
      // Arrange
      mockLRUCache.size = 50;
      mockLRUCache.calculatedSize = 1024;

      // Act
      const stats = configCacheService.getStats();

      // Assert
      expect(stats).toEqual({
        lru: {
          size: 50,
          maxSize: 1000,
          calculated: 1024,
        },
        snapshotPath: expect.any(String),
        isInitialized: expect.any(Boolean),
      });
    });
  });

  describe('clear() - 清空缓存', () => {
    it('应该清空LRU缓存', async () => {
      // Act
      await configCacheService.clear();

      // Assert
      expect(mockLRUCache.clear).toHaveBeenCalled();
    });
  });

  describe('Redis TTL随机化', () => {
    it('应该设置随机TTL防止缓存雪崩', async () => {
      // Arrange
      const mockData = { id: 6, value: 'test' };

      mockLRUCache.get.mockReturnValue(null);
      mockRedis.get.mockResolvedValue(null);
      mockFS.readFile.mockRejectedValue(new Error('Not found'));
      mockFS.writeFile.mockResolvedValue(undefined);

      const fetcher = jest.fn().mockResolvedValue(mockData);

      // Act
      await configCacheService.getOrSet(
        { scope: 'test', key: 'item6', redisTtl: 300 },
        fetcher
      );

      // Assert
      expect(mockRedis.setex).toHaveBeenCalled();
      const ttl = mockRedis.setex.mock.calls[0][1];

      // TTL应该在240-360之间（300 * 0.8 ~ 300 * 1.2）
      expect(ttl).toBeGreaterThanOrEqual(240);
      expect(ttl).toBeLessThanOrEqual(360);
    });
  });

  describe('快照清理', () => {
    it('应该在保存快照时清理过期快照', async () => {
      // Arrange
      const now = Date.now();
      const mockData = { id: 7, value: 'new-data' };

      mockLRUCache.get.mockReturnValue(null);
      mockRedis.get.mockResolvedValue(null);

      // 模拟已存在的快照，其中一个已过期
      const existingSnapshots = {
        'test:old-item:1.0.0': {
          data: { value: 'old' },
          expiry: now - 1000, // 已过期
        },
        'test:valid-item:1.0.0': {
          data: { value: 'valid' },
          expiry: now + 100000, // 未过期
        },
      };

      mockFS.readFile
        .mockResolvedValueOnce(JSON.stringify(existingSnapshots)) // 第一次读取：getFromSnapshot
        .mockResolvedValueOnce(JSON.stringify(existingSnapshots)); // 第二次读取：saveSnapshot

      mockFS.writeFile.mockResolvedValue(undefined);

      const fetcher = jest.fn().mockResolvedValue(mockData);

      // Act
      await configCacheService.getOrSet(
        { scope: 'test', key: 'new-item', useSnapshot: true },
        fetcher
      );

      // Assert
      expect(mockFS.writeFile).toHaveBeenCalled();
      const savedData = JSON.parse(mockFS.writeFile.mock.calls[0][1]);

      // 过期的快照应该被删除
      expect(savedData['test:old-item:1.0.0']).toBeUndefined();

      // 有效的快照应该保留
      expect(savedData['test:valid-item:1.0.0']).toBeDefined();

      // 新快照应该被添加
      expect(savedData['test:new-item:1.0.0']).toBeDefined();
    });
  });

  describe('缓存键构建', () => {
    it('应该正确构建版本化缓存键', async () => {
      // Arrange
      const mockData = { value: 'test' };
      const now = Date.now();

      mockLRUCache.get.mockReturnValue({
        data: mockData,
        lruExpiry: now + 30000,
      });

      const fetcher = jest.fn();

      // Act
      await configCacheService.getOrSet(
        { scope: 'provider', key: 'endpoint_1', version: '2.5.3' },
        fetcher
      );

      // Assert
      expect(mockLRUCache.get).toHaveBeenCalledWith(
        'config:provider:endpoint_1:2.5.3'
      );
    });
  });
});
