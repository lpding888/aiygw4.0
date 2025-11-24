import logger from '../utils/logger.js';
import providerWrapperService, { type HealthCheckResponse } from './provider-wrapper.service.js';
import imageProcessService from './imageProcess.service.js';
import aiModelService from './aiModel.service.js';
import OpenAIProvider from './providers/openai.provider.js';
import ClaudeProvider from './providers/claude.provider.js';
import QwenProvider from './providers/qwen.provider.js';
import { db } from '../config/database.js';

type ProviderConfig = Parameters<typeof providerWrapperService.registerProvider>[2];

// 数据库中的Provider配置结构（旧表结构）
interface DbProviderConfig {
  provider_ref: string; // 主键，格式如: llm_openai, llm_claude, llm_qwen
  provider_name: string;
  endpoint_url: string;
  credentials_encrypted: string;
  auth_type: string;
  created_at: Date;
  updated_at: Date;
}

interface ProviderInstance {
  [key: string]: unknown;
}

class ProviderRegistryService {
  private registeredProviders = new Map<string, ProviderInstance>();
  private providerConfigs = new Map<string, ProviderConfig>();
  private initialized = false;

  async initialize() {
    if (this.initialized) {
      logger.warn('[ProviderRegistry] 已初始化，跳过');
      return;
    }
    logger.info('[ProviderRegistry] 开始注册Provider...');
    await this.registerBuiltinProviders();
    await this.registerExternalProviders();
    this.initialized = true;
    logger.info(`[ProviderRegistry] Provider注册完成，共 ${this.registeredProviders.size} 个`);
  }

  private async registerBuiltinProviders() {
    // 图片处理服务
    this.registerProvider('imageProcess', imageProcessService as unknown as ProviderInstance, {
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 30000,
        monitoringPeriod: 10000,
        halfOpenMaxCalls: 2,
        successThreshold: 2
      },
      retry: { maxAttempts: 2, baseDelay: 1000, maxDelay: 8000, backoff: 'exponential' },
      timeout: 60000,
      cache: { ttl: 300, enabled: true }
    });

    // 原有AI模型服务（RunningHub）
    this.registerProvider('aiModel', aiModelService as unknown as ProviderInstance, {
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeout: 60000,
        monitoringPeriod: 15000,
        halfOpenMaxCalls: 1,
        successThreshold: 1
      },
      retry: { maxAttempts: 1, baseDelay: 2000, maxDelay: 5000, backoff: 'linear' },
      timeout: 120000,
      cache: { ttl: 600, enabled: true }
    });

    logger.info('[ProviderRegistry] 内置Providers已注册: imageProcess, aiModel');
  }

  /**
   * 从数据库加载并注册外部Provider（LLM Providers）
   */
  private async registerExternalProviders() {
    try {
      // 从数据库读取LLM Provider配置（provider_ref以llm_开头的）
      const providers = (await db('provider_endpoints')
        .where('provider_ref', 'like', 'llm_%')
        .select('*')) as DbProviderConfig[];

      logger.info(`[ProviderRegistry] 从数据库读取到 ${providers.length} 个LLM Provider配置`);

      for (const dbConfig of providers) {
        try {
          // 从provider_ref提取类型 (llm_openai -> openai)
          const providerType = dbConfig.provider_ref.replace(/^llm_/, '');

          // 创建Provider实例
          const providerInstance = this.createProviderInstance(providerType);
          if (!providerInstance) {
            logger.warn(
              `[ProviderRegistry] 不支持的Provider类型: ${providerType}，跳过: ${dbConfig.provider_name}`
            );
            continue;
          }

          // 将数据库配置转换为wrapper配置
          const wrapperConfig: ProviderConfig = {
            circuitBreaker: {
              failureThreshold: 3,
              resetTimeout: 60000,
              monitoringPeriod: 20000,
              halfOpenMaxCalls: 1,
              successThreshold: 2
            },
            retry: {
              maxAttempts: 2,
              baseDelay: 1000,
              maxDelay: 5000,
              backoff: 'exponential'
            },
            timeout: 60000,
            cache: { ttl: 300, enabled: false } // LLM通常不缓存
          };

          // 注册Provider（使用provider_ref作为标识）
          this.registerProvider(dbConfig.provider_ref, providerInstance, wrapperConfig);
          logger.info(
            `[ProviderRegistry] 已注册LLM Provider: ${dbConfig.provider_name} (${dbConfig.provider_ref})`
          );
        } catch (error) {
          logger.error(`[ProviderRegistry] 注册Provider失败: ${dbConfig.provider_name}`, error);
        }
      }

      logger.info(`[ProviderRegistry] LLM Provider注册完成`);
    } catch (error) {
      logger.error('[ProviderRegistry] 从数据库加载Provider配置失败', error);
      // 不抛出错误，允许系统继续运行
    }
  }

  /**
   * 根据类型创建Provider实例
   */
  private createProviderInstance(type: string): ProviderInstance | null {
    switch (type.toLowerCase()) {
      case 'openai':
      case 'gpt':
        return new OpenAIProvider() as unknown as ProviderInstance;

      case 'claude':
      case 'anthropic':
        return new ClaudeProvider() as unknown as ProviderInstance;

      case 'qwen':
      case 'tongyi':
      case 'dashscope':
        return new QwenProvider() as unknown as ProviderInstance;

      default:
        return null;
    }
  }

  registerProvider(name: string, provider: ProviderInstance, config: ProviderConfig = {}) {
    providerWrapperService.registerProvider(name, provider, config);
    this.registeredProviders.set(name, provider);
    this.providerConfigs.set(name, config);
  }

  getRegisteredProviders() {
    return Array.from(this.registeredProviders.keys());
  }

  isProviderRegistered(name: string): boolean {
    return this.registeredProviders.has(name);
  }

  getAllProviderStates() {
    return providerWrapperService.getAllProviderStates();
  }

  async execute(
    providerName: string,
    methodName: string,
    args: unknown[] = [],
    options: Record<string, unknown> = {}
  ) {
    return await providerWrapperService.execute(providerName, methodName, args, options);
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    const wrapperHealth = await providerWrapperService.healthCheck();
    return wrapperHealth;
  }
}

const providerRegistryService = new ProviderRegistryService();
export default providerRegistryService;
