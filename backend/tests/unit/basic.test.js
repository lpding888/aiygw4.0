/**
 * 基础功能测试
 */

describe('Basic Functionality Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Connection', () => {
    it('should import database connection', () => {
      // 测试数据库连接模块是否存在
      expect(() => {
        require('../src/db/connection');
      }).not.toThrow();
    });

    it('should have knex function', () => {
      const { knex } = require('../src/db/connection');
      expect(typeof knex).toBe('function');
    });
  });

  describe('Redis Client', () => {
    it('should import redis utilities', () => {
      expect(() => {
        require('../src/utils/redis');
      }).not.toThrow();
    });

    it('should have redis functions', () => {
      const redis = require('../src/utils/redis');
      expect(typeof redis.get).toBe('function');
      expect(typeof redis.set).toBe('function');
      expect(typeof redis.del).toBe('function');
    });
  });

  describe('Cache Service', () => {
    it('should import cache service', () => {
      expect(() => {
        require('../src/cache/config-cache');
      }).not.toThrow();
    });

    it('should have getOrSet method', () => {
      const configCacheService = require('../src/cache/config-cache');
      expect(typeof configCacheService.getOrSet).toBe('function');
      expect(typeof configCacheService.invalidate).toBe('function');
    });
  });

  describe('Logger', () => {
    it('should import logger', () => {
      expect(() => {
        require('../src/utils/logger');
      }).not.toThrow();
    });
  });

  describe('Service Files Existence', () => {
    it('feature-catalog service should exist', () => {
      expect(() => {
        require('../src/services/feature-catalog.service');
      }).not.toThrow();
    });

    it('security service should exist', () => {
      expect(() => {
        require('../src/services/security.service');
      }).not.toThrow();
    });

    it('provider-management service should exist', () => {
      expect(() => {
        require('../src/services/provider-management.service');
      }).not.toThrow();
    });

    it('pipeline-testrunner service should exist', () => {
      expect(() => {
        require('../src/services/pipeline-testrunner.service');
      }).not.toThrow();
    });

    it('pipeline-validator service should exist', () => {
      expect(() => {
        require('../src/services/pipeline-validator.service');
      }).not.toThrow();
    });

    it('mcp-endpoints service should exist', () => {
      expect(() => {
        require('../src/services/mcp-endpoints.service');
      }).not.toThrow();
    });

    it('prompt-template service should exist', () => {
      expect(() => {
        require('../src/services/prompt-template.service');
      }).not.toThrow();
    });

    it('ui-schema service should exist', () => {
      expect(() => {
        require('../src/services/ui-schema.service');
      }).not.toThrow();
    });
  });

  describe('Route Files Existence', () => {
    it('features routes should exist', () => {
      expect(() => {
        require('../src/routes/admin/features.routes');
      }).not.toThrow();
    });

    it('providers routes should exist', () => {
      expect(() => {
        require('../src/routes/admin/providers.routes');
      }).not.toThrow();
    });

    it('mcp-endpoints routes should exist', () => {
      expect(() => {
        require('../src/routes/admin/mcp-endpoints.routes');
      }).not.toThrow();
    });

    it('prompt-templates routes should exist', () => {
      expect(() => {
        require('../src/routes/admin/prompt-templates.routes');
      }).not.toThrow();
    });

    it('security routes should exist', () => {
      expect(() => {
        require('../src/routes/admin/security.routes');
      }).not.toThrow();
    });
  });

  describe('Middleware Files Existence', () => {
    it('auth middleware should exist', () => {
      expect(() => {
        require('../src/middlewares/auth.middleware');
      }).not.toThrow();
    });

    it('permission middleware should exist', () => {
      expect(() => {
        require('../src/middlewares/require-permission.middleware');
      }).not.toThrow();
    });

    it('validation middleware should exist', () => {
      expect(() => {
        require('../src/middlewares/validate.middleware');
      }).not.toThrow();
    });
  });

  describe('Utility Files Existence', () => {
    it('rbac utility should exist', () => {
      expect(() => {
        require('../src/utils/rbac');
      }).not.toThrow();
    });

    it('logger utility should exist', () => {
      expect(() => {
        require('../src/utils/logger');
      }).not.toThrow();
    });
  });

  describe('Configuration Files', () => {
    it('package.json should exist', () => {
      const fs = require('fs');
      expect(fs.existsSync('./package.json')).toBe(true);
    });

    it('jest.config.js should exist', () => {
      const fs = require('fs');
      expect(fs.existsSync('./jest.config.js')).toBe(true);
    });

    it('tests directory should exist', () => {
      const fs = require('fs');
      expect(fs.existsSync('./tests')).toBe(true);
    });
  });

  describe('Environment Setup', () => {
    it('should have NODE_ENV set to test', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should have test JWT secrets', () => {
      expect(process.env.JWT_SECRET).toBe('test-jwt-secret-key');
      expect(process.env.JWT_REFRESH_SECRET).toBe('test-jwt-refresh-secret-key');
    });

    it('should have test Redis URL', () => {
      expect(process.env.REDIS_URL).toBe('redis://localhost:6379/1');
    });
  });

  describe('Global Test Helpers', () => {
    it('should have createMockResponse function', () => {
      expect(typeof global.createMockResponse).toBe('function');
    });

    it('should have createMockRequest function', () => {
      expect(typeof global.createMockRequest).toBe('function');
    });

    it('should have createMockNext function', () => {
      expect(typeof global.createMockNext).toBe('function');
    });

    it('should have createMockUser function', () => {
      expect(typeof global.createMockUser).toBe('function');
    });

    it('should have createMockFeature function', () => {
      expect(typeof global.createMockFeature).toBe('function');
    });

    it('should have randomString function', () => {
      expect(typeof global.randomString).toBe('function');
    });

    it('should have randomNumber function', () => {
      expect(typeof global.randomNumber).toBe('function');
    });

    it('should have randomEmail function', () => {
      expect(typeof global.randomEmail).toBe('function');
    });
  });

  describe('Mock Data Factory', () => {
    it('should create mock user with default values', () => {
      const user = global.createMockUser();
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('enabled');
      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('user');
    });

    it('should create mock user with custom values', () => {
      const customUser = global.createMockUser({
        id: 'custom-user',
        name: 'Custom User'
      });
      expect(customUser.id).toBe('custom-user');
      expect(customUser.name).toBe('Custom User');
    });

    it('should create mock feature with default values', () => {
      const feature = global.createMockFeature();
      expect(feature).toHaveProperty('id');
      expect(feature).toHaveProperty('key');
      expect(feature).toHaveProperty('name');
      expect(feature).toHaveProperty('status');
      expect(feature.id).toBe('feature-123');
      expect(feature.key).toBe('test-feature');
      expect(feature.name).toBe('Test Feature');
      expect(feature.status).toBe('published');
    });

    it('should create mock feature with custom values', () => {
      const customFeature = global.createMockFeature({
        id: 'custom-feature',
        name: 'Custom Feature'
      });
      expect(customFeature.id).toBe('custom-feature');
      expect(customFeature.name).toBe('Custom Feature');
    });
  });

  describe('Test Utilities', () => {
    it('should generate random string', () => {
      const str = global.randomString(10);
      expect(typeof str).toBe('string');
      expect(str.length).toBe(10);
    });

    it('should generate random number in range', () => {
      const num = global.randomNumber(1, 10);
      expect(typeof num).toBe('number');
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(10);
    });

    it('should generate random email', () => {
      const email = global.randomEmail();
      expect(typeof email).toBe('string');
      expect(email).toMatch(/test-.+@example\.com/);
    });

    it('should create mock response with required methods', () => {
      const res = global.createMockResponse();
      expect(typeof res.status).toBe('function');
      expect(typeof res.json).toBe('function');
      expect(typeof res.send).toBe('function');
    });

    it('should create mock request with default user', () => {
      const req = global.createMockRequest();
      expect(req).toHaveProperty('user');
      expect(req.user).toHaveProperty('id', 'test-user-id');
      expect(req.user).toHaveProperty('role', 'admin');
    });

    it('should create mock next function', () => {
      const next = global.createMockNext();
      expect(typeof next).toBe('function');
    });
  });
});