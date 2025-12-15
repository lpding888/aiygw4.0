/**
 * 统一配置Schema定义
 * 使用Zod进行配置验证，确保所有必需配置在启动时验证
 */

import { z } from 'zod';

/**
 * 环境类型
 */
const NodeEnvSchema = z.enum(['development', 'production', 'test', 'staging']).default('development');

/**
 * 服务器配置
 */
const ServerConfigSchema = z.object({
  NODE_ENV: NodeEnvSchema,
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),
  API_PREFIX: z.string().default('/api')
});

/**
 * 数据库配置
 */
const DatabaseConfigSchema = z.object({
  DB_HOST: z.string().min(1, '数据库主机地址不能为空'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1, '数据库用户名不能为空'),
  DB_PASSWORD: z.string().min(1, '数据库密码不能为空'),
  DB_NAME: z.string().min(1, '数据库名称不能为空'),
  DATABASE_POOL_MIN: z.coerce.number().int().min(1).default(5),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(200).default(40),
  DATABASE_POOL_IDLE: z.coerce.number().int().min(1000).default(30000),
  DATABASE_POOL_ACQUIRE_TIMEOUT: z.coerce.number().int().min(1000).default(10000),
  // 慢查询阈值（毫秒），超过此时间的查询会被记录
  SLOW_QUERY_THRESHOLD_MS: z.coerce.number().int().min(100).default(1000)
});

/**
 * Redis配置
 */
const RedisConfigSchema = z.object({
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().int().min(0).max(15).default(0),
  REDIS_BULLMQ_DB: z.coerce.number().int().min(0).max(15).default(2),
  REDIS_URL: z.string().url().optional()
});

/**
 * BullMQ配置
 */
const BullMQConfigSchema = z.object({
  BULLMQ_PREFIX: z.string().default('ai_photo'),
  BULLMQ_KEEP_COMPLETED_SECONDS: z.coerce.number().int().min(60).default(86400), // 24小时
  BULLMQ_KEEP_COMPLETED_COUNT: z.coerce.number().int().min(100).default(1000),
  BULLMQ_KEEP_FAILED_COUNT: z.coerce.number().int().min(100).default(500),
  BULLMQ_DEFAULT_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  ENABLE_BULL_BOARD: z.coerce.boolean().default(false),
  BULL_BOARD_READONLY: z.coerce.boolean().default(true),
  BULL_BOARD_USERNAME: z.string().default('admin'),
  BULL_BOARD_PASSWORD: z.string().optional(),
  BULL_BOARD_WHITELIST_IPS: z.string().optional()
});

/**
 * JWT配置
 */
const JWTConfigSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT密钥长度必须至少32个字符'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_EXPIRE: z.string().default('7d') // 兼容旧字段
});

/**
 * 加密配置
 */
const EncryptionConfigSchema = z.object({
  ENCRYPTION_KEY_V1: z.string().min(32, '加密密钥V1长度必须至少32个字符'),
  ENCRYPTION_KEY_V2: z.string().min(32).optional(),
  ENCRYPTION_ALGORITHM: z.string().default('aes-256-gcm')
});

/**
 * 腾讯云COS配置
 */
const COSConfigSchema = z.object({
  COS_SECRET_ID: z.string().optional(),
  COS_SECRET_KEY: z.string().optional(),
  COS_BUCKET: z.string().min(1, 'COS Bucket不能为空'),
  COS_REGION: z.string().min(1, 'COS Region不能为空'),
  COS_DOMAIN: z.string().url().optional()
});

/**
 * SMTP邮件配置
 */
const SMTPConfigSchema = z.object({
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().email().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().default('AI衣柜')
});

/**
 * 短信服务配置 (腾讯云SMS)
 */
const SMSConfigSchema = z.object({
  SMS_SECRET_ID: z.string().optional(),
  SMS_SECRET_KEY: z.string().optional(),
  SMS_SDK_APP_ID: z.string().optional(),
  SMS_SIGN_NAME: z.string().optional(),
  SMS_TEMPLATE_CODE: z.string().optional()
});

/**
 * LLM服务配置
 */
const LLMConfigSchema = z.object({
  // DeepSeek
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_API_URL: z.string().url().default('https://api.deepseek.com/chat/completions'),

  // Hunyuan
  HUNYUAN_API_KEY: z.string().optional(),
  HUNYUAN_API_SECRET: z.string().optional(),

  // 快手AI
  KUAI_API_KEY: z.string().optional(),

  // RunningHub
  RUNNINGHUB_API_KEY: z.string().optional(),

  // 腾讯云
  TENCENT_SECRET_ID: z.string().optional(),
  TENCENT_SECRET_KEY: z.string().optional()
});

/**
 * 微信配置
 */
const WechatConfigSchema = z.object({
  WECHAT_APP_ID: z.string().optional(),
  WECHAT_APP_SECRET: z.string().optional(),
  WECHAT_MINIAPP_ID: z.string().optional(),
  WECHAT_MINIAPP_SECRET: z.string().optional(),
  WECHAT_OFFICIAL_APP_ID: z.string().optional(),
  WECHAT_OFFICIAL_APP_SECRET: z.string().optional(),
  WECHAT_TOKEN: z.string().optional(),
  WECHAT_ENCODING_AES_KEY: z.string().optional()
});

/**
 * 支付配置
 */
const PaymentConfigSchema = z.object({
  WECHAT_PAY_MCH_ID: z.string().optional(),
  WECHAT_PAY_API_KEY: z.string().optional(),
  WECHAT_PAY_CERT_PATH: z.string().optional(),
  ALIPAY_APP_ID: z.string().optional(),
  ALIPAY_PRIVATE_KEY: z.string().optional()
});

/**
 * 日志和监控配置
 */
const LoggingConfigSchema = z.object({
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1)
});

/**
 * 限流和安全配置
 */
const SecurityConfigSchema = z.object({
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000), // 1分钟
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(100),
  CORS_ORIGINS: z.string().optional(),
  ALLOWED_HOSTS: z.string().optional()
});

/**
 * 业务配置 (可通过动态配置覆盖)
 */
const BusinessConfigSchema = z.object({
  PLAN_MONTHLY_QUOTA: z.coerce.number().int().min(0).default(100),
  QUOTA_COST_BASIC_CLEAN: z.coerce.number().int().min(1).default(1),
  QUOTA_COST_MODEL_POSE12: z.coerce.number().int().min(1).default(1),
  QUOTA_COST_VIDEO_GENERATE: z.coerce.number().int().min(1).default(5),
  ENABLE_REGISTRATION: z.coerce.boolean().default(true),
  ENABLE_EMAIL_VERIFICATION: z.coerce.boolean().default(false)
});

/**
 * 完整配置Schema
 */
export const ConfigSchema = z.object({
  // 基础配置
  ...ServerConfigSchema.shape,
  ...DatabaseConfigSchema.shape,
  ...RedisConfigSchema.shape,
  ...BullMQConfigSchema.shape,

  // 安全配置
  ...JWTConfigSchema.shape,
  ...EncryptionConfigSchema.shape,
  ...SecurityConfigSchema.shape,

  // 第三方服务
  ...COSConfigSchema.shape,
  ...SMTPConfigSchema.shape,
  ...SMSConfigSchema.shape,
  ...LLMConfigSchema.shape,
  ...WechatConfigSchema.shape,
  ...PaymentConfigSchema.shape,

  // 监控和业务
  ...LoggingConfigSchema.shape,
  ...BusinessConfigSchema.shape
});

/**
 * 配置类型定义
 */
export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * 必需配置字段
 * 这些字段在生产环境必须配置
 */
export const REQUIRED_PRODUCTION_FIELDS = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'ENCRYPTION_KEY_V1',
  'COS_BUCKET',
  'COS_REGION',
  'REDIS_HOST'
] as const;

/**
 * 敏感配置字段
 * 这些字段不应该出现在日志中
 */
export const SENSITIVE_FIELDS = [
  'DB_PASSWORD',
  'JWT_SECRET',
  'ENCRYPTION_KEY_V1',
  'ENCRYPTION_KEY_V2',
  'COS_SECRET_KEY',
  'SMTP_PASSWORD',
  'SMS_SECRET_KEY',
  'DEEPSEEK_API_KEY',
  'HUNYUAN_API_SECRET',
  'KUAI_API_KEY',
  'RUNNINGHUB_API_KEY',
  'TENCENT_SECRET_KEY',
  'WECHAT_APP_SECRET',
  'WECHAT_PAY_API_KEY',
  'ALIPAY_PRIVATE_KEY',
  'BULL_BOARD_PASSWORD'
] as const;

/**
 * 配置分类映射
 */
export const CONFIG_CATEGORIES = {
  server: ['NODE_ENV', 'PORT', 'FRONTEND_URL', 'API_PREFIX'],
  database: ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DATABASE_POOL_MIN', 'DATABASE_POOL_MAX'],
  redis: ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD', 'REDIS_DB', 'REDIS_BULLMQ_DB'],
  security: ['JWT_SECRET', 'ENCRYPTION_KEY_V1', 'ENCRYPTION_KEY_V2'],
  cos: ['COS_SECRET_ID', 'COS_SECRET_KEY', 'COS_BUCKET', 'COS_REGION'],
  email: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'],
  llm: ['DEEPSEEK_API_KEY', 'HUNYUAN_API_KEY', 'KUAI_API_KEY']
} as const;
