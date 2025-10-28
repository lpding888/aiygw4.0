const STS = require('qcloud-cos-sts');
const { nanoid } = require('nanoid');
const logger = require('../utils/logger');

/**
 * 媒体服务 - 腾讯云COS STS临时密钥管理
 */
class MediaService {
  constructor() {
    // 腾讯云配置
    this.config = {
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY,
      bucket: process.env.COS_BUCKET,
      region: process.env.COS_REGION,
      durationSeconds: 1800, // 30分钟
      // 允许的操作
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

  /**
   * 获取STS临时密钥
   * @param {string} userId - 用户ID
   * @param {string} taskId - 任务ID(可选,如果没有则生成新的)
   * @returns {Promise<Object>} STS临时凭证
   */
  async getSTS(userId, taskId = null) {
    try {
      // 如果没有taskId,生成一个新的
      const actualTaskId = taskId || nanoid();

      // 构建资源路径: /input/{userId}/{taskId}/*
      const resourcePath = `input/${userId}/${actualTaskId}/*`;

      // STS策略配置
      const policy = {
        version: '2.0',
        statement: [{
          effect: 'allow',
          action: this.config.allowActions,
          resource: [
            `qcs::cos:${this.config.region}:uid/*:${this.config.bucket}/${resourcePath}`
          ]
        }]
      };

      // 获取临时密钥
      const credentials = await new Promise((resolve, reject) => {
        STS.getCredential({
          secretId: this.config.secretId,
          secretKey: this.config.secretKey,
          durationSeconds: this.config.durationSeconds,
          policy: policy
        }, (err, credential) => {
          if (err) {
            reject(err);
          } else {
            resolve(credential);
          }
        });
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
        // 返回允许上传的路径前缀
        allowPrefix: `input/${userId}/${actualTaskId}/`,
        taskId: actualTaskId
      };

    } catch (error) {
      logger.error(`[MediaService] 获取STS密钥失败: ${error.message}`, { userId, taskId, error });
      throw error;
    }
  }

  /**
   * 生成COS对象URL
   * @param {string} key - COS对象键
   * @param {boolean} signed - 是否生成签名URL
   * @returns {string} URL
   */
  getObjectUrl(key, signed = false) {
    // 简单的HTTP URL(如果bucket公开读)
    const baseUrl = `https://${this.config.bucket}.cos.${this.config.region}.myqcloud.com/${key}`;
    
    if (!signed) {
      return baseUrl;
    }

    // 如果需要签名URL,使用COS SDK生成
    // 这里简化处理,实际应该使用qcloud-cos-sdk
    return baseUrl;
  }

  /**
   * 验证文件大小
   * @param {number} fileSize - 文件大小(字节)
   * @param {number} maxSize - 最大大小(字节)
   */
  validateFileSize(fileSize, maxSize = 10 * 1024 * 1024) {
    if (fileSize > maxSize) {
      throw new Error(`文件大小超过限制(最大${maxSize / 1024 / 1024}MB)`);
    }
    return true;
  }

  /**
   * 验证文件类型
   * @param {string} fileName - 文件名
   * @param {Array<string>} allowedTypes - 允许的文件类型
   */
  validateFileType(fileName, allowedTypes = ['jpg', 'jpeg', 'png']) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(ext)) {
      throw new Error(`不支持的文件类型,仅支持: ${allowedTypes.join(', ')}`);
    }
    return true;
  }
}

module.exports = new MediaService();
