import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const tencentSms = require('tencentcloud-sdk-nodejs/tencentcloud/services/sms/v20210111/sms_client.js');
const SmsClient = tencentSms.SmsClient || tencentSms.default?.SmsClient || tencentSms;
import logger from '../utils/logger.js';

interface SendCodeOptions {
  signName?: string;
  templateId?: string;
  sdkAppId?: string;
}

class SmsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: InstanceType<typeof SmsClient> | null = null;
  private readonly secretId = process.env.TENCENT_SMS_SECRET_ID;
  private readonly secretKey = process.env.TENCENT_SMS_SECRET_KEY;
  private readonly sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID;
  private readonly signName = process.env.TENCENT_SMS_SIGN_NAME;
  private readonly templateId = process.env.TENCENT_SMS_TEMPLATE_ID; // 需包含一个变量，占位验证码

  constructor() {
    if (this.secretId && this.secretKey) {
      this.client = new SmsClient({
        credential: {
          secretId: this.secretId,
          secretKey: this.secretKey
        },
        region: process.env.TENCENT_SMS_REGION || 'ap-guangzhou'
      });
    } else {
      logger.warn('[SMS] 未配置 TENCENT_SMS_SECRET_ID / SECRET_KEY，短信发送将降级为日志');
    }
  }

  /**
   * 发送验证码短信
   * @param phone - 11位国内手机号
   * @param code - 验证码
   */
  async sendVerificationCode(phone: string, code: string, options: SendCodeOptions = {}): Promise<void> {
    // 非生产环境或未配置密钥，直接日志输出
    if (!this.client || process.env.NODE_ENV !== 'production') {
      logger.info(`[SMS] 发送验证码(模拟): phone=${phone}, code=${code}`);
      return;
    }

    if (!this.sdkAppId && !options.sdkAppId) {
      throw new Error('缺少短信 SDK AppId (TENCENT_SMS_SDK_APP_ID)');
    }
    const sdkAppId = options.sdkAppId || this.sdkAppId!;
    const signName = options.signName || this.signName;
    const templateId = options.templateId || this.templateId;

    if (!signName) {
      throw new Error('缺少短信签名 TENCENT_SMS_SIGN_NAME');
    }
    if (!templateId) {
      throw new Error('缺少短信模板 TENCENT_SMS_TEMPLATE_ID');
    }

    // 腾讯云要求 E.164 格式，国内手机号加 +86
    const phoneNumberSet = [`+86${phone}`];

    const params = {
      PhoneNumberSet: phoneNumberSet,
      SmsSdkAppId: sdkAppId,
      SignName: signName,
      TemplateId: templateId,
      TemplateParamSet: [code, '5'] // 默认5分钟有效，模板需对应占位
    };

    const res = await this.client.SendSms(params);
    const status = res?.SendStatusSet?.[0];

    if (status?.Code !== 'Ok') {
      const errMsg = status?.Message || status?.Code || '未知错误';
      throw new Error(`[SMS] 发送失败: ${errMsg}`);
    }

    logger.info('[SMS] 短信验证码已发送', { phone, templateId, signName });
  }
}

export default new SmsService();
