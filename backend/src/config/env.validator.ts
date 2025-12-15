/**
 * 环境变量验证和强制检查
 * 在服务启动前验证所有必要的环境变量是否已配置
 */

/**
 * 必需的环境变量列表
 * 如果这些变量没有配置，服务将无法启动
 *
 * 注意：API密钥相关变量现在是可选的，因为可以通过动态配置设置
 */
export const REQUIRED_ENV_VARS = [
  // 数据库配置（必需）
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',

  // JWT配置（必需）
  'JWT_SECRET',

  // 腾讯云COS基础配置（必需，但密钥可通过动态配置设置）
  'COS_BUCKET',
  'COS_REGION'
];

/**
 * 可选的环境变量列表（有默认值）
 *
 * 注意：API密钥现在是可选的，可以通过动态配置系统设置
 */
export const OPTIONAL_ENV_VARS = {
  // 服务器配置
  PORT: '3000',
  NODE_ENV: 'development',

  // JWT配置
  JWT_EXPIRE: '7d',

  // 业务配置
  PLAN_MONTHLY_QUOTA: '100',
  QUOTA_COST_BASIC_CLEAN: '1',
  QUOTA_COST_MODEL_POSE12: '1',
  QUOTA_COST_VIDEO_GENERATE: '5',

  // 日志和性能配置
  LOG_LEVEL: 'info',
  RATE_LIMIT_WINDOW_MS: '60000',
  RATE_LIMIT_MAX_REQUESTS: '100',
  DATABASE_POOL_MIN: '5',
  DATABASE_POOL_MAX: '20',

  // API密钥（可选，可通过动态配置设置）
  TENCENT_SECRET_ID: '',
  TENCENT_SECRET_KEY: '',
  HUNYUAN_API_KEY: '',
  HUNYUAN_API_SECRET: '',
  KUAI_API_KEY: '',
  RUNNINGHUB_API_KEY: ''
};

/**
 * 验证环境变量
 * @returns {Object} 验证结果
 */
interface EnvironmentValidation {
  isValid: boolean;
  missing: string[];
  warnings: string[];
  errors: string[];
  message: string;
}

/**
 * 功能组依赖配置
 * 启用某功能时，其依赖的配置都必须存在
 */
const FEATURE_DEPENDENCIES: Record<string, { trigger: string; triggerValue?: string; requires: string[] }> = {
  // BullBoard启用时需要账号密码
  BULL_BOARD: {
    trigger: 'ENABLE_BULL_BOARD',
    triggerValue: 'true',
    requires: ['BULL_BOARD_USERNAME', 'BULL_BOARD_PASSWORD']
  },
  // 邮件验证启用时需要SMTP配置
  EMAIL_VERIFICATION: {
    trigger: 'ENABLE_EMAIL_VERIFICATION',
    triggerValue: 'true',
    requires: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD']
  },
  // Sentry监控启用时需要DSN
  SENTRY: {
    trigger: 'SENTRY_DSN',
    requires: ['SENTRY_ENVIRONMENT']
  },
  // 微信登录启用时需要完整配置
  WECHAT_LOGIN: {
    trigger: 'WECHAT_APP_ID',
    requires: ['WECHAT_APP_SECRET']
  },
  // 微信支付启用时需要完整配置
  WECHAT_PAY: {
    trigger: 'WECHAT_PAY_MCH_ID',
    requires: ['WECHAT_PAY_API_KEY']
  }
};

/**
 * 生产环境额外必需配置
 */
const PRODUCTION_REQUIRED_VARS = [
  'ENCRYPTION_KEY_V1',
  'REDIS_PASSWORD',
  'SENTRY_DSN'
];

export function validateEnvironment(): EnvironmentValidation {
  const missing: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // 检查必需的环境变量
  REQUIRED_ENV_VARS.forEach((envVar) => {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  });

  // 生产环境额外检查
  if (isProduction) {
    PRODUCTION_REQUIRED_VARS.forEach((envVar) => {
      if (!process.env[envVar]) {
        errors.push(`生产环境必需配置缺失: ${envVar}`);
      }
    });
  }

  // 功能组依赖检查
  Object.entries(FEATURE_DEPENDENCIES).forEach(([featureName, config]) => {
    const triggerValue = process.env[config.trigger];
    const isTriggerActive = config.triggerValue
      ? triggerValue === config.triggerValue
      : !!triggerValue;

    if (isTriggerActive) {
      const missingDeps = config.requires.filter((dep) => !process.env[dep]);
      if (missingDeps.length > 0) {
        const message = `${featureName} 功能已启用，但缺少依赖配置: ${missingDeps.join(', ')}`;
        if (isProduction) {
          errors.push(message);
        } else {
          warnings.push(message);
        }
      }
    }
  });

  // 检查敏感配置的默认值
  const sensitiveDefaults = [
    'your_random_secret_key_change_this_in_production_min_32_chars',
    'your_tencent_secret_id_here',
    'your_tencent_secret_key_here',
    'your_database_password_here',
    'change_this_secret',
    'your_secret'
  ];

  Object.entries(process.env).forEach(([key, value]) => {
    if (value) {
      const lowerValue = value.toLowerCase();
      for (const dangerous of sensitiveDefaults) {
        if (lowerValue.includes(dangerous.toLowerCase())) {
          const message = `环境变量 ${key} 使用了示例值，请修改为实际配置`;
          if (isProduction) {
            errors.push(message);
          } else {
            warnings.push(message);
          }
          break;
        }
      }
    }
  });

  // 检查JWT密钥长度
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    const message = 'JWT_SECRET 长度建议至少32个字符以保证安全性';
    if (isProduction) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  // 检查加密密钥长度
  if (process.env.ENCRYPTION_KEY_V1 && process.env.ENCRYPTION_KEY_V1.length < 32) {
    const message = 'ENCRYPTION_KEY_V1 长度必须至少32个字符';
    if (isProduction) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  // 数据库连接池配置合理性检查
  const poolMin = parseInt(process.env.DATABASE_POOL_MIN || '5', 10);
  const poolMax = parseInt(process.env.DATABASE_POOL_MAX || '20', 10);
  if (poolMin > poolMax) {
    errors.push(`DATABASE_POOL_MIN (${poolMin}) 不能大于 DATABASE_POOL_MAX (${poolMax})`);
  }

  const hasErrors = missing.length > 0 || errors.length > 0;

  return {
    isValid: !hasErrors,
    missing,
    warnings,
    errors,
    message: hasErrors
      ? `配置验证失败: ${missing.length} 个必需配置缺失, ${errors.length} 个错误`
      : '环境变量验证通过'
  };
}

/**
 * 设置默认环境变量
 */
export function setDefaults(): void {
  Object.entries(OPTIONAL_ENV_VARS).forEach(([key, defaultValue]) => {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
    }
  });
}

/**
 * 打印环境变量状态
 */
export function printEnvironmentStatus(): EnvironmentValidation {
  const validation = validateEnvironment();

  console.log('🔧 环境变量检查结果:');
  console.log('='.repeat(50));

  if (validation.isValid) {
    console.log('✅ 所有必需的环境变量已配置');
  } else {
    console.log('❌', validation.message);

    if (validation.missing.length > 0) {
      console.log('\n📋 缺失的必需配置:');
      validation.missing.forEach((envVar) => {
        console.log(`   - ${envVar}`);
      });
    }

    if (validation.errors.length > 0) {
      console.log('\n🚨 配置错误:');
      validation.errors.forEach((error) => {
        console.log(`   - ${error}`);
      });
    }
  }

  if (validation.warnings.length > 0) {
    console.log('\n⚠️  警告:');
    validation.warnings.forEach((warning) => {
      console.log(`   - ${warning}`);
    });
  }

  console.log('='.repeat(50));

  return validation;
}

/**
 * 启动时环境变量检查
 * 如果验证失败，抛出异常阻止服务启动
 */
export function checkEnvironmentOnStart(): void {
  // 设置默认值
  setDefaults();

  // 验证环境变量
  const validation = validateEnvironment();

  // 打印状态
  printEnvironmentStatus();

  // 如果有缺失的必需变量或错误，阻止启动
  if (!validation.isValid) {
    const error = new Error('环境变量验证失败，服务无法启动') as Error & {
      code: string;
      details: { missing: string[]; errors: string[] };
    };
    error.code = 'ENV_VALIDATION_ERROR';
    error.details = {
      missing: validation.missing,
      errors: validation.errors
    };
    throw error;
  }

  // 如果有警告，在开发环境中提醒
  if (validation.warnings.length > 0 && process.env.NODE_ENV === 'development') {
    console.log('\n💡 提示: 请在生产环境部署前解决所有警告项');
  }
}
