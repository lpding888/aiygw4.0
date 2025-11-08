/**
 * 供应商管理服务
 *
 * 管理外部服务提供商，支持密钥加密存储和连接测试
 */

const crypto = require('crypto');
const axios = require('axios');
import { db as knex } from '../db/index.js';
const logger = require('../utils/logger');
const kmsService = require('./kms.service');

interface ProviderConfig {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKeyId: string;
  handlerKeyId: string;
  weight: number;
  timeoutMs: number;
  maxRetries: number;
  enabled: boolean;
  healthy: boolean;
  description: string;
  lastCheckAt?: Date;
  lastError?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

class ProviderManagementService {
  private readonly ALGORITHM = 'aes-256-gcm';

  /**
   * 创建供应商配置
   */
  async createProvider(
    providerData: Partial<ProviderConfig>,
    secrets: {
      apiKey: string;
      handlerKey: string;
    },
    createdBy: string
  ): Promise<ProviderConfig> {
    const providerId = this.generateId();

    try {
      await knex.transaction(async (trx) => {
        // 加密密钥
        const encryptedApiKey = await kmsService.encrypt(
          secrets.apiKey,
          `provider_${providerId}_api_key`
        );
        const encryptedHandlerKey = await kmsService.encrypt(
          secrets.handlerKey,
          `provider_${providerId}_handler_key`
        );

        // 创建供应商配置
        const provider: ProviderConfig = {
          id: providerId,
          name: providerData.name!,
          type: providerData.type!,
          baseUrl: providerData.baseUrl!,
          apiKeyId: encryptedApiKey.id,
          handlerKeyId: encryptedHandlerKey.id,
          weight: providerData.weight || 1,
          timeoutMs: providerData.timeoutMs || 30000,
          maxRetries: providerData.maxRetries || 3,
          enabled: providerData.enabled !== false,
          healthy: true,
          description: providerData.description || '',
          createdBy,
          updatedBy: createdBy,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await trx('provider_endpoints').insert({
          id: provider.id,
          name: provider.name,
          type: provider.type,
          base_url: provider.baseUrl,
          api_key: provider.apiKeyId, // 存储密钥引用，不是实际密钥
          handler_key: provider.handlerKeyId,
          weight: provider.weight,
          timeout_ms: provider.timeoutMs,
          max_retries: provider.maxRetries,
          enabled: provider.enabled,
          healthy: provider.healthy,
          description: provider.description,
          created_by: provider.createdBy,
          updated_by: provider.updatedBy,
          created_at: provider.createdAt,
          updated_at: provider.updatedAt
        });

        // 密钥已通过KMS服务加密存储
      });

      logger.info('供应商配置已创建', { providerId, name: providerData.name, createdBy });
      const result = await this.getProvider(providerId);
      if (!result) {
        throw new Error('创建供应商配置后无法读取');
      }
      return result;
    } catch (error) {
      logger.error('创建供应商配置失败:', error);
      throw error;
    }
  }

  /**
   * 测试供应商连接
   */
  async testConnection(providerId: string): Promise<{
    success: boolean;
    latency: number;
    error?: string;
  }> {
    const provider = await this.getProvider(providerId);
    if (!provider) {
      throw new Error('供应商配置不存在');
    }

    const startTime = Date.now();

    try {
      // 获取密钥
      const [apiKey, handlerKey] = await Promise.all([
        kmsService.decrypt(provider.apiKeyId),
        kmsService.decrypt(provider.handlerKeyId)
      ]);

      // 执行健康检查
      const response = await axios.get(`${provider.baseUrl}/health`, {
        timeout: provider.timeoutMs,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const latency = Date.now() - startTime;

      if (response.status === 200) {
        // 更新健康状态
        await this.updateHealthStatus(providerId, true, undefined);

        return { success: true, latency };
      } else {
        throw new Error(`健康检查失败: ${response.status}`);
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      const errorMessage = error.message || '连接失败';

      // 更新健康状态
      await this.updateHealthStatus(providerId, false, errorMessage);

      logger.warn('供应商连接测试失败', { providerId, error: errorMessage });
      return { success: false, latency, error: errorMessage };
    }
  }

  /**
   * 更新供应商配置
   */
  async updateProvider(
    providerId: string,
    updateData: Partial<ProviderConfig>,
    updatedBy: string
  ): Promise<ProviderConfig> {
    const existingProvider = await this.getProvider(providerId);
    if (!existingProvider) {
      throw new Error('供应商配置不存在');
    }

    try {
      await knex('provider_endpoints')
        .where('id', providerId)
        .update({
          name: updateData.name || existingProvider.name,
          type: updateData.type || existingProvider.type,
          base_url: updateData.baseUrl || existingProvider.baseUrl,
          weight: updateData.weight !== undefined ? updateData.weight : existingProvider.weight,
          timeout_ms:
            updateData.timeoutMs !== undefined ? updateData.timeoutMs : existingProvider.timeoutMs,
          max_retries:
            updateData.maxRetries !== undefined
              ? updateData.maxRetries
              : existingProvider.maxRetries,
          description: updateData.description || existingProvider.description,
          updated_by: updatedBy,
          updated_at: new Date()
        });

      logger.info('供应商配置已更新', { providerId, updatedBy });
      const result = await this.getProvider(providerId);
      if (!result) {
        throw new Error('更新供应商配置后无法读取');
      }
      return result;
    } catch (error) {
      logger.error('更新供应商配置失败:', error);
      throw error;
    }
  }

  /**
   * 删除供应商配置
   */
  async deleteProvider(providerId: string, deletedBy: string): Promise<boolean> {
    try {
      // 删除相关的密钥
      const provider = await this.getProvider(providerId);
      if (provider) {
        await Promise.all([
          kmsService.delete(provider.apiKeyId),
          kmsService.delete(provider.handlerKeyId)
        ]);
      }

      // 软删除供应商配置
      await knex('provider_endpoints').where('id', providerId).update({
        enabled: false,
        updated_by: deletedBy,
        updated_at: new Date()
      });

      logger.info('供应商配置已删除', { providerId, deletedBy });
      return true;
    } catch (error) {
      logger.error('删除供应商配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取供应商配置
   */
  async getProvider(providerId: string): Promise<ProviderConfig | null> {
    try {
      const provider = await knex('provider_endpoints').where('id', providerId).first();

      if (provider) {
        return {
          id: provider.id,
          name: provider.name,
          type: provider.type,
          baseUrl: provider.base_url,
          apiKeyId: provider.api_key,
          handlerKeyId: provider.handler_key,
          weight: provider.weight,
          timeoutMs: provider.timeout_ms,
          maxRetries: provider.max_retries,
          enabled: Boolean(provider.enabled),
          healthy: Boolean(provider.healthy),
          description: provider.description,
          lastCheckAt: provider.last_check_at,
          lastError: provider.last_error,
          createdBy: provider.created_by,
          updatedBy: provider.updated_by,
          createdAt: provider.created_at,
          updatedAt: provider.updated_at
        };
      }

      return null;
    } catch (error) {
      logger.error(`获取供应商配置失败: ${providerId}`, error);
      return null;
    }
  }

  /**
   * 获取供应商列表
   */
  async getProviders(
    filters: {
      type?: string;
      enabled?: boolean;
      healthy?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ providers: ProviderConfig[]; total: number }> {
    const { type, enabled, healthy, page = 1, limit = 20 } = filters;

    try {
      let query = knex('provider_endpoints').select('*');

      // 应用过滤条件
      if (type) {
        query = query.where('type', type);
      }
      if (enabled !== undefined) {
        query = query.where('enabled', enabled);
      }
      if (healthy !== undefined) {
        query = query.where('healthy', healthy);
      }

      // 获取总数
      const totalQuery = query.clone().clearSelect().count('* as count');
      const [{ count }] = await totalQuery;
      const total = parseInt(String(count));

      // 分页查询
      const offset = (page - 1) * limit;
      const providers = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

      const mappedProviders = providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        type: provider.type,
        baseUrl: provider.base_url,
        apiKeyId: provider.api_key,
        handlerKeyId: provider.handler_key,
        weight: provider.weight,
        timeoutMs: provider.timeout_ms,
        maxRetries: provider.max_retries,
        enabled: Boolean(provider.enabled),
        healthy: Boolean(provider.healthy),
        description: provider.description,
        lastCheckAt: provider.last_check_at,
        lastError: provider.last_error,
        createdBy: provider.created_by,
        updatedBy: provider.updated_by,
        createdAt: provider.created_at,
        updatedAt: provider.updated_at
      }));

      return { providers: mappedProviders, total };
    } catch (error) {
      logger.error('获取供应商列表失败:', error);
      return { providers: [], total: 0 };
    }
  }

  /**
   * 更新健康状态
   */
  private async updateHealthStatus(
    providerId: string,
    healthy: boolean,
    error?: string
  ): Promise<void> {
    try {
      await knex('provider_endpoints').where('id', providerId).update({
        healthy,
        last_error: error,
        last_check_at: new Date(),
        updated_at: new Date()
      });
    } catch (updateError) {
      logger.error('更新供应商健康状态失败:', updateError);
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `provider_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

const providerManagementService = new ProviderManagementService();
export default providerManagementService;
