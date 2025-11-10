import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { ERROR_CODES } from '../config/error-codes.js';

type FeatureKey =
  | 'image_enhance'
  | 'image_generate'
  | 'image_edit'
  | 'text_generate'
  | 'text_translate'
  | 'text_summarize'
  | 'audio_transcribe'
  | 'video_analyze'
  | 'data_analyze'
  | (string & {});

interface RateLimitState {
  requests: number;
  window: number;
  current: number;
  resetTime: number;
}

interface AdaptorStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  averageResponseTime: number;
  lastRequestTime: Date | null;
  errorsByType: Record<string, number>;
}

interface BuildingAIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CallOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

class BuildingAIAdaptorService {
  private initialized = false;
  private readonly baseURL: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;
  private httpClient?: AxiosInstance;
  private rateLimit: RateLimitState;
  private stats: AdaptorStats;
  private readonly featureMapping: Record<string, string>;

  constructor() {
    this.baseURL = process.env.BUILDING_AI_BASE_URL || 'https://api.buildingai.com';
    this.apiKey = process.env.BUILDING_AI_API_KEY;
    this.timeout = Number.parseInt(process.env.BUILDING_AI_TIMEOUT ?? '', 10) || 30000;
    this.retryAttempts = Number.parseInt(process.env.BUILDING_AI_RETRY_ATTEMPTS ?? '', 10) || 3;
    this.retryDelay = Number.parseInt(process.env.BUILDING_AI_RETRY_DELAY ?? '', 10) || 1000;

    this.rateLimit = {
      requests: Number.parseInt(process.env.BUILDING_AI_RATE_LIMIT ?? '', 10) || 100,
      window: Number.parseInt(process.env.BUILDING_AI_RATE_WINDOW ?? '', 10) || 60000,
      current: 0,
      resetTime: Date.now() + 60000
    };

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      lastRequestTime: null,
      errorsByType: {}
    };

    this.featureMapping = {
      image_enhance: '/v1/image/enhance',
      image_generate: '/v1/image/generate',
      image_edit: '/v1/image/edit',
      text_generate: '/v1/text/generate',
      text_translate: '/v1/text/translate',
      text_summarize: '/v1/text/summarize',
      audio_transcribe: '/v1/audio/transcribe',
      video_analyze: '/v1/video/analyze',
      data_analyze: '/v1/data/analyze'
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('[BuildingAIAdaptor] Initializing BuildingAI adaptor service...');
      this.validateConfiguration();

      this.httpClient = axios.create({
        baseURL: this.baseURL,
        timeout: this.timeout,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Photo-Processor/1.0'
        }
      });

      this.setupInterceptors();
      await this.testConnection();

      this.initialized = true;
      logger.info('[BuildingAIAdaptor] BuildingAI adaptor service initialized successfully');
    } catch (error: unknown) {
      logger.error('[BuildingAIAdaptor] Failed to initialize BuildingAI adaptor service:', error);
      throw error;
    }
  }

  private validateConfiguration(): void {
    if (!this.apiKey) {
      throw new Error('BUILDING_AI_API_KEY is required');
    }
    if (!this.baseURL) {
      throw new Error('BUILDING_AI_BASE_URL is required');
    }
    new URL(this.baseURL);
  }

  private setupInterceptors(): void {
    if (!this.httpClient) return;

    this.httpClient.interceptors.request.use((config) => {
      const headers = config.headers ?? {};
      headers['X-Request-ID'] = crypto.randomUUID();
      headers['X-Request-Time'] = new Date().toISOString();
      config.headers = headers;
      (config as AxiosRequestConfig & { metadata?: { startTime: number } }).metadata = {
        startTime: Date.now()
      };
      return config;
    });

    this.httpClient.interceptors.response.use(
      (response) => {
        const metadata = (response.config as { metadata?: { startTime: number } }).metadata;
        const startTime = metadata?.startTime ?? Date.now();
        this.updateStats(Date.now() - startTime, true);
        return response;
      },
      (error: AxiosError) => {
        const config = error.config as { metadata?: { startTime: number } } | undefined;
        const startTime = config?.metadata?.startTime ?? Date.now();
        this.updateStats(Date.now() - startTime, false, error);
        return Promise.reject(error);
      }
    );
  }

  private async testConnection(): Promise<void> {
    if (!this.httpClient) {
      throw new Error('HTTP client not initialized');
    }

    try {
      await this.httpClient.get('/v1/ping');
      logger.info('[BuildingAIAdaptor] Connection test successful');
    } catch (error: unknown) {
      logger.warn('[BuildingAIAdaptor] Connection test failed, continuing anyway', error);
    }
  }

  async callAPI<T = unknown>(
    feature: FeatureKey,
    payload: Record<string, unknown>,
    options: CallOptions = {}
  ): Promise<BuildingAIResponse<T>> {
    if (!this.initialized) {
      await this.initialize();
    }

    const endpoint = this.featureMapping[feature] || `/v1/${feature.replace('_', '/')}`;
    const httpClient = this.httpClient;
    if (!httpClient) {
      throw new Error('HTTP client is not available');
    }

    await this.ensureRateLimit();

    const config: AxiosRequestConfig = {
      method: 'post',
      url: endpoint,
      data: payload,
      timeout: options.timeout ?? this.timeout
    };

    const retries = options.retries ?? this.retryAttempts;
    const retryDelay = options.retryDelay ?? this.retryDelay;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const requestStart = Date.now();
      try {
        const response = await httpClient.request<BuildingAIResponse<T>>(config);
        return this.mapResponse(response, feature);
      } catch (error: unknown) {
        const axiosError = error as AxiosError;
        const shouldRetry = this.shouldRetry(axiosError, attempt, retries);
        if (!shouldRetry) {
          throw this.handleAxiosError(axiosError, feature);
        }
        const delay = retryDelay * Math.pow(2, attempt);
        logger.warn(`[BuildingAIAdaptor] Retrying ${feature} request in ${delay}ms`, {
          attempt,
          retries
        });
        await this.sleep(delay);
        this.updateStats(Date.now() - requestStart, false, axiosError);
      }
    }

    throw AppError.create(ERROR_CODES.EXTERNAL_SERVICE_ERROR, {
      feature,
      service: 'BuildingAI',
      details: 'Maximum retry attempts exceeded'
    });
  }

  private async ensureRateLimit(): Promise<void> {
    const now = Date.now();
    if (now >= this.rateLimit.resetTime) {
      this.rateLimit.current = 0;
      this.rateLimit.resetTime = now + this.rateLimit.window;
    }

    if (this.rateLimit.current >= this.rateLimit.requests) {
      await this.waitForRateLimitReset();
    }

    this.rateLimit.current += 1;
  }

  private async waitForRateLimitReset(): Promise<void> {
    const delay = Math.max(0, this.rateLimit.resetTime - Date.now());
    logger.warn(`[BuildingAIAdaptor] Rate limit reached, waiting ${delay}ms`);
    await this.sleep(delay);
  }

  private mapResponse<T>(
    response: AxiosResponse<BuildingAIResponse<T>>,
    feature: FeatureKey
  ): BuildingAIResponse<T> {
    const { data } = response;
    if (data?.success === false) {
      const message = data.error ?? 'BuildingAI returned an error';
      throw AppError.create(ERROR_CODES.EXTERNAL_SERVICE_ERROR, {
        feature,
        service: 'BuildingAI',
        details: message
      });
    }
    return data;
  }

  private shouldRetry(error: AxiosError, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) {
      return false;
    }
    if (error.response) {
      const status = error.response.status;
      return status >= 500 || status === 429;
    }
    if (error.code) {
      return ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'].includes(error.code);
    }
    return false;
  }

  private handleAxiosError(error: AxiosError, feature: FeatureKey): AppError {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as { message?: string } | undefined;

      switch (status) {
        case 400:
          return AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
            feature,
            service: 'BuildingAI',
            details: data?.message ?? 'Invalid parameters'
          });
        case 401:
          return AppError.create(ERROR_CODES.UNAUTHORIZED, {
            feature,
            service: 'BuildingAI',
            details: 'Unauthorized'
          });
        case 403:
          return AppError.create(ERROR_CODES.PERMISSION_DENIED, {
            feature,
            service: 'BuildingAI',
            details: 'Forbidden'
          });
        case 404:
          return AppError.create(ERROR_CODES.RESOURCE_ACCESS_DENIED, {
            feature,
            service: 'BuildingAI',
            details: 'Resource not found'
          });
        case 429:
          return AppError.create(ERROR_CODES.RATE_LIMIT_EXCEEDED, {
            feature,
            service: 'BuildingAI'
          });
        case 500:
          return AppError.create(ERROR_CODES.EXTERNAL_SERVICE_ERROR, {
            feature,
            service: 'BuildingAI',
            details: 'Internal server error'
          });
        case 502:
          return AppError.create(ERROR_CODES.EXTERNAL_SERVICE_ERROR, {
            feature,
            service: 'BuildingAI',
            details: 'Bad gateway'
          });
        case 503:
          return AppError.create(ERROR_CODES.SERVICE_UNAVAILABLE, {
            feature,
            service: 'BuildingAI',
            details: 'Service unavailable'
          });
        default:
          return AppError.create(ERROR_CODES.EXTERNAL_SERVICE_ERROR, {
            feature,
            service: 'BuildingAI',
            status,
            details: data?.message ?? `HTTP ${status}`
          });
      }
    }

    if (error.request) {
      return AppError.create(ERROR_CODES.CONNECTION_FAILED, {
        feature,
        service: 'BuildingAI',
        details: 'Network connection failed'
      });
    }

    return AppError.fromError(error, ERROR_CODES.EXTERNAL_SERVICE_ERROR, {
      feature,
      service: 'BuildingAI'
    });
  }

  private updateStats(responseTime: number, success: boolean, error?: AxiosError): void {
    this.stats.totalRequests += 1;
    this.stats.lastRequestTime = new Date();

    if (success) {
      this.stats.successfulRequests += 1;
    } else {
      this.stats.failedRequests += 1;
      const errorType = error?.response?.status?.toString() ?? 'network';
      this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
    }

    this.stats.totalResponseTime += responseTime;
    this.stats.averageResponseTime = this.stats.totalResponseTime / this.stats.totalRequests;
  }

  getSupportedFeatures(): string[] {
    return Object.keys(this.featureMapping);
  }

  getStats(): Record<string, unknown> {
    return {
      ...this.stats,
      initialized: this.initialized,
      rateLimit: {
        current: this.rateLimit.current,
        limit: this.rateLimit.requests,
        window: this.rateLimit.window / 1000,
        resetTime: new Date(this.rateLimit.resetTime)
      },
      supportedFeatures: this.getSupportedFeatures()
    };
  }

  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      lastRequestTime: null,
      errorsByType: {}
    };
    logger.info('[BuildingAIAdaptor] Statistics reset');
  }

  async close(): Promise<void> {
    try {
      this.initialized = false;
      logger.info('[BuildingAIAdaptor] BuildingAI adaptor service closed');
    } catch (error: unknown) {
      logger.error('[BuildingAIAdaptor] Error closing BuildingAI adaptor service:', error);
    }
  }

  private sleep(duration: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, duration));
  }
}

const buildingAIAdaptorService = new BuildingAIAdaptorService();
export default buildingAIAdaptorService;
