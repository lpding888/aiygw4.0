import logger from '../utils/logger.js';
import providerWrapperService, { type HealthCheckResponse } from './provider-wrapper.service.js';
import mcpEndpointsService from './mcp-endpoints.service.js';
import imageProcessService from './imageProcess.service.js';
import aiModelService from './aiModel.service.js';
import OpenAIProvider from './providers/openai.provider.js';
import ClaudeProvider from './providers/claude.provider.js';
import QwenProvider from './providers/qwen.provider.js';
import DeepSeekProvider from './providers/deepseek.provider.js';
import { db } from '../config/database.js';
import encryptionUtils from '../utils/encryption.js';

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
  enabled?: boolean | number | null;
}

interface ProviderInstance {
  [key: string]: unknown;
}

class ProviderRegistryService {
  private registeredProviders = new Map<string, ProviderInstance>();
  private providerConfigs = new Map<string, ProviderConfig>();
  private initialized = false;
  private readonly externalProviderConfig: ProviderConfig = {
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
    cache: { ttl: 300, enabled: false }
  };

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

    this.registerProvider(
      'llm_deepseek',
      new DeepSeekProvider() as unknown as ProviderInstance,
      this.externalProviderConfig
    );

    logger.info('[ProviderRegistry] 内置Providers已注册: imageProcess, aiModel, llm_deepseek');

    // MCP Provider Adapter
    this.registerProvider('mcp', {
      execute: async (params: any, nodeId: string) => {
        const { _provider_ref, ...toolParams } = params;
        if (!_provider_ref) throw new Error('MCP Provider requires _provider_ref');

        // Format: endpointId:toolName
        // We find the first colon to split, assuming endpointId has no colon.
        const separatorIndex = _provider_ref.indexOf(':');
        if (separatorIndex === -1) throw new Error(`Invalid MCP provider ref: ${_provider_ref}`);

        const endpointId = _provider_ref.substring(0, separatorIndex);
        const toolName = _provider_ref.substring(separatorIndex + 1);

        // Allow userId to be passed or inferred?
        // Now extracting from params if present (injected by caller) or context
        const userId = params._userId || 'system';

        return await mcpEndpointsService.executeTool(endpointId, toolName, toolParams, userId);
      }
    } as unknown as ProviderInstance, {
      timeout: 300000, // 5 minutes for long running tools
      retry: { maxAttempts: 0, baseDelay: 1000, maxDelay: 5000, backoff: 'linear' }
    });
    logger.info('[ProviderRegistry] Registered generic MCP provider');
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
        await this.registerExternalProvider(dbConfig);
      }

      logger.info(`[ProviderRegistry] LLM Provider注册完成`);
    } catch (error) {
      logger.error('[ProviderRegistry] 从数据库加载Provider配置失败', error);
      // 不抛出错误，允许系统继续运行
    }
  }

  private isConfigEnabled(config: Pick<DbProviderConfig, 'enabled'>): boolean {
    const raw = config.enabled;
    return raw === null || raw === undefined ? true : Boolean(raw);
  }

  private getProviderType(providerRef: string, authType?: string): string {
    if (authType && authType !== 'unknown') return authType;
    return providerRef.replace(/^llm_/, '');
  }

  private async registerExternalProvider(dbConfig: DbProviderConfig): Promise<boolean> {
    if (!this.isConfigEnabled(dbConfig)) {
      this.unregisterProviderInstance(dbConfig.provider_ref);
      logger.info(
        `[ProviderRegistry] Provider已禁用，跳过注册: ${dbConfig.provider_name} (${dbConfig.provider_ref})`
      );
      return false;
    }

    try {
      const providerType = this.getProviderType(dbConfig.provider_ref, dbConfig.auth_type);

      const apiKey = encryptionUtils.decrypt(dbConfig.credentials_encrypted);
      const baseURL = dbConfig.endpoint_url;

      const providerInstance = this.createProviderInstance(providerType, {
        apiKey: apiKey || undefined,
        baseURL: baseURL || undefined
      });
      if (!providerInstance) {
        logger.warn(
          `[ProviderRegistry] 不支持的Provider类型: ${providerType}，跳过: ${dbConfig.provider_name}`
        );
        return false;
      }

      this.registerProvider(dbConfig.provider_ref, providerInstance, this.externalProviderConfig);
      logger.info(
        `[ProviderRegistry] 已注册LLM Provider: ${dbConfig.provider_name} (${dbConfig.provider_ref})`
      );
      return true;
    } catch (error) {
      logger.error(`[ProviderRegistry] 注册Provider失败: ${dbConfig.provider_name}`, error);
      return false;
    }
  }

  private unregisterProviderInstance(providerRef: string): void {
    if (this.registeredProviders.has(providerRef)) {
      providerWrapperService.unregisterProvider(providerRef);
      this.registeredProviders.delete(providerRef);
      this.providerConfigs.delete(providerRef);
    }
  }

  /**
   * 根据类型创建Provider实例
   */
  private createProviderInstance(type: string, config?: { apiKey?: string; baseURL?: string }): ProviderInstance | null {
    switch (type.toLowerCase()) {
      case 'openai':
      case 'gpt':
        return new OpenAIProvider(config) as unknown as ProviderInstance;

      case 'claude':
      case 'anthropic':
        return new ClaudeProvider(config) as unknown as ProviderInstance;

      case 'qwen':
      case 'tongyi':
      case 'dashscope':
        return new QwenProvider(config) as unknown as ProviderInstance;

      case 'deepseek':
        return new DeepSeekProvider(config) as unknown as ProviderInstance;

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

  async syncProviderRegistration(providerRef: string, enabled: boolean): Promise<void> {
    if (enabled) {
      const dbConfig = (await db('provider_endpoints')
        .where({ provider_ref: providerRef })
        .first()) as DbProviderConfig | undefined;
      if (!dbConfig) {
        this.unregisterProviderInstance(providerRef);
        throw new Error(`Provider不存在: ${providerRef}`);
      }
      await this.registerExternalProvider(dbConfig);
    } else {
      this.unregisterProviderInstance(providerRef);
      logger.info(`[ProviderRegistry] Provider已禁用并注销: ${providerRef}`);
    }
  }
}

const providerRegistryService = new ProviderRegistryService();
export default providerRegistryService;
