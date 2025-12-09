import logger from '../utils/logger.js';
import providerWrapperService, { type HealthCheckResponse } from './provider-wrapper.service.js';
import mcpEndpointsService from './mcp-endpoints.service.js';
import OpenAIProvider from './providers/openai.provider.js';
import ClaudeProvider from './providers/claude.provider.js';
import QwenProvider from './providers/qwen.provider.js';
import DeepSeekProvider from './providers/deepseek.provider.js';
import { db } from '../config/database.js';
import encryptionUtils from '../utils/encryption.js';

type ProviderConfig = Parameters<typeof providerWrapperService.registerProvider>[2];

/**
 * Provider 能力声明（用于 Agent 节点动态感知）
 */
export interface ProviderCapabilities {
  tool_use: boolean;           // 是否支持 Function Calling / Tool Use
  parallel_tool_use: boolean;  // 是否支持并行工具调用
  vision: boolean;             // 是否支持图片输入
  streaming: boolean;          // 是否支持流式输出
  json_mode: boolean;          // 是否支持 JSON 输出模式
  max_context: number;         // 最大上下文窗口
  max_output: number;          // 最大输出 Token
}

/**
 * 默认模型能力矩阵（数据库未配置时的 fallback）
 */
const DEFAULT_CAPABILITIES: Record<string, ProviderCapabilities> = {
  'gpt-4o': { tool_use: true, parallel_tool_use: true, vision: true, streaming: true, json_mode: true, max_context: 128000, max_output: 16384 },
  'gpt-4-turbo': { tool_use: true, parallel_tool_use: true, vision: true, streaming: true, json_mode: true, max_context: 128000, max_output: 4096 },
  'gpt-3.5-turbo': { tool_use: true, parallel_tool_use: true, vision: false, streaming: true, json_mode: true, max_context: 16385, max_output: 4096 },
  'deepseek-chat': { tool_use: true, parallel_tool_use: true, vision: false, streaming: true, json_mode: true, max_context: 128000, max_output: 8192 },
  'deepseek-reasoner': { tool_use: false, parallel_tool_use: false, vision: false, streaming: true, json_mode: false, max_context: 64000, max_output: 8192 },
  'claude-3-5-sonnet': { tool_use: true, parallel_tool_use: true, vision: true, streaming: true, json_mode: false, max_context: 200000, max_output: 8192 },
  'claude-3-opus': { tool_use: true, parallel_tool_use: true, vision: true, streaming: true, json_mode: false, max_context: 200000, max_output: 4096 },
  'qwen-turbo': { tool_use: true, parallel_tool_use: false, vision: false, streaming: true, json_mode: true, max_context: 128000, max_output: 8192 },
  'qwen-plus': { tool_use: true, parallel_tool_use: true, vision: true, streaming: true, json_mode: true, max_context: 128000, max_output: 8192 },
};

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
  capabilities?: string | ProviderCapabilities | null; // JSON 或已解析对象
}

interface ProviderInstance {
  [key: string]: unknown;
}

type BuiltinProviders = Partial<Record<'imageProcess' | 'aiModel', ProviderInstance>>;

class ProviderRegistryService {
  private registeredProviders = new Map<string, ProviderInstance>();
  private providerConfigs = new Map<string, ProviderConfig>();
  private initialized = false;
  private builtinProviders: BuiltinProviders = {};
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

  async initialize(builtinProviders: BuiltinProviders = {}) {
    if (this.initialized) {
      logger.warn('[ProviderRegistry] 已初始化，跳过');
      return;
    }
    this.builtinProviders = builtinProviders;
    logger.info('[ProviderRegistry] 开始注册Provider...');
    await this.registerBuiltinProviders();
    await this.registerExternalProviders();
    this.initialized = true;
    logger.info(`[ProviderRegistry] Provider注册完成，共 ${this.registeredProviders.size} 个`);
  }

  private async registerBuiltinProviders() {
    const registered: string[] = [];

    if (this.builtinProviders.imageProcess) {
      this.registerProvider(
        'imageProcess',
        this.builtinProviders.imageProcess,
        {
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
        }
      );
      registered.push('imageProcess');
    } else {
      logger.warn('[ProviderRegistry] 跳过注册 imageProcess: 未提供内置实现');
    }

    if (this.builtinProviders.aiModel) {
      this.registerProvider(
        'aiModel',
        this.builtinProviders.aiModel,
        {
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
        }
      );
      registered.push('aiModel');
    } else {
      logger.warn('[ProviderRegistry] 跳过注册 aiModel: 未提供内置实现');
    }

    this.registerProvider(
      'llm_deepseek',
      new DeepSeekProvider() as unknown as ProviderInstance,
      this.externalProviderConfig
    );

    logger.info(
      `[ProviderRegistry] 内置Providers已注册: ${registered.length > 0 ? registered.join(', ') + ', ' : ''}llm_deepseek`
    );

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

  /**
   * 获取所有 Provider 配置（供 ProtocolAnalyzer 使用）
   */
  getProviderConfigs(): Map<string, ProviderConfig> {
    return new Map(this.providerConfigs);
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

  /**
   * 获取 Provider 能力（优先从数据库，fallback 到默认矩阵）
   */
  async getProviderCapabilities(providerRef: string): Promise<ProviderCapabilities | null> {
    try {
      // 尝试从数据库获取
      const dbConfig = await db('provider_endpoints')
        .where({ provider_ref: providerRef })
        .first() as DbProviderConfig | undefined;

      if (dbConfig?.capabilities) {
        // 如果是字符串则解析
        return typeof dbConfig.capabilities === 'string'
          ? JSON.parse(dbConfig.capabilities)
          : dbConfig.capabilities;
      }

      // Fallback: 从 providerRef 提取模型名并查默认矩阵
      // 例如 llm_deepseek_chat -> deepseek-chat
      const modelName = this.extractModelName(providerRef);
      return DEFAULT_CAPABILITIES[modelName] || null;
    } catch (error) {
      logger.error(`[ProviderRegistry] 获取能力失败: ${providerRef}`, error);
      return null;
    }
  }

  /**
   * 根据模型名称获取能力（不依赖 providerRef）
   */
  getModelCapabilities(modelName: string): ProviderCapabilities | null {
    return DEFAULT_CAPABILITIES[modelName] || null;
  }

  /**
   * 获取所有支持 Tool Use 的 Provider 列表
   */
  async getToolUseEnabledProviders(): Promise<string[]> {
    const enabled: string[] = [];

    for (const [providerRef] of this.registeredProviders) {
      if (!providerRef.startsWith('llm_')) continue;

      const caps = await this.getProviderCapabilities(providerRef);
      if (caps?.tool_use) {
        enabled.push(providerRef);
      }
    }

    return enabled;
  }

  /**
   * 从 providerRef 提取模型名
   * 例如: llm_deepseek -> deepseek-chat, llm_openai_gpt4o -> gpt-4o
   */
  private extractModelName(providerRef: string): string {
    // 移除前缀
    let name = providerRef.replace(/^(llm_|img_)/, '');
    // 常见映射
    const mappings: Record<string, string> = {
      'deepseek': 'deepseek-chat',
      'openai': 'gpt-4o',
      'claude': 'claude-3-5-sonnet',
      'qwen': 'qwen-turbo',
    };
    return mappings[name] || name.replace(/_/g, '-');
  }
}

const providerRegistryService = new ProviderRegistryService();
export default providerRegistryService;

