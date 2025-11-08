import STS from 'qcloud-cos-sts';
import { nanoid } from 'nanoid';
import logger from '../utils/logger.js';

type MediaConfig = {
  secretId?: string;
  secretKey?: string;
  bucket?: string;
  region?: string;
  durationSeconds: number;
  allowActions: string[];
};

type StsCredentials = {
  tmpSecretId: string;
  tmpSecretKey: string;
  sessionToken: string;
};

type StsResult = {
  credentials: StsCredentials;
  expiration: number;
  startTime: number;
  bucket?: string;
  region?: string;
  allowPrefix: string;
  taskId: string;
};

class MediaService {
  private readonly config: MediaConfig;

  constructor() {
    this.config = {
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY,
      bucket: process.env.COS_BUCKET,
      region: process.env.COS_REGION,
      durationSeconds: 1800,
      allowActions: [
        'name/cos:PutObject',
        'name/cos:PostObject',
        'name/cos:InitiateMultipartUpload',
        'name/cos:ListMultipartUploads',
        'name/cos:ListParts',
        'name/cos:UploadPart',
        'name/cos:CompleteMultipartUpload'
      ]
    };
  }

  async getSTS(userId: string, taskId?: string | null): Promise<StsResult> {
    const actualTaskId = taskId ?? nanoid();
    const resourcePath = `input/${userId}/${actualTaskId}/*`;

    const policy = {
      version: '2.0',
      statement: [
        {
          effect: 'allow',
          action: this.config.allowActions,
          resource: [`qcs::cos:${this.config.region}:uid/*:${this.config.bucket}/${resourcePath}`]
        }
      ]
    };

    try {
      const credentials = await new Promise<{
        expiredTime: number;
        startTime: number;
        credentials: StsCredentials;
      }>((resolve, reject) => {
        STS.getCredential(
          {
            secretId: this.config.secretId ?? '',
            secretKey: this.config.secretKey ?? '',
            durationSeconds: this.config.durationSeconds,
            policy
          },
          (err, credential) => {
            if (err) {
              reject(err);
            } else {
              resolve(credential);
            }
          }
        );
      });

      logger.info(`[MediaService] STS密钥获取成功 userId=${userId} taskId=${actualTaskId}`);

      return {
        credentials: {
          tmpSecretId: credentials.credentials.tmpSecretId,
          tmpSecretKey: credentials.credentials.tmpSecretKey,
          sessionToken: credentials.credentials.sessionToken
        },
        expiration: credentials.expiredTime,
        startTime: credentials.startTime,
        bucket: this.config.bucket,
        region: this.config.region,
        allowPrefix: `input/${userId}/${actualTaskId}/`,
        taskId: actualTaskId
      };
    } catch (error) {
      const err = error as Error;
      logger.error(`[MediaService] 获取STS密钥失败: ${err.message}`, {
        userId,
        taskId,
        error: err
      });
      throw err;
    }
  }

  getObjectUrl(key: string, signed = false): string {
    const baseUrl = `https://${this.config.bucket}.cos.${this.config.region}.myqcloud.com/${key}`;
    if (!signed) {
      return baseUrl;
    }
    return baseUrl;
  }

  validateFileSize(fileSize: number, maxSize = 10 * 1024 * 1024): boolean {
    if (fileSize > maxSize) {
      throw new Error(`文件大小超过限制(最大${maxSize / 1024 / 1024}MB)`);
    }
    return true;
  }

  validateFileType(fileName: string, allowedTypes: string[] = ['jpg', 'jpeg', 'png']): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext || !allowedTypes.includes(ext)) {
      throw new Error(`不支持的文件类型,仅支持: ${allowedTypes.join(', ')}`);
    }
    return true;
  }
}

const mediaService = new MediaService();
export default mediaService;
