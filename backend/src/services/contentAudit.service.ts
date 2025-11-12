import tencentcloud from 'tencentcloud-sdk-nodejs';
import COS from 'cos-nodejs-sdk-v5';
import logger from '../utils/logger.js';
import taskService from './task.service.js';

interface IAuditImageResult {
  pass: boolean;
  reason?: string;
  auditResults?: Record<string, unknown>;
}

interface IAuditTaskResult {
  pass: boolean;
  reasons?: string[];
  auditResults?: IAuditImageResult[];
}

interface IImsModerationResponse {
  Data: Record<string, unknown>;
}

// 腾讯云IMS客户端类型定义
interface ImsClientType {
  ImageModeration(params: Record<string, string>): Promise<IImsModerationResponse>;
}

type COSClient = InstanceType<typeof COS>;

class ContentAuditService {
  private readonly config = {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
    region: process.env.TENCENT_COS_REGION || 'ap-guangzhou',
    bucket: process.env.TENCENT_COS_BUCKET
  };

  private imsClient: ImsClientType;
  private cos: COSClient;

  constructor() {
    const tencentCloudSdk = tencentcloud as Record<string, unknown>;
    const imsModule = tencentCloudSdk.ims as Record<string, unknown>;
    const ImsClientConstructor =
      ((imsModule?.v20201229 as Record<string, unknown>)?.Client as unknown) ||
      ((imsModule?.v20200307 as Record<string, unknown>)?.Client as unknown);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.imsClient = new (ImsClientConstructor as any)({
      credential: { secretId: this.config.secretId, secretKey: this.config.secretKey },
      region: this.config.region
    });
    this.cos = new COS({ SecretId: this.config.secretId, SecretKey: this.config.secretKey });
  }

  async auditImage(imageUrl: string): Promise<IAuditImageResult> {
    try {
      logger.info(`[ContentAudit] 开始审核图片: ${imageUrl}`);
      const params = { FileUrl: imageUrl, Biztype: 'default' };
      const response = await this.imsClient.ImageModeration(params);
      const result = response.Data as Record<string, unknown>;
      const suggestion: string = (result?.Suggestion as string) || '';
      const pass = suggestion === 'Pass';

      let reason = '';
      if (!pass) {
        const labels: string[] = [];
        const pornInfo = result?.PornInfo as Record<string, unknown> | undefined;
        const terrorismInfo = result?.TerrorismInfo as Record<string, unknown> | undefined;
        const illegalInfo = result?.IllegalInfo as Record<string, unknown> | undefined;
        const adsInfo = result?.AdsInfo as Record<string, unknown> | undefined;

        if (pornInfo?.HitFlag === 1) labels.push(`色情(${pornInfo.Label})`);
        if (terrorismInfo?.HitFlag === 1) labels.push(`暴力(${terrorismInfo.Label})`);
        if (illegalInfo?.HitFlag === 1) labels.push(`违法(${illegalInfo.Label})`);
        if (adsInfo?.HitFlag === 1) labels.push(`广告(${adsInfo.Label})`);
        reason = labels.join('; ');
      }
      return { pass, reason, auditResults: result };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ContentAudit] 审核图片失败: ${err.message}`, { imageUrl, error });
      throw err;
    }
  }

  async auditTaskResults(taskId: string, imageUrls: string[]): Promise<IAuditTaskResult> {
    try {
      const audits: IAuditImageResult[] = [];
      const violationReasons: string[] = [];

      for (const url of imageUrls) {
        const single = await this.auditImage(url);
        audits.push(single);
        if (!single.pass && single.reason) violationReasons.push(single.reason);
      }

      if (violationReasons.length > 0) {
        logger.warn(`[ContentAudit] 发现违规内容, 删除结果并回滚任务 taskId=${taskId}`);
        await this.deleteResultImages(imageUrls);
        const updateParams: Record<string, string> = {
          errorMessage: `内容审核未通过: ${violationReasons.join('; ')}`
        };
        await taskService.updateStatus(taskId, 'failed', updateParams);
        return { pass: false, reasons: violationReasons, auditResults: audits };
      }

      logger.info(`[ContentAudit] 任务审核通过 taskId=${taskId}`);
      return { pass: true, auditResults: audits };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ContentAudit] 审核任务结果失败: ${err.message}`, { taskId, error });
      throw err;
    }
  }

  async deleteResultImages(imageUrls: string[]): Promise<void> {
    const promises = imageUrls.map((url) => {
      try {
        const u = new URL(url);
        const key = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
        return new Promise<void>((resolve, reject) => {
          this.cos.deleteObject(
            { Bucket: this.config.bucket, Region: this.config.region, Key: key },
            (err: Error | null, data: Record<string, unknown> | undefined) => {
              if (err) {
                logger.error(`[ContentAudit] 删除图片失败: ${key}`, err);
                reject(err);
              } else {
                logger.info(`[ContentAudit] 图片已删除: ${key}`);
                resolve();
              }
            }
          );
        });
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        logger.warn(`[ContentAudit] 跳过无法解析的URL: ${url}`);
        return Promise.resolve();
      }
    });
    await Promise.allSettled(promises);
  }
}

export default new ContentAuditService();
