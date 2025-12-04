/**
 * Provider管理Controller
 * 艹，这个tm负责处理Provider配置的CRUD操作！
 */

import { Request, Response, NextFunction } from 'express';
import axios, { AxiosError, AxiosResponse } from 'axios';
import * as providerRepo from '../repositories/providerEndpoints.repo.js';
import type { ProviderEndpointInput } from '../repositories/providerEndpoints.repo.js';
import providerRegistryService from '../services/provider-registry.service.js';
import { decrypt, type EncryptedData } from '../utils/crypto.js';

/**
 * 审计日志条目类型
 */
interface AuditLogEntry {
  action: string;
  provider_ref: string;
  user_id: string | null;
  details: Record<string, unknown>;
}

const getUserIdOrNull = (req: Request): string | null => req.user?.id ?? null;

interface ProviderTestConfig {
  endpointUrl: string;
  authType: string;
  credentials: Record<string, string>;
  providerName?: string;
}

interface ProviderModelInfo {
  id: string;
  object?: string;
  owned_by?: string;
  [key: string]: unknown;
}

interface ProviderTestResult {
  healthy: boolean;
  message: string;
  latency: number;
  statusCode?: number;
  models?: ProviderModelInfo[];
}

const MODEL_PROVIDERS = ['openai', 'deepseek', 'anthropic', 'claude', 'qwen', 'moonshot'];

const buildModelProbeUrl = (endpointUrl: string): string | null => {
  try {
    const parsed = new URL(endpointUrl);
    const segments = parsed.pathname.split('/').filter(Boolean);
    let baseSegments: string[] = [];

    if (segments.length === 0) {
      baseSegments = ['v1'];
    } else {
      const versionIndex = segments.findIndex((seg) => /^v\d+/i.test(seg));
      if (versionIndex >= 0) {
        baseSegments = segments.slice(0, versionIndex + 1);
      } else {
        baseSegments = segments;
      }
    }

    // 如果最后一段已经是models，则直接使用
    if (baseSegments[baseSegments.length - 1] === 'models') {
      return parsed.toString();
    }

    const modelPath = [...baseSegments, 'models'].join('/');
    return `${parsed.origin}/${modelPath}`;
  } catch {
    return null;
  }
};

const normaliseCredentials = (raw: unknown): Record<string, string> => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    return { api_key: raw };
  }
  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const normalized: Record<string, string> = {};
    if (typeof record.api_key === 'string') {
      normalized.api_key = record.api_key;
    }
    if (typeof record.apiKey === 'string') {
      normalized.api_key = record.apiKey;
    }
    if (typeof record.token === 'string') {
      normalized.token = record.token;
    }
    if (typeof record.access_token === 'string') {
      normalized.token = record.access_token;
    }
    if (typeof record.username === 'string') {
      normalized.username = record.username;
    }
    if (typeof record.password === 'string') {
      normalized.password = record.password;
    }
    return normalized;
  }
  return {};
};

async function decryptCredentials(encrypted: unknown): Promise<Record<string, string>> {
  if (!encrypted) return {};

  if (typeof encrypted === 'object' && encrypted !== null && 'api_key' in encrypted) {
    return encrypted as Record<string, string>;
  }

  try {
    const encryptedData: EncryptedData =
      typeof encrypted === 'string'
        ? (JSON.parse(encrypted) as EncryptedData)
        : (encrypted as EncryptedData);

    if (!encryptedData?.ciphertext) {
      return {};
    }

    const decrypted = decrypt(encryptedData);
    return normaliseCredentials(JSON.parse(decrypted));
  } catch (error) {
    console.error('[ProviderController] 解密凭证失败:', error);
    return {};
  }
}

const buildAuthHeaders = (authType: string, credentials: Record<string, string>) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if ((authType === 'api_key' || authType === 'apikey') && credentials.api_key) {
    headers['Authorization'] = `Bearer ${credentials.api_key}`;
    headers['api-key'] = credentials.api_key;
    headers['X-API-Key'] = credentials.api_key;
  } else if (authType === 'bearer' && credentials.token) {
    headers['Authorization'] = `Bearer ${credentials.token}`;
  } else if (authType === 'basic' && credentials.username && credentials.password) {
    const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  return headers;
};

const extractModelList = (payload: unknown): ProviderModelInfo[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload as ProviderModelInfo[];
  }
  if (typeof payload === 'object') {
    const dataField = (payload as Record<string, unknown>).data;
    if (Array.isArray(dataField)) {
      return dataField as ProviderModelInfo[];
    }
    const modelsField = (payload as Record<string, unknown>).models;
    if (Array.isArray(modelsField)) {
      return modelsField as ProviderModelInfo[];
    }
  }
  return [];
};

const describeAxiosError = (error: AxiosError): string => {
  if (error.response) {
    return `HTTP ${error.response.status}`;
  }
  if (error.code === 'ECONNABORTED') {
    return '请求超时';
  }
  if (error.code === 'ECONNREFUSED') {
    return '连接被拒绝';
  }
  return error.message;
};

async function performProviderTest(config: ProviderTestConfig): Promise<ProviderTestResult> {
  const headers = buildAuthHeaders(config.authType, config.credentials);

  if (
    (config.authType === 'api_key' || config.authType === 'apikey') &&
    !config.credentials.api_key
  ) {
    return { healthy: false, message: '缺少 API Key，无法测试连接', latency: 0, models: [] };
  }
  if (config.authType === 'bearer' && !config.credentials.token) {
    return { healthy: false, message: '缺少 Bearer Token，无法测试连接', latency: 0, models: [] };
  }

  const urlCandidates: Array<{ url: string; purpose: 'models' | 'primary' }> = [];

  const lowerName = config.providerName?.toLowerCase() ?? '';
  const isKnownModelProvider =
    MODEL_PROVIDERS.some((keyword) => lowerName.includes(keyword)) ||
    MODEL_PROVIDERS.some((keyword) => config.endpointUrl.toLowerCase().includes(keyword));

  const probeUrl = isKnownModelProvider ? buildModelProbeUrl(config.endpointUrl) : null;
  if (probeUrl) {
    urlCandidates.push({ url: probeUrl, purpose: 'models' });
  }
  urlCandidates.push({ url: config.endpointUrl, purpose: 'primary' });

  let lastError: string | null = null;

  const isJsonResponse = (headersObj: Record<string, unknown>): boolean => {
    const headerValue =
      (headersObj['content-type'] as string | undefined) ||
      (headersObj['Content-Type'] as string | undefined) ||
      '';
    return headerValue.toLowerCase().includes('json');
  };

  for (const candidate of urlCandidates) {
    try {
      const start = Date.now();
      const response: AxiosResponse = await axios.get(candidate.url, {
        headers,
        timeout: 7000,
        validateStatus: (status) => status < 500
      });
      const latency = Date.now() - start;

      const jsonResponse = isJsonResponse(response.headers);
      const models = jsonResponse ? extractModelList(response.data) : [];

      if (response.status >= 200 && response.status < 400 && jsonResponse) {
        if (candidate.purpose === 'models' && models.length === 0) {
          lastError = '响应成功但未返回模型列表';
          continue;
        }
        return {
          healthy: true,
          message:
            candidate.purpose === 'models'
              ? `成功获取模型列表 (${response.status})`
              : `连接成功 (${response.status})`,
          latency,
          statusCode: response.status,
          models
        };
      }

      if (!jsonResponse) {
        lastError = '响应不是JSON格式，可能需要有效凭证';
        continue;
      }

      lastError = `连接异常 (HTTP ${response.status})`;
    } catch (error) {
      const err = error as AxiosError;
      lastError = describeAxiosError(err);
    }
  }

  // GET失败后尝试POST
  try {
    const start = Date.now();
    const response = await axios.post(
      config.endpointUrl,
      {},
      {
        headers,
        timeout: 7000,
        validateStatus: (status) => status < 500
      }
    );
    const latency = Date.now() - start;

    const jsonResponse = isJsonResponse(response.headers);
    const models = jsonResponse ? extractModelList(response.data) : [];

    if (response.status >= 200 && response.status < 400 && jsonResponse) {
      return {
        healthy: true,
        message: `连接成功 (${response.status})`,
        latency,
        statusCode: response.status,
        models
      };
    }

    lastError = jsonResponse
      ? `连接异常 (HTTP ${response.status})`
      : '响应不是JSON格式，可能需要有效凭证';
  } catch (error) {
    const err = error as AxiosError;
    lastError = describeAxiosError(err);
  }

  return {
    healthy: false,
    message: lastError ?? '连接失败',
    latency: 0,
    models: []
  };
}

/**
 * Provider管理控制器
 */
export class ProvidersController {
  /**
   * 列出所有Provider端点
   * GET /admin/providers?limit=100&offset=0&auth_type=api_key
   */
  async listProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 100, offset = 0, auth_type: authType } = req.query;

      // 调用仓储层
      const providers = await providerRepo.listProviderEndpoints({
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        authType: authType as string | undefined
      });

      // 获取总数（艹，简单粗暴直接查一次）
      const allProviders = await providerRepo.listProviderEndpoints({
        limit: 10000, // 足够大
        offset: 0,
        authType: authType as string | undefined
      });

      res.json({
        success: true,
        data: {
          items: providers,
          total: allProviders.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[ProvidersController] 列出Provider失败: ${err.message}`);
      next(err);
    }
  }

  /**
   * 获取单个Provider端点
   * GET /admin/providers/:provider_ref
   */
  async getProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider_ref } = req.params;

      const provider = await providerRepo.getProviderEndpoint(provider_ref);

      if (!provider) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Provider端点不存在: ${provider_ref}`
          }
        });
        return;
      }

      res.json({
        success: true,
        data: provider
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[ProvidersController] 获取Provider失败: ${err.message}`);
      next(err);
    }
  }

  /**
   * 创建Provider端点
   * POST /admin/providers
   */
  async createProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: ProviderEndpointInput = req.body;

      // 验证输入（艹，基础校验）
      const validationError = this.validateProviderInput(input, true);
      if (validationError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationError
          }
        });
        return;
      }

      // 检查是否已存在
      const exists = await providerRepo.providerEndpointExists(input.provider_ref);
      if (exists) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: `Provider引用ID已存在: ${input.provider_ref}`
          }
        });
        return;
      }

      // 创建Provider
      const created = await providerRepo.createProviderEndpoint(input);

      // 记录审计日志
      await this.recordAuditLog({
        action: 'CREATE',
        provider_ref: created.provider_ref,
        user_id: getUserIdOrNull(req),
        details: { provider_name: created.provider_name }
      });

      res.status(201).json({
        success: true,
        data: created
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[ProvidersController] 创建Provider失败: ${err.message}`);
      next(err);
    }
  }

  /**
   * 更新Provider端点
   * PUT /admin/providers/:provider_ref
   */
  async updateProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider_ref } = req.params;
      const updates: Partial<ProviderEndpointInput> = req.body;

      // 验证输入
      const validationError = this.validateProviderInput(updates, false);
      if (validationError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationError
          }
        });
        return;
      }

      // 更新Provider
      try {
        const updated = await providerRepo.updateProviderEndpoint(provider_ref, updates);

        // 记录审计日志
        await this.recordAuditLog({
          action: 'UPDATE',
          provider_ref: updated.provider_ref,
          user_id: getUserIdOrNull(req),
          details: updates
        });

        res.json({
          success: true,
          data: updated
        });
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message.includes('不存在')) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: err.message
            }
          });
          return;
        }
        throw err;
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[ProvidersController] 更新Provider失败: ${err.message}`);
      next(err);
    }
  }

  /**
   * 删除Provider端点
   * DELETE /admin/providers/:provider_ref
   */
  async deleteProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider_ref } = req.params;

      const deleted = await providerRepo.deleteProviderEndpoint(provider_ref);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Provider端点不存在: ${provider_ref}`
          }
        });
        return;
      }

      // 记录审计日志
      await this.recordAuditLog({
        action: 'DELETE',
        provider_ref,
        user_id: getUserIdOrNull(req),
        details: {}
      });

      res.json({
        success: true,
        message: 'Provider端点已删除'
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[ProvidersController] 删除Provider失败: ${err.message}`);
      next(err);
    }
  }

  /**
   * 校验未保存的Provider配置
   * POST /admin/providers/test-config
   */
  async testProviderConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { endpoint_url, auth_type, credentials, provider_name } = req.body as {
        endpoint_url: string;
        auth_type: string;
        credentials: Record<string, string>;
        provider_name?: string;
      };

      const testResult = await performProviderTest({
        endpointUrl: endpoint_url,
        authType: auth_type,
        credentials: credentials ?? {},
        providerName: provider_name
      });

      res.json({
        success: true,
        data: {
          healthy: testResult.healthy,
          message: testResult.message,
          latency: testResult.latency,
          models: testResult.models ?? [],
          tested_at: new Date().toISOString()
        }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[ProvidersController] 即时测试失败: ${err.message}`);
      next(err);
    }
  }

  /**
   * 测试Provider连接
   * POST /admin/providers/:provider_ref/test-connection
   */
  async testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider_ref } = req.params;

      // 获取Provider配置
      const provider = await providerRepo.getProviderEndpoint(provider_ref);

      if (!provider) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Provider端点不存在: ${provider_ref}`
          }
        });
        return;
      }

      const creds = await decryptCredentials(provider.credentials_encrypted);
      const testResult = await performProviderTest({
        endpointUrl: provider.endpoint_url,
        authType: provider.auth_type,
        credentials: creds,
        providerName: provider.provider_name
      });

      if (testResult.models && testResult.models.length > 0) {
        try {
          await providerRepo.updateProviderEndpoint(provider_ref, {
            model_catalog: testResult.models
          });
        } catch (updateError) {
          console.warn('[ProvidersController] 更新模型列表失败', updateError);
        }
      }

      // 记录审计日志
      await this.recordAuditLog({
        action: 'TEST_CONNECTION',
        provider_ref,
        user_id: getUserIdOrNull(req),
        details: {
          healthy: testResult.healthy,
          message: testResult.message,
          latency: testResult.latency
        }
      });

      res.json({
        success: true,
        data: {
          healthy: testResult.healthy,
          message: testResult.message,
          latency: testResult.latency,
          models: testResult.models ?? [],
          tested_at: new Date().toISOString()
        }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[ProvidersController] 测试连接失败: ${err.message}`);
      next(err);
    }
  }

  /**
   * 更新Provider凭证（API Key）
   * PUT /admin/providers/:provider_ref/credentials
   * 艹！专门用于更新API Key，不影响其他配置！
   */
  async updateProviderCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider_ref } = req.params;
      const { credentials } = req.body as { credentials?: string };

      // 验证输入
      if (!credentials || typeof credentials !== 'string' || credentials.trim() === '') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '凭证不能为空'
          }
        });
        return;
      }

      // 更新凭证（Repository会自动加密）
      const updated = await providerRepo.updateProviderEndpoint(provider_ref, {
        credentials: credentials.trim()
      });

      // 记录审计日志（艹！不记录实际凭证，只记录操作）
      await this.recordAuditLog({
        action: 'UPDATE_CREDENTIALS',
        provider_ref: updated.provider_ref,
        user_id: getUserIdOrNull(req),
        details: { updated_at: new Date().toISOString() }
      });

      res.json({
        success: true,
        data: {
          provider_ref: updated.provider_ref,
          provider_name: updated.provider_name,
          updated_at: updated.updated_at
        },
        message: 'Provider凭证已更新'
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.message.includes('不存在')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: err.message
          }
        });
        return;
      }
      console.error(`[ProvidersController] 更新凭证失败: ${err.message}`);
      next(err);
    }
  }

  /**
   * 获取所有Provider的健康状态
   * GET /admin/providers/health
   * 艹！从provider-registry服务获取实时健康数据！
   */
  async getProviderHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 获取健康检查结果
      const healthCheck = await providerRegistryService.healthCheck();

      // 获取所有已注册的Provider列表
      const registeredProviders = providerRegistryService.getRegisteredProviders();

      res.json({
        success: true,
        data: {
          ...healthCheck,
          registeredProviders
        }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[ProvidersController] 获取健康状态失败: ${err.message}`);
      next(err);
    }
  }

  /**
   * 验证Provider输入
   * @param input - 输入数据
   * @param requireAll - 是否要求所有必填字段
   * @returns 错误信息，如果没有错误则返回null
   */
  private validateProviderInput(
    input: Partial<ProviderEndpointInput>,
    requireAll: boolean
  ): string | null {
    if (requireAll) {
      if (!input.provider_ref) {
        return '缺少必填字段: provider_ref';
      }
      if (!input.provider_name) {
        return '缺少必填字段: provider_name';
      }
      if (!input.endpoint_url) {
        return '缺少必填字段: endpoint_url';
      }
      if (!input.credentials) {
        return '缺少必填字段: credentials';
      }
      if (!input.auth_type) {
        return '缺少必填字段: auth_type';
      }
    }

    // provider_ref格式校验
    if (input.provider_ref) {
      if (!/^[a-zA-Z0-9_-]+$/.test(input.provider_ref)) {
        return 'provider_ref只能包含字母、数字、下划线和短横线';
      }
      if (input.provider_ref.length > 100) {
        return 'provider_ref长度不能超过100字符';
      }
    }

    // provider_name长度校验
    if (input.provider_name && input.provider_name.length > 200) {
      return 'provider_name长度不能超过200字符';
    }

    // endpoint_url长度校验
    if (input.endpoint_url && input.endpoint_url.length > 500) {
      return 'endpoint_url长度不能超过500字符';
    }

    // auth_type枚举校验
    if (input.auth_type) {
      const validAuthTypes = ['api_key', 'bearer', 'basic', 'oauth2'];
      if (!validAuthTypes.includes(input.auth_type)) {
        return `auth_type必须是以下之一: ${validAuthTypes.join(', ')}`;
      }
    }

    if (input.default_model && input.default_model.length > 200) {
      return 'default_model长度不能超过200字符';
    }

    return null;
  }

  /**
   * 记录审计日志
   * 艹，这个tm很重要，所有操作都要记录！
   */
  private async recordAuditLog(log: AuditLogEntry): Promise<void> {
    try {
      // 艹，这里应该写入provider_audit_logs表
      // 但先用console.log代替（后续实现审计日志表后再完善）
      console.log('[AUDIT] Provider操作日志:', {
        ...log,
        timestamp: new Date().toISOString()
      });

      // TODO: 后续实现审计日志表后，写入数据库
      // await db('provider_audit_logs').insert({
      //   action: log.action,
      //   provider_ref: log.provider_ref,
      //   user_id: log.user_id,
      //   details: JSON.stringify(log.details),
      //   created_at: new Date(),
      // });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[AUDIT] 记录审计日志失败:', err.message);
      // 艹，审计日志失败不应该影响主流程
    }
  }
}

// 导出单例实例
export default new ProvidersController();
