/**
 * Feature Catalog服务单元测试
 */

const featureCatalogService = require('../../src/services/feature-catalog.service');

describe('FeatureCatalogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createFeature', () => {
    it('应该成功创建功能配置', async () => {
      // 准备测试数据
      const featureData = {
        name: '测试功能',
        key: 'test-feature',
        description: '这是一个测试功能',
        category: 'test',
        config: { setting1: 'value1' },
        enabled: true
      };

      const createdBy = 'user-123';

      // 模拟数据库操作
      const mockKnex = require('../../db/connection').knex;
      const mockTransaction = jest.fn().mockImplementation((callback) => {
        return callback({
          insert: jest.fn().mockResolvedValue(),
          where: jest.fn().mockReturnThis(),
          update: jest.fn().mockResolvedValue()
        });
      });

      mockKnex.transaction = mockTransaction;

      // 模拟缓存失效
      const mockConfigCache = require('../../cache/config-cache');
      mockConfigCache.invalidate = jest.fn().mockResolvedValue();

      // 执行测试
      const result = await featureCatalogService.createFeature(featureData, createdBy);

      // 验证结果
      expect(result).toBeDefined();
      expect(result.name).toBe(featureData.name);
      expect(result.key).toBe(featureData.key);
      expect(result.status).toBe('draft');
      expect(result.version).toBe('1.0.0');
      expect(result.createdBy).toBe(createdBy);
      expect(result.updatedBy).toBe(createdBy);

      // 验证数据库调用
      expect(mockKnex.transaction).toHaveBeenCalled();
      expect(mockConfigCache.invalidate).toHaveBeenCalled();
    });

    it('应该拒绝无效的功能数据', async () => {
      const invalidFeatureData = {
        // 缺少必需的name字段
        key: 'test-feature',
        description: '无效的功能'
      };

      const createdBy = 'user-123';

      // 执行测试并期望抛出错误
      await expect(featureCatalogService.createFeature(invalidFeatureData, createdBy))
        .rejects.toThrow();
    });
  });

  describe('getFeature', () => {
    it('应该成功获取功能配置', async () => {
      const featureId = 'feature-123';
      const mockFeature = {
        id: featureId,
        name: '测试功能',
        key: 'test-feature',
        description: '测试描述',
        status: 'published',
        version: '1.0.0'
      };

      // 模拟缓存服务
      const mockConfigCache = require('../../cache/config-cache');
      mockConfigCache.getOrSet = jest.fn().mockImplementation(async (options, fetcher) => {
        return fetcher();
      });

      // 模拟数据库查询
      const mockKnex = require('../../db/connection').knex;
      mockKnex.where = jest.fn().mockReturnThis();
      mockKnex.first = jest.fn().mockResolvedValue(mockFeature);

      // 执行测试
      const result = await featureCatalogService.getFeature(featureId);

      // 验证结果
      expect(result).toEqual(mockFeature);
      expect(mockKnex.where).toHaveBeenCalledWith('id', featureId);
      expect(mockKnex.first).toHaveBeenCalled();
    });

    it('应该处理不存在的功能', async () => {
      const featureId = 'nonexistent-feature';

      // 模拟缓存服务
      const mockConfigCache = require('../../cache/config-cache');
      mockConfigCache.getOrSet = jest.fn().mockImplementation(async (options, fetcher) => {
        return fetcher();
      });

      // 模拟数据库查询返回null
      const mockKnex = require('../../db/connection').knex;
      mockKnex.where = jest.fn().mockReturnThis();
      mockKnex.first = jest.fn().mockResolvedValue(null);

      // 执行测试
      const result = await featureCatalogService.getFeature(featureId);

      // 验证结果
      expect(result).toBeNull();
    });
  });

  describe('publishFeature', () => {
    it('应该成功发布功能', async () => {
      const featureId = 'feature-123';
      const publishedBy = 'user-123';
      const mockFeature = {
        id: featureId,
        name: '测试功能',
        status: 'draft',
        version: '1.0.0'
      };

      // 模拟getFeature方法
      jest.spyOn(featureCatalogService, 'getFeature').mockResolvedValue(mockFeature);

      // 模拟数据库事务
      const mockKnex = require('../../db/connection').knex;
      const mockTransaction = jest.fn().mockImplementation((callback) => {
        return callback({
          where: jest.fn().mockReturnThis(),
          update: jest.fn().mockResolvedValue()
        });
      });
      mockKnex.transaction = mockTransaction;

      // 模拟缓存失效
      const mockConfigCache = require('../../cache/config-cache');
      mockConfigCache.invalidate = jest.fn().mockResolvedValue();

      // 执行测试
      const result = await featureCatalogService.publishFeature(featureId, publishedBy);

      // 验证结果
      expect(result).toBe(true);
      expect(mockKnex.transaction).toHaveBeenCalled();
      expect(mockConfigCache.invalidate).toHaveBeenCalled();
    });

    it('应该处理不存在功能的情况', async () => {
      const featureId = 'nonexistent-feature';
      const publishedBy = 'user-123';

      // 模拟getFeature返回null
      jest.spyOn(featureCatalogService, 'getFeature').mockResolvedValue(null);

      // 执行测试并期望抛出错误
      await expect(featureCatalogService.publishFeature(featureId, publishedBy))
        .rejects.toThrow('功能配置不存在');
    });

    it('应该处理已经发布的功能', async () => {
      const featureId = 'feature-123';
      const publishedBy = 'user-123';
      const mockFeature = {
        id: featureId,
        name: '测试功能',
        status: 'published',
        version: '1.0.0'
      };

      // 模拟getFeature返回已发布的功能
      jest.spyOn(featureCatalogService, 'getFeature').mockResolvedValue(mockFeature);

      // 执行测试
      const result = await featureCatalogService.publishFeature(featureId, publishedBy);

      // 验证结果 - 应该返回true但不执行任何操作
      expect(result).toBe(true);
    });
  });

  describe('getFeatures', () => {
    it('应该返回功能列表', async () => {
      const mockFeatures = [
        { id: '1', name: '功能1', status: 'published' },
        { id: '2', name: '功能2', status: 'draft' }
      ];

      // 模拟缓存服务
      const mockConfigCache = require('../../cache/config-cache');
      mockConfigCache.getOrSet = jest.fn().mockImplementation(async (options, fetcher) => {
        return fetcher();
      });

      // 模拟数据库查询
      const mockKnex = require('../../db/connection').knex;
      mockKnex.select = jest.fn().mockReturnThis();
      mockKnex.where = jest.fn().mockReturnThis();
      mockKnex.orderBy = jest.fn().mockReturnThis();
      mockKnex.limit = jest.fn().mockReturnThis();
      mockKnex.offset = jest.fn().mockResolvedValue(mockFeatures);
      mockKnex.clone = jest.fn().mockReturnThis();
      mockKnex.clearSelect = jest.fn().mockReturnThis();
      mockKnex.count = jest.fn().mockResolvedValue([{ count: '2' }]);

      // 执行测试
      const result = await featureCatalogService.getFeatures();

      // 验证结果
      expect(result.features).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockKnex.select).toHaveBeenCalled();
    });

    it('应该应用过滤条件', async () => {
      const filters = {
        status: 'published',
        category: 'test',
        page: 1,
        limit: 10
      };

      // 模拟缓存服务
      const mockConfigCache = require('../../cache/config-cache');
      mockConfigCache.getOrSet = jest.fn().mockImplementation(async (options, fetcher) => {
        return fetcher();
      });

      // 模拟数据库查询
      const mockKnex = require('../../db/connection').knex;
      mockKnex.select = jest.fn().mockReturnThis();
      mockKnex.where = jest.fn().mockReturnThis();
      mockKnex.orderBy = jest.fn().mockReturnThis();
      mockKnex.limit = jest.fn().mockReturnThis();
      mockKnex.offset = jest.fn().mockResolvedValue([]);
      mockKnex.clone = jest.fn().mockReturnThis();
      mockKnex.clearSelect = jest.fn().mockReturnThis();
      mockKnex.count = jest.fn().mockResolvedValue([{ count: '0' }]);

      // 执行测试
      const result = await featureCatalogService.getFeatures(filters);

      // 验证过滤条件被应用
      expect(mockKnex.where).toHaveBeenCalledWith('status', 'published');
      expect(mockKnex.where).toHaveBeenCalledWith('category', 'test');
      expect(mockKnex.limit).toHaveBeenCalledWith(10);
      expect(mockKnex.offset).toHaveBeenCalledWith(0);
    });
  });

  describe('getVisibleFeatures', () => {
    it('应该返回用户可见的功能', async () => {
      const userId = 'user-123';
      const userRole = 'viewer';
      const mockFeatures = [
        { id: '1', name: '基础功能1', enabled: true, status: 'published' },
        { id: '2', name: '基础功能2', enabled: true, status: 'published' }
      ];

      // 模拟缓存服务
      const mockConfigCache = require('../../cache/config-cache');
      mockConfigCache.getOrSet = jest.fn().mockImplementation(async (options, fetcher) => {
        return fetcher();
      });

      // 模拟数据库查询
      const mockKnex = require('../../db/connection').knex;
      mockKnex.where = jest.fn().mockReturnThis();
      mockKnex.orderBy = jest.fn().mockResolvedValue(mockFeatures);

      // 模拟canAccessFeature方法
      jest.spyOn(featureCatalogService, 'canAccessFeature').mockReturnValue(true);

      // 执行测试
      const result = await featureCatalogService.getVisibleFeatures(userId, userRole);

      // 验证结果
      expect(result).toHaveLength(2);
      expect(mockKnex.where).toHaveBeenCalledWith('enabled', true);
      expect(mockKnex.where).toHaveBeenCalledWith('status', 'published');
    });
  });

  describe('deleteFeature', () => {
    it('应该成功删除草稿状态的功能', async () => {
      const featureId = 'feature-123';
      const deletedBy = 'user-123';
      const mockFeature = {
        id: featureId,
        name: '测试功能',
        status: 'draft',
        version: '1.0.0'
      };

      // 模拟getFeature方法
      jest.spyOn(featureCatalogService, 'getFeature').mockResolvedValue(mockFeature);

      // 模拟数据库事务
      const mockKnex = require('../../db/connection').knex;
      const mockTransaction = jest.fn().mockImplementation((callback) => {
        return callback({
          insert: jest.fn().mockResolvedValue(),
          where: jest.fn().mockReturnThis(),
          update: jest.fn().mockResolvedValue()
        });
      });
      mockKnex.transaction = mockTransaction;

      // 模拟缓存失效
      const mockConfigCache = require('../../cache/config-cache');
      mockConfigCache.invalidate = jest.fn().mockResolvedValue();

      // 执行测试
      const result = await featureCatalogService.deleteFeature(featureId, deletedBy);

      // 验证结果
      expect(result).toBe(true);
      expect(mockKnex.transaction).toHaveBeenCalled();
      expect(mockConfigCache.invalidate).toHaveBeenCalled();
    });

    it('应该拒绝删除已发布的功能', async () => {
      const featureId = 'feature-123';
      const deletedBy = 'user-123';
      const mockFeature = {
        id: featureId,
        name: '测试功能',
        status: 'published',
        version: '1.0.0'
      };

      // 模拟getFeature返回已发布的功能
      jest.spyOn(featureCatalogService, 'getFeature').mockResolvedValue(mockFeature);

      // 执行测试并期望抛出错误
      await expect(featureCatalogService.deleteFeature(featureId, deletedBy))
        .rejects.toThrow('已发布的功能配置不能直接删除，请先回滚或归档');
    });
  });

  describe('getStats', () => {
    it('应该返回统计信息', async () => {
      const mockStatusStats = [
        { status: 'published', count: '5' },
        { status: 'draft', count: '3' }
      ];
      const mockCategoryStats = [
        { category: 'image', count: '4' },
        { category: 'text', count: '2' }
      ];
      const mockTotal = [{ total: '8' }];

      // 模拟数据库查询
      const mockKnex = require('../../db/connection').knex;
      mockKnex.select = jest.fn().mockReturnThis();
      mockKnex.groupBy = jest.fn().mockReturnThis();
      mockKnex.count = jest.fn().mockReturnThis();

      // 模拟Promise.all
      const mockPromiseAll = Promise.all = jest.fn().mockResolvedValue([
        mockStatusStats,
        mockCategoryStats,
        mockTotal
      ]);

      // 执行测试
      const result = await featureCatalogService.getStats();

      // 验证结果
      expect(result.total).toBe(8);
      expect(result.byStatus).toEqual({
        published: 5,
        draft: 3
      });
      expect(result.byCategory).toEqual({
        image: 4,
        text: 2
      });
    });
  });
});