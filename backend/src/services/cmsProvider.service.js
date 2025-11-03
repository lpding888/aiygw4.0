const db = require('../config/database');
const cmsCacheService = require('./cmsCache.service');
const rbacService = require('./rbac.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const crypto = require('crypto');
const axios = require('axios');

/**
 * CMS供应商管理服务
 * 提供供应商的CRUD、Secret管理、连接测试等功能
 */
class CmsProviderService {
  constructor() {
    this.ENCRYPTION_ALGORITHM = 'aes-256-gcm';
    this.ENCRYPTION_KEY = process.env.PROVIDER_SECRET_KEY || crypto.randomBytes(32).toString('hex');
    this.CONNECT_TIMEOUT = 10000; // 10秒连接超时
  }

  /**
   * 获取供应商列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>}
   */
  async getProviders(options = {}) {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      enabled,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options;

    try {
      let query = db('provider_endpoints')
        .select([
          'id',
          'name',
          'description',
          'type',
          'base_url',
          'weight',
          'timeout',
          'retry',
          'enabled',
          'status',
          'last_tested_at',
          'last_test_result',
          'created_by',
          'created_at',
          'updated_at'
        ]);

      // 应用筛选条件
      if (type) {
        query = query.where('type', type);
      }
      if (status) {
        query = query.where('status', status);
      }
      if (enabled !== undefined) {
        query = query.where('enabled', enabled);
      }
      if (search) {
        query = query.where(function() {
          this.where('name', 'like', `%${search}%`)
              .orWhere('description', 'like', `%${search}%`);
        });
      }

      // 排序
      if (sortBy) {
        query = query.orderBy(sortBy, sortOrder);
      }

      // 分页
      const offset = (page - 1) * limit;
      const totalCount = await query.clone().clearSelect().count('* as count');
      const providers = await query.limit(limit).offset(offset);

      // 脱敏敏感信息
      const sanitizedProviders = providers.map(provider => ({
        ...provider,
        last_test_result: this.sanitizeTestResult(provider.last_test_result)
      }));

      return {
        providers: sanitizedProviders,
        pagination: {
          current: page,
          pageSize: limit,
          total: parseInt(totalCount[0].count),
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      };

    } catch (error) {
      logger.error('[CmsProviderService] Get providers failed:', error);
      throw new AppError('获取供应商列表失败', 500, 'GET_PROVIDERS_FAILED');
    }
  }

  /**
   * 根据ID获取供应商详情
   * @param {string} id - 供应商ID
   * @returns {Promise<Object>}
   */
  async getProviderById(id) {
    try {
      const provider = await db('provider_endpoints')
        .where('id', id)
        .first();

      if (!provider) {
        throw new AppError('供应商不存在', 404, 'PROVIDER_NOT_FOUND');
      }

      // 获取密钥（如果存在）
      const secret = await this.getProviderSecret(id);

      return {
        ...provider,
        secret: secret ? this.maskSecret(secret) : null,
        last_test_result: this.sanitizeTestResult(provider.last_test_result)
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('[CmsProviderService] Get provider by ID failed:', error);
      throw new AppError('获取供应商详情失败', 500, 'GET_PROVIDER_FAILED');
    }
  }

  /**
   * 创建供应商
   * @param {Object} providerData - 供应商数据
   * @param {string} userId - 创建用户ID
   * @returns {Promise<Object>}
   */
  async createProvider(providerData, userId) {
    const {
      name,
      description,
      type,
      base_url,
      weight = 100,
      timeout = 5000,
      retry = 3,
      enabled = true,
      secret
    } = providerData;

    try {
      // 验证必要字段
      if (!name || !type || !base_url) {
        throw new AppError('供应商名称、类型和基础URL不能为空', 400, 'INVALID_PROVIDER_DATA');
      }

      // 验证URL格式
      try {
        new URL(base_url);
      } catch (urlError) {
        throw new AppError('基础URL格式不正确', 400, 'INVALID_URL');
      }

      // 创建供应商
      const [provider] = await db('provider_endpoints').insert({
        name,
        description,
        type,
        base_url,
        weight,
        timeout,
        retry,
        enabled,
        status: 'inactive',
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');

      // 保存密钥（如果提供）
      if (secret) {
        await this.saveProviderSecret(provider.id, secret);
      }

      // 创建快照
      await cmsCacheService.createSnapshot(
        'providers',
        provider.id,
        provider,
        'create',
        '创建供应商',
        userId
      );

      // 失效相关缓存
      await cmsCacheService.invalidate('providers', provider.id);

      logger.info(`[CmsProviderService] Provider created: ${name} by ${userId}`);
      return provider;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('[CmsProviderService] Create provider failed:', error);
      throw new AppError('创建供应商失败', 500, 'CREATE_PROVIDER_FAILED');
    }
  }

  /**
   * 更新供应商
   * @param {string} id - 供应商ID
   * @param {Object} updateData - 更新数据
   * @param {string} userId - 更新用户ID
   * @returns {Promise<Object>}
   */
  async updateProvider(id, updateData, userId) {
    try {
      const provider = await this.getProviderById(id);

      // 验证URL格式（如果更新base_url）
      if (updateData.base_url) {
        try {
          new URL(updateData.base_url);
        } catch (urlError) {
          throw new AppError('基础URL格式不正确', 400, 'INVALID_URL');
        }
      }

      // 更新数据
      const updates = {
        ...updateData,
        updated_by: userId,
        updated_at: new Date()
      };

      const [updatedProvider] = await db('provider_endpoints')
        .where('id', id)
        .update(updates)
        .returning('*');

      // 更新密钥（如果提供）
      if (updateData.secret !== undefined) {
        if (updateData.secret) {
          await this.saveProviderSecret(id, updateData.secret);
        } else {
          await this.deleteProviderSecret(id);
        }
      }

      // 创建快照
      await cmsCacheService.createSnapshot(
        'providers',
        id,
        updatedProvider,
        'update',
        '更新供应商',
        userId
      );

      // 失效相关缓存
      await cmsCacheService.invalidate('providers', id);

      logger.info(`[CmsProviderService] Provider updated: ${provider.name} by ${userId}`);
      return updatedProvider;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('[CmsProviderService] Update provider failed:', error);
      throw new AppError('更新供应商失败', 500, 'UPDATE_PROVIDER_FAILED');
    }
  }

  /**
   * 删除供应商
   * @param {string} id - 供应商ID
   * @param {string} userId - 删除用户ID
   * @returns {Promise<void>}
   */
  async deleteProvider(id, userId) {
    try {
      const provider = await this.getProviderById(id);

      await db('provider_endpoints').where('id', id).del();

      // 删除密钥
      await this.deleteProviderSecret(id);

      // 创建快照
      await cmsCacheService.createSnapshot(
        'providers',
        id,
        provider,
        'delete',
        '删除供应商',
        userId
      );

      // 失效相关缓存
      await cmsCacheService.invalidate('providers', id);

      logger.info(`[CmsProviderService] Provider deleted: ${provider.name} by ${userId}`);

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('[CmsProviderService] Delete provider failed:', error);
      throw new AppError('删除供应商失败', 500, 'DELETE_PROVIDER_FAILED');
    }
  }

  /**
   * 测试供应商连接
   * @param {string} id - 供应商ID
   * @param {string} userId - 测试用户ID
   * @returns {Promise<Object>}
   */
  async testProvider(id, userId) {
    try {
      const provider = await this.getProviderById(id);

      // 获取密钥
      const secret = await this.getProviderSecret(id);

      const testResult = await this.performConnectionTest(provider, secret);

      // 更新测试结果
      await db('provider_endpoints')
        .where('id', id)
        .update({
          last_tested_at: new Date(),
          last_test_result: JSON.stringify(testResult),
          status: testResult.success ? 'active' : 'error',
          updated_at: new Date()
        });

      // 失效相关缓存
      await cmsCacheService.invalidate('providers', id);

      logger.info(`[CmsProviderService] Provider test completed: ${provider.name} - ${testResult.success ? 'SUCCESS' : 'FAILED'}`);
      return testResult;

    } catch (error) {
      logger.error('[CmsProviderService] Test provider failed:', error);
      throw new AppError('测试供应商连接失败', 500, 'TEST_PROVIDER_FAILED');
    }
  }

  /**
   * 执行连接测试
   * @param {Object} provider - 供应商信息
   * @param {string} secret - 密钥
   * @returns {Promise<Object>}
   */
  async performConnectionTest(provider, secret) {
    const startTime = Date.now();

    try {
      const testUrl = `${provider.base_url}/health`;

      // 构建请求配置
      const config = {
        timeout: provider.timeout || this.CONNECT_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CMS-Provider-Test/1.0'
        }
      };

      // 添加认证头（如果有密钥）
      if (secret) {
        config.headers['Authorization'] = `Bearer ${secret}`;
      }

      // 发送测试请求
      const response = await axios.get(testUrl, config);

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        statusCode: response.status,
        message: '连接成功',
        timestamp: new Date().toISOString(),
        details: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      let errorMessage = '连接失败';
      let statusCode = null;

      if (error.response) {
        statusCode = error.response.status;
        errorMessage = `HTTP ${statusCode}: ${error.response.statusText}`;
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = '连接超时';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = '主机未找到';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = '连接被拒绝';
      }

      return {
        success: false,
        responseTime,
        statusCode,
        message: errorMessage,
        timestamp: new Date().toISOString(),
        error: {
          code: error.code,
          message: error.message
        }
      };
    }
  }

  /**
   * 获取供应商密钥
   * @param {string} providerId - 供应商ID
   * @returns {Promise<string|null>}
   */
  async getProviderSecret(providerId) {
    try {
      const secretRecord = await db('provider_secrets')
        .where('provider_id', providerId)
        .first();

      if (!secretRecord) {
        return null;
      }

      // 解密密钥
      return this.decryptSecret(secretRecord.encrypted_secret, secretRecord.iv);

    } catch (error) {
      logger.error('[CmsProviderService] Get provider secret failed:', error);
      return null;
    }
  }

  /**
   * 保存供应商密钥
   * @param {string} providerId - 供应商ID
   * @param {string} secret - 密钥
   * @returns {Promise<void>}
   */
  async saveProviderSecret(providerId, secret) {
    try {
      const { encrypted, iv } = this.encryptSecret(secret);

      await db('provider_secrets').insert({
        provider_id: providerId,
        encrypted_secret: encrypted,
        iv,
        created_at: new Date(),
        updated_at: new Date()
      }).onConflict().merge();

    } catch (error) {
      logger.error('[CmsProviderService] Save provider secret failed:', error);
      throw error;
    }
  }

  /**
   * 删除供应商密钥
   * @param {string} providerId - 供应商ID
   * @returns {Promise<void>}
   */
  async deleteProviderSecret(providerId) {
    try {
      await db('provider_secrets')
        .where('provider_id', providerId)
        .del();
    } catch (error) {
      logger.error('[CmsProviderService] Delete provider secret failed:', error);
    }
  }

  /**
   * 加密密钥
   * @param {string} secret - 原始密钥
   * @returns {Object}
   */
  encryptSecret(secret) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.ENCRYPTION_ALGORITHM, Buffer.from(this.ENCRYPTION_KEY, 'hex'));
    cipher.setAAD(Buffer.from('provider-secret'));

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted: encrypted + ':' + tag.toString('hex'),
      iv: iv.toString('hex')
    };
  }

  /**
   * 解密密钥
   * @param {string} encryptedSecret - 加密密钥
   * @param {string} iv - 初始向量
   * @returns {string}
   */
  decryptSecret(encryptedSecret, iv) {
    try {
      const [encrypted, tag] = encryptedSecret.split(':');
      const decipher = crypto.createDecipher(this.ENCRYPTION_ALGORITHM, Buffer.from(this.ENCRYPTION_KEY, 'hex'));
      decipher.setAAD(Buffer.from('provider-secret'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('[CmsProviderService] Decrypt secret failed:', error);
      return null;
    }
  }

  /**
   * 脱敏密钥显示
   * @param {string} secret - 原始密钥
   * @returns {string}
   */
  maskSecret(secret) {
    if (!secret || secret.length < 8) {
      return secret;
    }
    return secret.substring(0, 4) + '****' + secret.substring(secret.length - 4);
  }

  /**
   * 脱敏测试结果
   * @param {string} testResult - 测试结果JSON
   * @returns {Object}
   */
  sanitizeTestResult(testResult) {
    if (!testResult) {
      return null;
    }

    try {
      const result = JSON.parse(testResult);

      // 移除敏感信息
      if (result.details && result.details.headers) {
        // 移除可能的认证头
        const headers = { ...result.details.headers };
        delete headers.authorization;
        delete headers['x-api-key'];
        result.details.headers = headers;
      }

      return result;
    } catch (error) {
      return testResult;
    }
  }

  /**
   * 获取供应商统计信息
   * @returns {Promise<Object>}
   */
  async getProviderStats() {
    try {
      const stats = await db('provider_endpoints')
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('COUNT(CASE WHEN enabled = true THEN 1 END) as enabled'),
          db.raw('COUNT(CASE WHEN status = \'active\' THEN 1 END) as active'),
          db.raw('COUNT(CASE WHEN status = \'error\' THEN 1 END) as error')
        )
        .first();

      return stats;

    } catch (error) {
      logger.error('[CmsProviderService] Get provider stats failed:', error);
      throw new AppError('获取供应商统计失败', 500, 'GET_STATS_FAILED');
    }
  }

  /**
   * 批量测试所有供应商
   * @param {string} userId - 操作用户ID
   * @returns {Promise<Object>}
   */
  async testAllProviders(userId) {
    try {
      const providers = await this.getProviders({ limit: 1000 });
      const results = {
        total: providers.providers.length,
        success: 0,
        failed: 0,
        details: []
      };

      for (const provider of providers.providers) {
        try {
          const testResult = await this.testProvider(provider.id, userId);
          results.details.push({
            id: provider.id,
            name: provider.name,
            success: testResult.success,
            responseTime: testResult.responseTime,
            error: testResult.success ? null : testResult.message
          });

          if (testResult.success) {
            results.success++;
          } else {
            results.failed++;
          }

        } catch (error) {
          results.details.push({
            id: provider.id,
            name: provider.name,
            success: false,
            error: error.message
          });
          results.failed++;
        }
      }

      logger.info(`[CmsProviderService] Batch test completed: ${results.success} success, ${results.failed} failed`);
      return results;

    } catch (error) {
      logger.error('[CmsProviderService] Batch test providers failed:', error);
      throw new AppError('批量测试供应商失败', 500, 'BATCH_TEST_FAILED');
    }
  }
}

module.exports = new CmsProviderService();