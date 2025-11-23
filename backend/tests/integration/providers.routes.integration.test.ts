/**
 * Provider管理API集成测试 - 简化版
 * 艹！测试Provider管理HTTP接口的正确性，使用mock数据避免数据库依赖！
 *
 * 注意：这个测试主要验证HTTP路由层面的功能，不涉及真实数据库操作
 */

import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';

// Mock provider repository
jest.mock('../../src/repositories/providerEndpoints.repo.js', () => ({
  listProviderEndpoints: jest.fn(),
  getProviderEndpoint: jest.fn(),
  updateProviderEndpoint: jest.fn(),
  providerEndpointExists: jest.fn()
}));

// Mock provider-registry service
jest.mock('../../src/services/provider-registry.service.js', () => ({
  default: {
    healthCheck: jest.fn(),
    getRegisteredProviders: jest.fn()
  }
}));

import * as providerRepo from '../../src/repositories/providerEndpoints.repo.js';
import providerRegistryService from '../../src/services/provider-registry.service.js';
import providersRoutes from '../../src/routes/providers.routes.js';

// 创建轻量级测试app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  // Mock认证中间件（模拟已登录的管理员）
  app.use((req: Request & { user?: any; id?: string }, _res: Response, next: NextFunction) => {
    req.user = { id: 'test-admin-user', role: 'admin' };
    req.id = 'test-request-id-' + Date.now();
    next();
  });

  // 只加载providers路由
  app.use('/api/providers', providersRoutes);

  // 错误处理中间件
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || '服务器内部错误'
      }
    });
  });

  return app;
}

describe('Provider管理API集成测试', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // 艹！重新设置 provider-registry service 的 mock，确保每个测试都有干净的 mock 状态
    if (providerRegistryService && typeof providerRegistryService === 'object') {
      (providerRegistryService as any).healthCheck = jest.fn();
      (providerRegistryService as any).getRegisteredProviders = jest.fn();
    }
  });

  describe('PUT /api/providers/:provider_ref/credentials - 更新Provider凭证', () => {
    it('应该成功更新Provider的API Key', async () => {
      const testProviderRef = 'test-provider';
      const mockUpdatedProvider = {
        provider_ref: testProviderRef,
        provider_name: '测试Provider',
        updated_at: new Date()
      };

      (providerRepo.updateProviderEndpoint as jest.Mock).mockResolvedValue(mockUpdatedProvider);

      const response = await request(app)
        .put(`/api/providers/${testProviderRef}/credentials`)
        .send({ credentials: 'new-secret-api-key-12345' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.provider_ref).toBe(testProviderRef);
      expect(response.body.data.provider_name).toBe('测试Provider');
      expect(response.body.message).toBe('Provider凭证已更新');
      expect(response.body.data.credentials).toBeUndefined();
    });

    it('凭证为空时应该返回400错误', async () => {
      const response = await request(app)
        .put('/api/providers/test-provider/credentials')
        .send({ credentials: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('凭证不能为空');
    });

    it('凭证为空格时应该返回400错误', async () => {
      const response = await request(app)
        .put('/api/providers/test-provider/credentials')
        .send({ credentials: '   ' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('缺少credentials字段时应该返回400错误', async () => {
      const response = await request(app)
        .put('/api/providers/test-provider/credentials')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('更新不存在的Provider时应该返回404错误', async () => {
      (providerRepo.updateProviderEndpoint as jest.Mock).mockRejectedValue(
        new Error('Provider端点不存在: non-existent')
      );

      const response = await request(app)
        .put('/api/providers/non-existent/credentials')
        .send({ credentials: 'test-key' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('不存在');
    });
  });

  describe('GET /api/providers/health - 获取Provider健康状态', () => {
    it('应该成功返回Provider健康状态', async () => {
      const mockHealthData = {
        status: 'healthy' as const,
        totalProviders: 5,
        healthyProviders: 4,
        unhealthyProviders: 1,
        checkedAt: new Date().toISOString()
      };

      const mockRegisteredProviders = [
        { provider_ref: 'openai', provider_name: 'OpenAI', healthy: true },
        { provider_ref: 'claude', provider_name: 'Claude', healthy: true }
      ];

      (providerRegistryService.healthCheck as jest.Mock).mockResolvedValue(mockHealthData);
      (providerRegistryService.getRegisteredProviders as jest.Mock).mockReturnValue(mockRegisteredProviders);

      const response = await request(app)
        .get('/api/providers/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.totalProviders).toBe(5);
      expect(response.body.data.healthyProviders).toBe(4);
      expect(response.body.data.unhealthyProviders).toBe(1);
      expect(Array.isArray(response.body.data.registeredProviders)).toBe(true);
      expect(response.body.data.registeredProviders.length).toBe(2);
    });
  });

  describe('GET /api/providers - 获取Provider列表', () => {
    it('应该成功获取Provider列表', async () => {
      const mockProviders = [
        {
          provider_ref: 'test-001',
          provider_name: '测试Provider1',
          endpoint_url: 'https://api1.test.com',
          auth_type: 'api_key'
        },
        {
          provider_ref: 'test-002',
          provider_name: '测试Provider2',
          endpoint_url: 'https://api2.test.com',
          auth_type: 'bearer'
        }
      ];

      (providerRepo.listProviderEndpoints as jest.Mock)
        .mockResolvedValueOnce(mockProviders) // 第一次调用返回数据
        .mockResolvedValueOnce(mockProviders); // 第二次调用返回总数

      const response = await request(app)
        .get('/api/providers')
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeDefined();
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.limit).toBe(10);
      expect(response.body.data.offset).toBe(0);
    });

    it('应该支持auth_type过滤', async () => {
      const mockProviders = [
        {
          provider_ref: 'test-001',
          provider_name: '测试Provider1',
          auth_type: 'api_key'
        }
      ];

      (providerRepo.listProviderEndpoints as jest.Mock)
        .mockResolvedValueOnce(mockProviders)
        .mockResolvedValueOnce(mockProviders);

      const response = await request(app)
        .get('/api/providers')
        .query({ auth_type: 'api_key' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(providerRepo.listProviderEndpoints).toHaveBeenCalledWith(
        expect.objectContaining({ authType: 'api_key' })
      );
    });
  });

  describe('GET /api/providers/:provider_ref - 获取单个Provider', () => {
    it('应该成功获取单个Provider详情', async () => {
      const mockProvider = {
        provider_ref: 'test-provider',
        provider_name: '测试Provider',
        endpoint_url: 'https://api.test.com',
        auth_type: 'api_key'
      };

      (providerRepo.getProviderEndpoint as jest.Mock).mockResolvedValue(mockProvider);

      const response = await request(app)
        .get('/api/providers/test-provider')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.provider_ref).toBe('test-provider');
      expect(response.body.data.provider_name).toBe('测试Provider');
    });

    it('获取不存在的Provider应该返回404', async () => {
      (providerRepo.getProviderEndpoint as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/providers/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
