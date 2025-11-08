export type PaymentProvider = 'alipay' | 'wechat';
export type PaymentEnvironment = 'development' | 'production';

interface CallbackConfig {
  notify: string;
  return: string;
}

interface AlipayCredentials {
  appId: string;
  privateKey: string;
  publicKey: string;
  gateway: string;
  charset: string;
  version: string;
  signType: string;
}

interface WechatCredentials {
  appId: string;
  mchId: string;
  privateKey: string;
  publicKey: string;
  apiV3Key: string;
  merchantSerialNumber: string;
  keyPath: string;
  certPath: string;
}

interface ProviderConfig<TCredentials> {
  prod: TCredentials;
  dev: TCredentials;
  callbacks: CallbackConfig;
}

type ProviderConfigs = {
  alipay: ProviderConfig<AlipayCredentials>;
  wechat: ProviderConfig<WechatCredentials>;
};

interface PaymentProduct {
  name: string;
  type: string;
  currency: string;
}

type PaymentProducts = Record<'membership' | 'quota' | 'premium', PaymentProduct>;

const buildCallbacks = (
  notifyEnv: string | undefined,
  returnEnv: string | undefined,
  defaults: CallbackConfig
): CallbackConfig => ({
  notify: notifyEnv ?? defaults.notify,
  return: returnEnv ?? defaults.return
});

export const paymentConfig: ProviderConfigs & {
  common: {
    timeout: {
      orderExpireMinutes: number;
      refundExpireDays: number;
      callbackTimeout: number;
    };
    retry: {
      maxRetries: number;
      retryInterval: number;
    };
    security: {
      signCheck: boolean;
      ipCheck: boolean;
      amountCheck: boolean;
      notifyCheck: boolean;
    };
  };
  products: PaymentProducts;
} = {
  alipay: {
    prod: {
      appId: process.env.ALIPAY_APP_ID ?? '',
      privateKey: process.env.ALIPAY_PRIVATE_KEY ?? '',
      publicKey: process.env.ALIPAY_PUBLIC_KEY ?? '',
      gateway: 'https://openapi.alipay.com/gateway.do',
      charset: 'utf-8',
      version: '1.0',
      signType: 'RSA2'
    },
    dev: {
      appId: process.env.ALIPAY_DEV_APP_ID ?? '',
      privateKey: process.env.ALIPAY_DEV_PRIVATE_KEY ?? '',
      publicKey: process.env.ALIPAY_DEV_PUBLIC_KEY ?? '',
      gateway: 'https://openapi.alipaydev.com/gateway.do',
      charset: 'utf-8',
      version: '1.0',
      signType: 'RSA2'
    },
    callbacks: buildCallbacks(process.env.ALIPAY_NOTIFY_URL, process.env.ALIPAY_RETURN_URL, {
      notify: 'https://api.example.com/api/payment/alipay/notify',
      return: 'https://app.example.com/payment/success'
    })
  },
  wechat: {
    prod: {
      appId: process.env.WECHAT_APP_ID ?? '',
      mchId: process.env.WECHAT_MCH_ID ?? '',
      privateKey: process.env.WECHAT_PRIVATE_KEY ?? '',
      publicKey: process.env.WECHAT_PUBLIC_KEY ?? '',
      apiV3Key: process.env.WECHAT_API_V3_KEY ?? '',
      merchantSerialNumber: process.env.WECHAT_MERCHANT_SERIAL_NO ?? '',
      keyPath: process.env.WECHAT_KEY_PATH ?? '',
      certPath: process.env.WECHAT_CERT_PATH ?? ''
    },
    dev: {
      appId: process.env.WECHAT_DEV_APP_ID ?? '',
      mchId: process.env.WECHAT_DEV_MCH_ID ?? '',
      privateKey: process.env.WECHAT_DEV_PRIVATE_KEY ?? '',
      publicKey: process.env.WECHAT_DEV_PUBLIC_KEY ?? '',
      apiV3Key: process.env.WECHAT_DEV_API_V3_KEY ?? '',
      merchantSerialNumber: process.env.WECHAT_DEV_MERCHANT_SERIAL_NO ?? '',
      keyPath: process.env.WECHAT_DEV_KEY_PATH ?? '',
      certPath: process.env.WECHAT_DEV_CERT_PATH ?? ''
    },
    callbacks: buildCallbacks(process.env.WECHAT_NOTIFY_URL, process.env.WECHAT_RETURN_URL, {
      notify: 'https://api.example.com/api/payment/wechat/notify',
      return: 'https://app.example.com/payment/success'
    })
  },
  common: {
    timeout: {
      orderExpireMinutes: 30,
      refundExpireDays: 7,
      callbackTimeout: 30_000
    },
    retry: {
      maxRetries: 3,
      retryInterval: 1_000
    },
    security: {
      signCheck: true,
      ipCheck: true,
      amountCheck: true,
      notifyCheck: true
    }
  },
  products: {
    membership: {
      name: '会员服务',
      type: 'virtual',
      currency: 'CNY'
    },
    quota: {
      name: '配额购买',
      type: 'virtual',
      currency: 'CNY'
    },
    premium: {
      name: '高级功能',
      type: 'virtual',
      currency: 'CNY'
    }
  }
};

type ProviderConfigWithCallbacks<T extends PaymentProvider> = (T extends 'alipay'
  ? AlipayCredentials
  : WechatCredentials) & {
  callbacks: CallbackConfig;
};

export const getPaymentConfig = <T extends PaymentProvider>(
  provider: T,
  env: PaymentEnvironment | string = process.env.NODE_ENV ?? 'development'
): ProviderConfigWithCallbacks<T> => {
  const providerConfig = paymentConfig[provider];
  if (!providerConfig) {
    throw new Error(`不支持的支付提供商: ${provider}`);
  }

  const targetEnv = env === 'production' ? 'prod' : 'dev';
  const credentials = providerConfig[targetEnv];

  const result = {
    ...credentials,
    callbacks: providerConfig.callbacks
  };

  return result as unknown as ProviderConfigWithCallbacks<T>;
};

export const getPaymentProductConfig = (productType: keyof PaymentProducts): PaymentProduct => {
  const product = paymentConfig.products[productType];
  if (!product) {
    throw new Error(`不支持的商品类型: ${productType as string}`);
  }
  return product;
};

export const validatePaymentConfig = (
  provider: PaymentProvider,
  env: PaymentEnvironment | string = process.env.NODE_ENV ?? 'development'
): true => {
  const config = getPaymentConfig(provider, env);
  const errors: string[] = [];

  if (provider === 'alipay') {
    const alipayConfig = config as ProviderConfigWithCallbacks<'alipay'>;
    if (!alipayConfig.appId) errors.push('支付宝AppId缺失');
    if (!alipayConfig.privateKey) errors.push('支付宝私钥缺失');
    if (!alipayConfig.publicKey) errors.push('支付宝公钥缺失');
    if (!alipayConfig.gateway) errors.push('支付宝网关地址缺失');
  } else if (provider === 'wechat') {
    const wechatConfig = config as ProviderConfigWithCallbacks<'wechat'>;
    if (!wechatConfig.appId) errors.push('微信AppId缺失');
    if (!wechatConfig.mchId) errors.push('微信商户号缺失');
    if (!wechatConfig.privateKey) errors.push('微信私钥缺失');
    if (!wechatConfig.apiV3Key) errors.push('微信API v3密钥缺失');
  }

  if (errors.length > 0) {
    throw new Error(`${provider}配置不完整: ${errors.join(', ')}`);
  }

  return true;
};
