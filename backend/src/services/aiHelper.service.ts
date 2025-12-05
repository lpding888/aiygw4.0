import { createHttpClient } from '../utils/httpClient.js';
import logger from '../utils/logger.js';
import systemConfigService from './systemConfig.service.js';

export interface AiHelperConfigSummary {
  enabled: boolean;
  apiUrl: string | null;
  baseUrl: string;
  chatEndpoint: string;
  modelsEndpoint: string;
  hasApiKey: boolean;
  defaultModel: string | null;
  allowedModels: string[];
  systemPrompt: string | null;
}

export interface AiHelperRuntimeConfig extends AiHelperConfigSummary {
  apiKey: string | null;
}

export interface AiModelInfo {
  id: string;
  name: string;
  ownedBy?: string | null;
  description?: string | null;
}

interface TestConnectionResult {
  models: AiModelInfo[];
  baseUrl: string;
  chatEndpoint: string;
}

type SaveConfigPayload = {
  enabled?: boolean;
  apiUrl?: string | null;
  apiKey?: string | null;
  defaultModel?: string | null;
  allowedModels?: string[];
  systemPrompt?: string | null;
  resetApiKey?: boolean;
};

type TestOverrides = {
  apiUrl?: string | null;
  apiKey?: string | null;
};

const CONFIG_KEYS = {
  enabled: 'ai_guide_enabled',
  apiUrl: 'ai_guide_api_url',
  apiKey: 'ai_guide_api_key',
  defaultModel: 'ai_guide_model',
  allowedModels: 'ai_guide_allowed_models',
  systemPrompt: 'ai_guide_system_prompt'
} as const;

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const CHAT_SUFFIX = '/chat/completions';
const MODELS_SUFFIX = '/models';

class AiHelperService {
  private httpClient = createHttpClient({
    serviceName: 'ai_helper',
    timeoutMs: 20000,
    maxRetries: 0
  });

  private toBoolean(input: unknown, fallback = false): boolean {
    if (typeof input === 'boolean') return input;
    if (typeof input === 'number') return input !== 0;
    if (typeof input === 'string') {
      const normalized = input.trim().toLowerCase();
      return ['true', '1', 'yes', 'on'].includes(normalized);
    }
    return fallback;
  }

  private toStringOrNull(input: unknown): string | null {
    if (input === null || input === undefined) return null;
    const value = String(input).trim();
    return value.length > 0 ? value : null;
  }

  private toStringArray(input: unknown): string[] {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input
        .map((item) => this.toStringOrNull(item))
        .filter((item): item is string => Boolean(item));
    }
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => this.toStringOrNull(item))
            .filter((item): item is string => Boolean(item));
        }
      } catch {
        return input
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }
    return [];
  }

  private normalizeBaseUrl(raw?: string | null): string {
    const fallback = DEFAULT_BASE_URL;
    if (!raw) return fallback;
    const trimmed = raw.trim();
    if (!trimmed) return fallback;

    if (trimmed.includes('/chat/completions')) {
      return trimmed.replace(/\/chat\/completions.*$/i, '');
    }

    if (trimmed.endsWith('/')) {
      return trimmed.slice(0, -1);
    }

    return trimmed;
  }

  private ensureChatEndpoint(raw?: string | null): string {
    if (!raw) {
      return `${DEFAULT_BASE_URL}${CHAT_SUFFIX}`;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return `${DEFAULT_BASE_URL}${CHAT_SUFFIX}`;
    }

    if (/\/chat\/completions\b/i.test(trimmed)) {
      return trimmed;
    }

    const normalized = trimmed.endsWith('/')
      ? trimmed.slice(0, -1)
      : trimmed;
    return `${normalized}${CHAT_SUFFIX}`;
  }

  private ensureModelsEndpoint(raw?: string | null): string {
    if (!raw) {
      return `${DEFAULT_BASE_URL}${MODELS_SUFFIX}`;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return `${DEFAULT_BASE_URL}${MODELS_SUFFIX}`;
    }

    if (/\/models\b/i.test(trimmed)) {
      return trimmed;
    }

    if (/\/chat\/completions\b/i.test(trimmed)) {
      return trimmed.replace(/\/chat\/completions.*$/i, MODELS_SUFFIX);
    }

    const normalized = trimmed.endsWith('/')
      ? trimmed.slice(0, -1)
      : trimmed;
    return `${normalized}${MODELS_SUFFIX}`;
  }

  private async fetchRawConfig(includeKey = true) {
    const [enabled, apiUrl, apiKey, defaultModel, allowedModels, systemPrompt] = await Promise.all([
      systemConfigService.get(CONFIG_KEYS.enabled),
      systemConfigService.get(CONFIG_KEYS.apiUrl),
      includeKey ? systemConfigService.get(CONFIG_KEYS.apiKey) : Promise.resolve(null),
      systemConfigService.get(CONFIG_KEYS.defaultModel),
      systemConfigService.get(CONFIG_KEYS.allowedModels),
      systemConfigService.get(CONFIG_KEYS.systemPrompt)
    ] as const);

    return {
      enabled,
      apiUrl,
      apiKey,
      defaultModel,
      allowedModels,
      systemPrompt
    };
  }

  private parseConfigSummary(raw: Awaited<ReturnType<typeof this.fetchRawConfig>>, includeKey = false) {
    const apiUrl = this.toStringOrNull(raw.apiUrl);
    const baseUrl = this.normalizeBaseUrl(apiUrl);
    const chatEndpoint = this.ensureChatEndpoint(apiUrl ?? undefined);
    const modelsEndpoint = this.ensureModelsEndpoint(apiUrl ?? undefined);

    return {
      enabled: this.toBoolean(raw.enabled),
      apiUrl,
      baseUrl,
      chatEndpoint,
      modelsEndpoint,
      hasApiKey: includeKey ? Boolean(this.toStringOrNull(raw.apiKey)) : Boolean(raw.apiKey),
      defaultModel: this.toStringOrNull(raw.defaultModel),
      allowedModels: this.toStringArray(raw.allowedModels),
      systemPrompt: this.toStringOrNull(raw.systemPrompt),
      apiKey: includeKey ? this.toStringOrNull(raw.apiKey) : null
    };
  }

  async getConfigSummary(): Promise<AiHelperConfigSummary> {
    const raw = await this.fetchRawConfig(true);
    const parsed = this.parseConfigSummary(raw, true);
    return {
      enabled: parsed.enabled,
      apiUrl: parsed.apiUrl,
      baseUrl: parsed.baseUrl,
      chatEndpoint: parsed.chatEndpoint,
      modelsEndpoint: parsed.modelsEndpoint,
      hasApiKey: parsed.hasApiKey,
      defaultModel: parsed.defaultModel,
      allowedModels: parsed.allowedModels,
      systemPrompt: parsed.systemPrompt
    };
  }

  async getRuntimeConfig(overrides: TestOverrides = {}): Promise<AiHelperRuntimeConfig> {
    const raw = await this.fetchRawConfig(true);
    const parsed = this.parseConfigSummary(raw, true);
    const envKey = process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? null;
    const apiKey = this.toStringOrNull(overrides.apiKey) ?? parsed.apiKey ?? envKey;
    const apiUrl = this.toStringOrNull(overrides.apiUrl) ?? parsed.apiUrl;
    const baseUrl = this.normalizeBaseUrl(apiUrl);
    const chatEndpoint = this.ensureChatEndpoint(apiUrl ?? undefined);
    const modelsEndpoint = this.ensureModelsEndpoint(apiUrl ?? undefined);

    return {
      enabled: parsed.enabled,
      apiUrl,
      baseUrl,
      chatEndpoint,
      modelsEndpoint,
      apiKey,
      hasApiKey: Boolean(apiKey),
      defaultModel: parsed.defaultModel,
      allowedModels: parsed.allowedModels,
      systemPrompt: parsed.systemPrompt
    };
  }

  private parseModelsResponse(payload: Record<string, unknown>): AiModelInfo[] {
    const rawData =
      (Array.isArray((payload as { data?: unknown[] }).data)
        ? (payload as { data?: unknown[] }).data
        : null) ??
      (Array.isArray((payload as { models?: unknown[] }).models)
        ? (payload as { models?: unknown[] }).models
        : null) ??
      [];

    if (!Array.isArray(rawData)) {
      return [];
    }

    const normalized: AiModelInfo[] = [];

    for (const item of rawData) {
      if (!item || typeof item !== 'object') continue;
      const candidate = item as Record<string, unknown>;
      const id = this.toStringOrNull(candidate.id);
      if (!id) continue;

      const model: AiModelInfo = {
        id,
        name: this.toStringOrNull(candidate.name) ?? id
      };

      const owned = this.toStringOrNull(candidate.owned_by);
      if (owned) {
        model.ownedBy = owned;
      }

      const description =
        this.toStringOrNull(candidate.description) ?? this.toStringOrNull(candidate.object);
      if (description) {
        model.description = description;
      }

      normalized.push(model);
    }

    return normalized;
  }

  async testConnection(overrides: TestOverrides = {}): Promise<TestConnectionResult> {
    const runtime = await this.getRuntimeConfig(overrides);
    if (!runtime.apiKey) {
      throw new Error('AI助手API Key未配置');
    }

    const response = await this.httpClient.request({
      method: 'GET',
      url: runtime.modelsEndpoint,
      headers: {
        Authorization: `Bearer ${runtime.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeoutMs: 20000
    });

    const models = this.parseModelsResponse(response.data as Record<string, unknown>);
    return {
      models,
      baseUrl: runtime.baseUrl,
      chatEndpoint: runtime.chatEndpoint
    };
  }

  async saveConfig(payload: SaveConfigPayload, userId: string | null = null): Promise<void> {
    const category = 'ai_helper';

    if (payload.enabled !== undefined) {
      await systemConfigService.set(
        CONFIG_KEYS.enabled,
        Boolean(payload.enabled),
        'boolean',
        'AI助手开关',
        userId,
        { category }
      );
    }

    if (payload.apiUrl !== undefined) {
      const normalized = this.toStringOrNull(payload.apiUrl);
      await systemConfigService.set(
        CONFIG_KEYS.apiUrl,
        normalized,
        'string',
        'AI助手Base URL',
        userId,
        { category }
      );
    }

    if (payload.systemPrompt !== undefined) {
      await systemConfigService.set(
        CONFIG_KEYS.systemPrompt,
        this.toStringOrNull(payload.systemPrompt),
        'string',
        'AI助手系统提示词',
        userId,
        { category }
      );
    }

    if (payload.defaultModel !== undefined) {
      await systemConfigService.set(
        CONFIG_KEYS.defaultModel,
        this.toStringOrNull(payload.defaultModel),
        'string',
        'AI助手默认模型',
        userId,
        { category }
      );
    }

    if (payload.allowedModels !== undefined) {
      const uniqueModels = Array.from(
        new Set(this.toStringArray(payload.allowedModels))
      );
      await systemConfigService.set(
        CONFIG_KEYS.allowedModels,
        uniqueModels,
        'json',
        'AI助手允许的模型',
        userId,
        { category }
      );
    }

    if (payload.apiKey && payload.apiKey.trim().length > 0) {
      await systemConfigService.set(
        CONFIG_KEYS.apiKey,
        payload.apiKey.trim(),
        'secret',
        'AI助手API密钥',
        userId,
        { category, sensitive: true }
      );
    } else if (payload.resetApiKey) {
      await systemConfigService.set(
        CONFIG_KEYS.apiKey,
        null,
        'secret',
        'AI助手API密钥',
        userId,
        { category, sensitive: true }
      );
    }
  }
}

const aiHelperService = new AiHelperService();
export default aiHelperService;
