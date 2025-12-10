/**
 * 统一配置管理器
 * 提供统一的配置访问接口，支持配置分层加载和验证
 *
 * 配置加载优先级：
 * 1. systemConfig (数据库动态配置) - 可运行时修改
 * 2. process.env (环境变量)
 * 3. defaultConfig (默认值)
 */

import { z } from 'zod';
import logger from '../utils/logger.js';
import { ConfigSchema, REQUIRED_PRODUCTION_FIELDS, SENSITIVE_FIELDS, type AppConfig } from './config.schema.js';

// 动态导入，避免循环依赖
let systemConfigService: typeof import('../services/systemConfig.service.js').default | null = null;

/**
 * 配置管理器类
 */
class ConfigManager {
  private config: AppConfig | null = null;
  private isInitialized = false;
  private dynamicConfigEnabled = false;

  /**
   * 初始化配置管理器
   * 必须在应用启动时调用
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('[ConfigManager] 配置管理器已初始化，跳过重复初始化');
      return;
    }

    try {
      logger.info('[ConfigManager] 开始初始化配置管理器...');

      // 1. 加载环境变量
      const rawConfig = this.loadEnvironmentVariables();

      // 2. 验证配置
      const validationResult = ConfigSchema.safeParse(rawConfig);

      if (!validationResult.success) {
        this.handleValidationError(validationResult.error);
        throw new Error('配置验证失败');
      }

      this.config = validationResult.data;

      // 3. 生产环境必需字段检查
      if (this.config.NODE_ENV === 'production') {
        this.validateProductionConfig();
      }

      // 4. 敏感配置安全检查
      this.validateSensitiveConfig();

      // 5. 尝试启用动态配置
      await this.initializeDynamicConfig();

      this.isInitialized = true;
      logger.info('[ConfigManager] ✅ 配置管理器初始化完成', {
        env: this.config.NODE_ENV,
        dynamicConfigEnabled: this.dynamicConfigEnabled
      });

      // 6. 打印配置摘要（脱敏）
      this.printConfigSummary();
    } catch (error) {
      logger.error('[ConfigManager] ❌ 配置管理器初始化失败', error);
      throw error;
    }
  }

  /**
   * 获取配置值
   * @param key 配置键
   * @param defaultValue 默认值
   * @param useDynamic 是否使用动态配置
   */
  async get<T = string>(
    key: keyof AppConfig,
    defaultValue?: T,
    useDynamic = true
  ): Promise<T | undefined> {
    this.ensureInitialized();

    // 1. 尝试从动态配置获取（优先级最高）
    if (useDynamic && this.dynamicConfigEnabled && systemConfigService) {
      try {
        const dynamicValue = await systemConfigService.get<T>(key as string);
        if (dynamicValue !== null && dynamicValue !== undefined) {
          return dynamicValue as T | undefined;
        }
      } catch (error) {
        logger.debug(`[ConfigManager] 动态配置获取失败: ${String(key)}`, error);
      }
    }

    // 2. 从静态配置获取
    const staticValue = this.config?.[key];
    if (staticValue !== undefined && staticValue !== null) {
      return staticValue as T;
    }

    // 3. 返回默认值
    return defaultValue;
  }

  /**
   * 获取必需配置值
   * 如果配置不存在，抛出异常
   */
  async getRequired<T = string>(key: keyof AppConfig, useDynamic = true): Promise<T> {
    const value = await this.get<T>(key, undefined, useDynamic);

    if (value === undefined || value === null) {
      throw new Error(`必需配置缺失: ${String(key)}`);
    }

    return value;
  }

  /**
   * 获取字符串配置
   */
  async getString(key: keyof AppConfig, defaultValue = '', useDynamic = true): Promise<string> {
    const value = await this.get(key, defaultValue, useDynamic);
    return String(value ?? defaultValue);
  }

  /**
   * 获取数字配置
   */
  async getNumber(key: keyof AppConfig, defaultValue = 0, useDynamic = true): Promise<number> {
    const value = await this.get(key, defaultValue, useDynamic);
    return typeof value === 'number' ? value : Number(value) || defaultValue;
  }

  /**
   * 获取布尔配置
   */
  async getBoolean(key: keyof AppConfig, defaultValue = false, useDynamic = true): Promise<boolean> {
    const value = await this.get(key, defaultValue, useDynamic) as unknown;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return defaultValue;
  }

  /**
   * 获取JSON配置
   */
  async getJSON<T = unknown>(key: keyof AppConfig, defaultValue: T, useDynamic = true): Promise<T> {
    const value = await this.get(key, undefined, useDynamic);
    if (typeof value === 'object') return value as T;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  /**
   * 获取所有配置（脱敏）
   */
  getAll(): Partial<AppConfig> {
    this.ensureInitialized();
    return this.maskSensitiveConfig(this.config!);
  }

  /**
   * 获取原始配置（包含敏感信息，仅供内部使用）
   */
  getRaw(): AppConfig {
    this.ensureInitialized();
    return this.config!;
  }

  /**
   * 检查配置是否存在
   */
  has(key: keyof AppConfig): boolean {
    this.ensureInitialized();
    const value = this.config?.[key];
    return value !== undefined && value !== null && value !== '';
  }

  /**
   * 重新加载配置
   */
  async reload(): Promise<void> {
    this.isInitialized = false;
    this.config = null;
    await this.initialize();
  }

  /**
   * 私有方法：加载环境变量
   */
  private loadEnvironmentVariables(): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    // 从process.env加载所有配置
    for (const key of Object.keys(ConfigSchema.shape)) {
      const envValue = process.env[key];
      if (envValue !== undefined) {
        config[key] = envValue;
      }
    }

    return config;
  }

  /**
   * 私有方法：处理验证错误
   */
  private handleValidationError(error: z.ZodError): void {
    logger.error('[ConfigManager] 配置验证失败:');
    error.issues.forEach((err: z.ZodIssue) => {
      logger.error(`  - ${err.path.join('.')}: ${err.message}`);
    });

    // 列出缺失的必需字段
    const missingFields = error.issues
      .filter((err: z.ZodIssue) => err.code === 'invalid_type' && (err as any).received === 'undefined')
      .map((err: z.ZodIssue) => err.path.join('.'));

    if (missingFields.length > 0) {
      logger.error('[ConfigManager] 缺失的必需配置:', missingFields);
    }
  }

  /**
   * 私有方法：验证生产环境配置
   */
  private validateProductionConfig(): void {
    const missingFields: string[] = [];

    for (const field of REQUIRED_PRODUCTION_FIELDS) {
      const value = this.config?.[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      throw new Error(
        `生产环境缺少必需配置: ${missingFields.join(', ')}\n` +
        '请在.env文件或环境变量中配置这些字段'
      );
    }
  }

  /**
   * 私有方法：验证敏感配置
   */
  private validateSensitiveConfig(): void {
    const warnings: string[] = [];

    // 检查是否使用了示例值
    const dangerousDefaults = [
      'your_jwt_secret_key_change_this_in_production',
      'your_password',
      'your_secret_key',
      'change_this'
    ];

    for (const field of SENSITIVE_FIELDS) {
      const value = this.config?.[field];
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        for (const dangerous of dangerousDefaults) {
          if (lowerValue.includes(dangerous)) {
            warnings.push(`${field} 使用了示例值，请修改为实际密钥`);
            break;
          }
        }

        // 检查密钥长度
        if (field.includes('SECRET') || field.includes('KEY')) {
          if (value.length < 16) {
            warnings.push(`${field} 长度过短（${value.length}字符），建议至少32字符`);
          }
        }
      }
    }

    if (warnings.length > 0 && this.config?.NODE_ENV === 'production') {
      logger.warn('[ConfigManager] ⚠️  生产环境配置安全警告:');
      warnings.forEach((warning) => logger.warn(`  - ${warning}`));
    }
  }

  /**
   * 私有方法：初始化动态配置
   */
  private async initializeDynamicConfig(): Promise<void> {
    try {
      // 动态导入systemConfig服务（避免循环依赖）
      const module = await import('../services/systemConfig.service.js');
      systemConfigService = module.default;
      this.dynamicConfigEnabled = true;
      logger.info('[ConfigManager] 动态配置服务已启用');
    } catch (error) {
      logger.warn('[ConfigManager] 动态配置服务未启用', error);
      this.dynamicConfigEnabled = false;
    }
  }

  /**
   * 私有方法：打印配置摘要
   */
  private printConfigSummary(): void {
    if (this.config?.LOG_LEVEL === 'debug' || this.config?.NODE_ENV === 'development') {
      const summary = {
        环境: this.config.NODE_ENV,
        服务端口: this.config.PORT,
        数据库: `${this.config.DB_HOST}:${this.config.DB_PORT}/${this.config.DB_NAME}`,
        Redis: `${this.config.REDIS_HOST}:${this.config.REDIS_PORT}`,
        JWT过期时间: this.config.JWT_ACCESS_EXPIRES_IN,
        日志级别: this.config.LOG_LEVEL
      };

      logger.info('[ConfigManager] 配置摘要:', summary);
    }
  }

  /**
   * 私有方法：脱敏敏感配置
   */
  private maskSensitiveConfig(config: AppConfig): Partial<AppConfig> {
    const masked = { ...config };

    for (const field of SENSITIVE_FIELDS) {
      if (masked[field]) {
        const value = String(masked[field]);
        // 显示前3个和后3个字符，中间用*替代
        if (value.length > 10) {
          masked[field] = `${value.slice(0, 3)}${'*'.repeat(value.length - 6)}${value.slice(-3)}` as never;
        } else {
          masked[field] = '***' as never;
        }
      }
    }

    return masked;
  }

  /**
   * 私有方法：确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.config) {
      throw new Error('ConfigManager未初始化，请先调用 initialize() 方法');
    }
  }
}

/**
 * 导出单例实例
 */
export const configManager = new ConfigManager();
export default configManager;
