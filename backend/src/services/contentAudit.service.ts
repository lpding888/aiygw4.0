import tencentcloud from 'tencentcloud-sdk-nodejs';
import COS from 'cos-nodejs-sdk-v5';
import logger from '../utils/logger.js';
import taskService from './task.service.js';

type ImsClientType = any;

class ContentAuditService {
  private readonly config = {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
    region: process.env.TENCENT_COS_REGION || 'ap-guangzhou',
    bucket: process.env.TENCENT_COS_BUCKET
  };

  private imsClient: ImsClientType;
  private cos: any;

  constructor() {
    const ImsClient =
      (tencentcloud as any).ims?.v20201229?.Client || (tencentcloud as any).ims?.v20200307?.Client;
    this.imsClient = new ImsClient({
      credential: { secretId: this.config.secretId, secretKey: this.config.secretKey },
      region: this.config.region
    });
    this.cos = new COS({ SecretId: this.config.secretId, SecretKey: this.config.secretKey });
  }

  async auditImage(
    imageUrl: string
  ): Promise<{ pass: boolean; reason?: string; auditResults?: any }> {
    try {
      logger.info(`[ContentAudit] 开始审核图片: ${imageUrl}`);
      const params = { FileUrl: imageUrl, Biztype: 'default' };
      const response = await this.imsClient.ImageModeration(params);
      const result = response.Data;
      const suggestion: string = result?.Suggestion;
      const pass = suggestion === 'Pass';

      let reason = '';
      if (!pass) {
        const labels: string[] = [];
        if (result?.PornInfo?.HitFlag === 1) labels.push(`色情(${result.PornInfo.Label})`);
        if (result?.TerrorismInfo?.HitFlag === 1)
          labels.push(`暴力(${result.TerrorismInfo.Label})`);
        if (result?.IllegalInfo?.HitFlag === 1) labels.push(`违法(${result.IllegalInfo.Label})`);
        if (result?.AdsInfo?.HitFlag === 1) labels.push(`广告(${result.AdsInfo.Label})`);
        reason = labels.join('; ');
      }
      return { pass, reason, auditResults: result };
    } catch (error: any) {
      logger.error(`[ContentAudit] 审核图片失败: ${error.message}`, { imageUrl, error });
      throw error;
    }
  }

  async auditTaskResults(
    taskId: string,
    imageUrls: string[]
  ): Promise<{ pass: boolean; reasons?: string[]; auditResults?: any[] }> {
    try {
      const audits: any[] = [];
      const violationReasons: string[] = [];

      for (const url of imageUrls) {
        const single = await this.auditImage(url);
        audits.push(single);
        if (!single.pass && single.reason) violationReasons.push(single.reason);
      }

      if (violationReasons.length > 0) {
        logger.warn(`[ContentAudit] 发现违规内容, 删除结果并回滚任务 taskId=${taskId}`);
        await this.deleteResultImages(imageUrls);
        await taskService.updateStatus(taskId, 'failed', {
          errorMessage: `内容审核未通过: ${violationReasons.join('; ')}`
        } as any);
        return { pass: false, reasons: violationReasons, auditResults: audits };
      }

      logger.info(`[ContentAudit] 任务审核通过 taskId=${taskId}`);
      return { pass: true, auditResults: audits };
    } catch (error: any) {
      logger.error(`[ContentAudit] 审核任务结果失败: ${error.message}`, { taskId, error });
      throw error;
    }
  }

  async deleteResultImages(imageUrls: string[]): Promise<void> {
    const promises = imageUrls.map((url) => {
      try {
        const u = new URL(url);
        const key = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
        return new Promise((resolve, reject) => {
          this.cos.deleteObject(
            { Bucket: this.config.bucket, Region: this.config.region, Key: key },
            (err: any, data: any) => {
              if (err) {
                logger.error(`[ContentAudit] 删除图片失败: ${key}`, err);
                reject(err);
              } else {
                logger.info(`[ContentAudit] 图片已删除: ${key}`);
                resolve(data);
              }
            }
          );
        });
      } catch (e) {
        logger.warn(`[ContentAudit] 跳过无法解析的URL: ${url}`);
        return Promise.resolve();
      }
    });
    await Promise.allSettled(promises);
  }
}

export default new ContentAuditService();
