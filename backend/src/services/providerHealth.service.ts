/**
 * ProviderHealth Service - Provider健康监控服务 - TypeScript版本
 * 负责定期检查各Provider的健康状态并更新数据库
 */

import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import fetch, { type RequestInit } from 'node-fetch';

/**
 * Provider配置
 */
export interface ProviderConfig {
  provider_id: string;
  provider_name: string;
  type: string;
  config: Record<string, unknown>;
  endpoint_url?: string;
  is_enabled: boolean;
  deleted_at: Date | null;
}

/**
 * Provider健康检查配置
 */
export interface ProviderHealthCheckConfig {
  [key: string]: unknown;
}

/**
 * 更新健康记录数据
 */
export interface UpdateHealthRecordData {
  is_healthy: boolean;
  last_check_at: Date;
  response_time_ms: number;
  error_message: string | null;
  consecutive_failures: number;
  updated_at: Date;
  last_recovery_at?: Date;
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  isHealthy: boolean;
  responseTime: number;
}

/**
 * 健康检查摘要
 */
export interface HealthSummary {
  total: number;
  success: number;
  fail: number;
}

/**
 * 健康记录
 */
export interface HealthRecord {
  provider_id: string;
  provider_name: string;
  type: string;
  is_healthy: boolean;
  last_check_at: Date;
  response_time_ms: number;
  consecutive_failures: number;
  error_message: string | null;
}

/**
 * Provider健康服务类
 * 艹,这个service管理Provider的健康检查!
 */
export class ProviderHealthService {
  /**
   * 执行所有Provider的健康检查
   * 艹,并发检查所有启用的Provider!
   * @returns 健康检查摘要
   */
  async checkAllProviders(): Promise<HealthSummary | undefined> {
    try {
      logger.info('[ProviderHealthService] 开始健康检查');

      // 1. 获取所有需要监控的Provider端点 (从 provider_endpoints 表)
      const providers = await db('provider_endpoints').select(
        'provider_ref as provider_id',
        'provider_name',
        'auth_type as type',
        'endpoint_url',
        db.raw("'{}' as config")
      );

      if (providers.length === 0) {
        logger.info('[ProviderHealthService] 没有需要检查的Provider');
        return;
      }

      logger.info(`[ProviderHealthService] 检查${providers.length}个Provider`);

      // 2. 并发执行健康检查
      const checkPromises = providers.map((provider: ProviderConfig) =>
        this.checkProviderHealth(provider).catch((err: unknown) => {
          const error = err instanceof Error ? err : new Error(String(err));
          logger.error(
            `[ProviderHealthService] Provider健康检查异常 ` +
              `providerId=${provider.provider_id} error=${error.message}`
          );
          return null;
        })
      );

      const results = await Promise.all(checkPromises);

      // 3. 统计结果
      const successCount = results.filter((r) => r && r.isHealthy).length;
      const failCount = results.filter((r) => r && !r.isHealthy).length;

      logger.info(
        `[ProviderHealthService] 健康检查完成 ` +
          `total=${providers.length} success=${successCount} fail=${failCount}`
      );

      return {
        total: providers.length,
        success: successCount,
        fail: failCount
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ProviderHealthService] 健康检查失败: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * 检查单个Provider的健康状态
   * 艹,根据type调用不同的健康检查逻辑!
   * @param provider - Provider配置
   * @returns 健康检查结果
   */
  async checkProviderHealth(provider: ProviderConfig): Promise<HealthCheckResult> {
    const { provider_id, type, config, endpoint_url } = provider;
    const startTime = Date.now();

    try {
      let isHealthy = false;
      let errorMessage: string | null = null;

      // 根据type执行不同的健康检查
      switch (type) {
        case 'SYNC_IMAGE_PROCESS':
          isHealthy = await this.checkSyncImageProcessHealth(config, endpoint_url);
          break;

        case 'RUNNINGHUB_WORKFLOW':
          isHealthy = await this.checkRunninghubHealth(config, endpoint_url);
          break;

        case 'SCF_POST_PROCESS':
          isHealthy = await this.checkScfHealth(config, endpoint_url);
          break;

        case 'email':
          // 邮件服务通过SMTP连接检查，这里暂时返回true，因为EmailService自己会检查配置
          // 或者可以实现一个checkEmailHealth方法尝试连接SMTP
          isHealthy = true;
          break;

        default:
          logger.warn(`[ProviderHealthService] 未知的Provider类型: ${type}`);
          isHealthy = true; // 未知类型默认健康
      }

      const responseTime = Date.now() - startTime;

      // 更新健康检查记录
      await this.updateHealthRecord(provider_id, isHealthy, responseTime, errorMessage);

      logger.info(
        `[ProviderHealthService] Provider检查完成 ` +
          `providerId=${provider_id} healthy=${isHealthy} responseTime=${responseTime}ms`
      );

      return { isHealthy, responseTime };
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      logger.error(
        `[ProviderHealthService] Provider检查失败 ` +
          `providerId=${provider_id} error=${err.message}`
      );

      // 更新为不健康状态
      await this.updateHealthRecord(provider_id, false, responseTime, err.message);

      return { isHealthy: false, responseTime };
    }
  }

  /**
   * 检查同步图片处理Provider健康状态
   * @param config - Provider配置
   * @returns 是否健康
   */
  async checkSyncImageProcessHealth(
    config: ProviderHealthCheckConfig,
    endpointUrl?: string
  ): Promise<boolean> {
    try {
      const healthUrl = (config.health_url as string) || endpointUrl;
      if (!healthUrl) {
        logger.warn('[ProviderHealthService] 缺少健康检查URL，默认健康');
        return true;
      }
      return await this.pingUrl(healthUrl);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ProviderHealthService] 同步图片处理健康检查失败: ${err.message}`);
      return false;
    }
  }

  /**
   * 检查RunningHub工作流Provider健康状态
   * @param config - Provider配置
   * @returns 是否健康
   */
  async checkRunninghubHealth(
    config: ProviderHealthCheckConfig,
    endpointUrl?: string
  ): Promise<boolean> {
    try {
      const healthUrl =
        (config.health_url as string) ||
        (endpointUrl ? `${endpointUrl.replace(/\/$/, '')}/health` : undefined);
      if (!healthUrl) {
        logger.warn('[ProviderHealthService] RunningHub缺少健康检查URL，默认健康');
        return true;
      }
      return await this.pingUrl(healthUrl);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ProviderHealthService] RunningHub健康检查失败: ${err.message}`);
      return false;
    }
  }

  /**
   * 检查SCF云函数Provider健康状态
   * @param config - Provider配置
   * @returns 是否健康
   */
  async checkScfHealth(config: ProviderHealthCheckConfig, endpointUrl?: string): Promise<boolean> {
    try {
      const healthUrl =
        (config.health_url as string) ||
        (endpointUrl ? `${endpointUrl.replace(/\/$/, '')}?health=1` : undefined);
      if (!healthUrl) {
        logger.warn('[ProviderHealthService] SCF缺少健康检查URL，默认健康');
        return true;
      }
      return await this.pingUrl(healthUrl, { method: 'GET' });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ProviderHealthService] SCF健康检查失败: ${err.message}`);
      return false;
    }
  }

  /**
   * 更新Provider健康检查记录
   * 艹,更新或插入健康检查记录到数据库!
   * @param providerId - Provider ID
   * @param isHealthy - 是否健康
   * @param responseTime - 响应时间(ms)
   * @param errorMessage - 错误信息
   */
  async updateHealthRecord(
    providerId: string,
    isHealthy: boolean,
    responseTime: number,
    errorMessage: string | null = null
  ): Promise<void> {
    try {
      const now = new Date();
      const status = isHealthy ? 'up' : 'down';

      // 查询是否已存在记录 (使用 provider_ref 字段)
      const existing = await db('provider_health').where('provider_ref', providerId).first();

      if (existing) {
        // 更新现有记录 (使用实际表字段)
        await db('provider_health').where('provider_ref', providerId).update({
          status,
          avg_latency_ms: responseTime,
          last_check_at: now,
          last_error: errorMessage,
          updated_at: now
        });
      } else {
        // 创建新记录 (使用实际表字段)
        await db('provider_health').insert({
          provider_ref: providerId,
          status,
          avg_latency_ms: responseTime,
          last_check_at: now,
          last_error: errorMessage,
          success_rate_24h: isHealthy ? 100 : 0,
          created_at: now,
          updated_at: now
        });
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ProviderHealthService] 更新健康记录失败 providerId=${providerId}`, err);
    }
  }

  /**
   * 获取所有Provider的健康状态摘要
   * 艹,查询所有Provider的健康状态!
   * @returns 健康记录列表
   */
  async getHealthSummary(): Promise<HealthRecord[]> {
    try {
      const healthRecords = await db('provider_health as ph')
        .join('provider_endpoints as pe', 'ph.provider_ref', 'pe.provider_ref')
        .select(
          'ph.provider_ref as provider_id',
          'pe.provider_name',
          'pe.auth_type as type',
          db.raw("CASE WHEN ph.status = 'up' THEN 1 ELSE 0 END as is_healthy"),
          'ph.last_check_at',
          'ph.avg_latency_ms as response_time_ms',
          db.raw('0 as consecutive_failures'),
          'ph.last_error as error_message'
        )
        .orderBy('ph.last_check_at', 'desc');

      return healthRecords;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ProviderHealthService] 获取健康摘要失败: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * 获取不健康的Provider列表
   * 艹,找出所有挂掉的Provider!
   * @returns 不健康Provider列表
   */
  async getUnhealthyProviders(): Promise<Partial<HealthRecord>[]> {
    try {
      const unhealthyProviders = await db('provider_health as ph')
        .join('provider_endpoints as pe', 'ph.provider_ref', 'pe.provider_ref')
        .where('ph.status', '!=', 'up')
        .select(
          'ph.provider_ref as provider_id',
          'pe.provider_name',
          'pe.auth_type as type',
          db.raw('0 as consecutive_failures'),
          'ph.last_check_at',
          'ph.last_error as error_message'
        )
        .orderBy('ph.last_check_at', 'desc');

      return unhealthyProviders;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ProviderHealthService] 获取不健康Provider失败: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * 通用健康探活请求
   */
  private async pingUrl(url: string, options: RequestInit = {}): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { method: 'HEAD', ...options, signal: controller.signal });
      return res.ok;
    } catch (error) {
      const err = error as Error;
      logger.warn('[ProviderHealthService] 健康探测失败', { url, error: err.message });
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// 艹,单例导出!
const providerHealthService = new ProviderHealthService();

export default providerHealthService;
