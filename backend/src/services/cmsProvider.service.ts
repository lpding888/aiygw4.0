import { db } from '../config/database.js';
import cmsCacheService from './cmsCache.service.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import crypto from 'crypto';
import axios from 'axios';

class CmsProviderService {
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly ENCRYPTION_KEY =
    process.env.PROVIDER_SECRET_KEY || crypto.randomBytes(32).toString('hex');
  private readonly CONNECT_TIMEOUT = 10000;

  async getProviders(options: any = {}) {
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
      let query = db('provider_endpoints').select([
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

      if (type) query = query.where('type', type);
      if (status) query = query.where('status', status);
      if (enabled !== undefined) query = query.where('enabled', enabled);
      if (search) {
        query = query.where(function (this: any) {
          this.where('name', 'like', `%${search}%`).orWhere('description', 'like', `%${search}%`);
        });
      }
      if (sortBy) query = query.orderBy(sortBy, sortOrder);

      const offset = (page - 1) * limit;
      const totalCount = await query.clone().clearSelect().count('* as count');
      const providers = await query.limit(limit).offset(offset);

      const sanitizedProviders = (providers as any[]).map((p) => ({
        ...p,
        last_test_result: this.sanitizeTestResult(p.last_test_result as any)
      }));

      return {
        providers: sanitizedProviders,
        pagination: {
          current: page,
          pageSize: limit,
          total: parseInt((totalCount[0] as any).count),
          totalPages: Math.ceil((totalCount[0] as any).count / limit)
        }
      };
    } catch (error) {
      logger.error('[CmsProviderService] Get providers failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '获取供应商列表失败');
    }
  }

  async getProviderById(id: string) {
    try {
      const provider = await db('provider_endpoints').where('id', id).first();
      if (!provider) throw AppError.custom(ERROR_CODES.USER_NOT_FOUND, '供应商不存在');
      const secret = await this.getProviderSecret(id);
      return { ...provider, secret: secret ? this.maskSecret(secret) : null };
    } catch (error) {
      if ((error as any)?.statusCode) throw error as any;
      logger.error('[CmsProviderService] Get provider by ID failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '获取供应商详情失败');
    }
  }

  async createProvider(data: any, userId: string) {
    try {
      const [provider] = await db('provider_endpoints')
        .insert({
          ...data,
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');
      if (data.secret) await this.saveProviderSecret((provider as any).id, data.secret);
      await (cmsCacheService as any).invalidateScope('providers');
      logger.info(`[CmsProviderService] Provider created: ${(provider as any).id}`);
      return provider;
    } catch (error) {
      logger.error('[CmsProviderService] Create provider failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '创建供应商失败');
    }
  }

  async updateProvider(id: string, updateData: any, userId: string) {
    try {
      const [updated] = await db('provider_endpoints')
        .where('id', id)
        .update({ ...updateData, updated_at: new Date() })
        .returning('*');
      if (updateData.secret !== undefined) {
        if (updateData.secret) await this.saveProviderSecret(id, updateData.secret);
        else await this.deleteProviderSecret(id);
      }
      await (cmsCacheService as any).invalidateScope('providers');
      logger.info(`[CmsProviderService] Provider updated: ${id} by ${userId}`);
      return updated;
    } catch (error) {
      logger.error('[CmsProviderService] Update provider failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '更新供应商失败');
    }
  }

  async deleteProvider(id: string) {
    try {
      await db('provider_endpoints').where('id', id).del();
      await this.deleteProviderSecret(id);
      await (cmsCacheService as any).invalidateScope('providers');
      logger.info(`[CmsProviderService] Provider deleted: ${id}`);
    } catch (error) {
      logger.error('[CmsProviderService] Delete provider failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '删除供应商失败');
    }
  }

  async testProvider(id: string, userId: string) {
    try {
      const provider: any = await db('provider_endpoints').where('id', id).first();
      if (!provider) throw AppError.custom(ERROR_CODES.USER_NOT_FOUND, '供应商不存在');

      const start = Date.now();
      let success = false;
      let message = 'OK';
      try {
        const secret = await this.getProviderSecret(id);
        await axios.get(provider.base_url, {
          timeout: this.CONNECT_TIMEOUT,
          headers: secret ? { Authorization: `Bearer ${secret}` } : undefined
        });
        success = true;
      } catch (err: any) {
        success = false;
        message = err?.message || '连接失败';
      }

      const responseTime = Date.now() - start;
      const testResult = { success, responseTime, message, timestamp: new Date().toISOString() };

      await db('provider_endpoints')
        .where('id', id)
        .update({
          last_tested_at: new Date(),
          last_test_result: JSON.stringify(testResult),
          updated_at: new Date()
        });

      return testResult;
    } catch (error) {
      logger.error('[CmsProviderService] Test provider failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '测试供应商失败');
    }
  }

  async getProviderSecret(providerId: string): Promise<string | null> {
    try {
      const secretRecord = await db('provider_secrets').where('provider_id', providerId).first();

      if (!secretRecord) return null;
      const encrypted_secret = (secretRecord as any).encrypted_secret as string;
      const iv = (secretRecord as any).iv as string;
      return this.decryptSecret(encrypted_secret, iv);
    } catch (error) {
      logger.error('[CmsProviderService] Get provider secret failed:', error);
      return null;
    }
  }

  async saveProviderSecret(providerId: string, secret: string) {
    try {
      const { encrypted, iv } = this.encryptSecret(secret);
      await db('provider_secrets')
        .insert({
          provider_id: providerId,
          encrypted_secret: encrypted,
          iv,
          created_at: new Date(),
          updated_at: new Date()
        })
        .onConflict()
        .merge();
    } catch (error) {
      logger.error('[CmsProviderService] Save provider secret failed:', error);
      throw error;
    }
  }

  async deleteProviderSecret(providerId: string) {
    try {
      await db('provider_secrets').where('provider_id', providerId).del();
    } catch (error) {
      logger.error('[CmsProviderService] Delete provider secret failed:', error);
    }
  }

  encryptSecret(secret: string) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(
      this.ENCRYPTION_ALGORITHM,
      Buffer.from(this.ENCRYPTION_KEY, 'hex')
    );
    (cipher as any).setAAD(Buffer.from('provider-secret'));
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = (cipher as any).getAuthTag();
    return { encrypted: encrypted + ':' + tag.toString('hex'), iv: iv.toString('hex') };
  }

  decryptSecret(encryptedSecret: string, iv: string) {
    try {
      const [encrypted, tag] = encryptedSecret.split(':');
      const decipher = crypto.createDecipher(
        this.ENCRYPTION_ALGORITHM,
        Buffer.from(this.ENCRYPTION_KEY, 'hex')
      );
      (decipher as any).setAAD(Buffer.from('provider-secret'));
      (decipher as any).setAuthTag(Buffer.from(tag, 'hex'));
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      logger.error('[CmsProviderService] Decrypt secret failed:', error);
      return null;
    }
  }

  maskSecret(secret: string | null) {
    if (!secret || secret.length < 8) return secret;
    return secret.substring(0, 4) + '****' + secret.substring(secret.length - 4);
  }

  sanitizeTestResult(testResult: any) {
    if (!testResult) return null;
    try {
      const result = typeof testResult === 'string' ? JSON.parse(testResult) : testResult;
      if (result.details && result.details.headers) {
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

  async getProviderStats() {
    try {
      const stats = await db('provider_endpoints')
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('COUNT(CASE WHEN enabled = true THEN 1 END) as enabled'),
          db.raw("COUNT(CASE WHEN status = 'active' THEN 1 END) as active"),
          db.raw("COUNT(CASE WHEN status = 'error' THEN 1 END) as error")
        )
        .first();
      return stats;
    } catch (error) {
      logger.error('[CmsProviderService] Get provider stats failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '获取供应商统计失败');
    }
  }

  async testAllProviders(userId: string) {
    try {
      const providers = await this.getProviders({ limit: 1000 });
      const results: any = {
        total: providers.providers.length,
        success: 0,
        failed: 0,
        details: []
      };
      for (const provider of providers.providers) {
        try {
          const testResult = await this.testProvider((provider as any).id, userId);
          results.details.push({
            id: (provider as any).id,
            name: (provider as any).name,
            success: (testResult as any).success,
            responseTime: (testResult as any).responseTime,
            error: (testResult as any).success ? null : (testResult as any).message
          });
          if ((testResult as any).success) results.success++;
          else results.failed++;
        } catch (error: any) {
          results.details.push({
            id: (provider as any).id,
            name: (provider as any).name,
            success: false,
            error: error.message
          });
          results.failed++;
        }
      }
      logger.info(
        `[CmsProviderService] Batch test completed: ${results.success} success, ${results.failed} failed`
      );
      return results;
    } catch (error) {
      logger.error('[CmsProviderService] Batch test providers failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '批量测试供应商失败');
    }
  }
}

export default new CmsProviderService();
