const axios = require('axios');
const COS = require('cos-nodejs-sdk-v5');
const logger = require('../utils/logger');
const taskService = require('./task.service');
const contentAuditService = require('./contentAudit.service');

/**
 * 腾讯数据万象服务 - 图片处理
 *
 * 处理链说明:
 * 1. 商品抠图 (AI分割) - imageMogr2/cut-out
 * 2. 白底处理 - imageMogr2/background/color/white
 * 3. 智能增强 - imageMogr2/sharpen/1
 */
class ImageProcessService {
  constructor() {
    this.config = {
      bucket: process.env.COS_BUCKET,
      region: process.env.COS_REGION,
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY
    };

    // 初始化COS SDK
    this.cos = new COS({
      SecretId: this.config.secretId,
      SecretKey: this.config.secretKey
    });

    // 验证配置
    if (!this.config.bucket || !this.config.secretId || !this.config.secretKey) {
      logger.warn('[ImageProcessService] 腾讯云配置不完整，将使用Mock模式');
      this.useMock = true;
    } else {
      this.useMock = false;
      logger.info('[ImageProcessService] 腾讯云数据万象服务已初始化', {
        bucket: this.config.bucket,
        region: this.config.region
      });
    }
  }

  /**
   * 基础修图 - 商品抠图+白底+增强
   * @param {string} taskId - 任务ID
   * @param {string} inputImageUrl - 输入图片URL
   * @param {Object} params - 处理参数
   */
  async processBasicClean(taskId, inputImageUrl, params = {}) {
    try {
      logger.info(`[ImageProcessService] 开始处理基础修图 taskId=${taskId}`, {
        inputImageUrl,
        useMock: this.useMock
      });

      // 更新任务状态为processing
      await taskService.updateStatus(taskId, 'processing');

      let resultUrls;

      if (this.useMock) {
        // Mock模式 - 返回假的处理结果
        resultUrls = await this.mockProcessBasicClean(taskId, inputImageUrl);
      } else {
        // 真实API模式
        // 构建数据万象处理链
        const picOperations = this.buildPicOperations(taskId, params);

        // 方案1: 使用云上数据处理(如果图片已在COS)
        if (inputImageUrl.includes(this.config.bucket)) {
          resultUrls = await this.processCloudImage(inputImageUrl, picOperations);
        } else {
          // 方案2: 下载图片后上传处理(如果是外部URL)
          resultUrls = await this.processExternalImage(taskId, inputImageUrl, picOperations);
        }
      }

      logger.info(`[ImageProcessService] 图片处理完成,开始内容审核 taskId=${taskId}`);

      // 内容审核
      const auditResult = await contentAuditService.auditTaskResults(taskId, resultUrls);

      if (!auditResult.pass) {
        // 审核不通过,任务已被标记为failed并删除图片
        logger.warn(`[ImageProcessService] 内容审核未通过 taskId=${taskId}`);
        throw new Error('内容审核未通过');
      }

      // 审核通过,更新任务状态为success
      await taskService.updateStatus(taskId, 'success', {
        resultUrls
      });

      logger.info(`[ImageProcessService] 基础修图完成 taskId=${taskId} count=${resultUrls.length}`);
      return resultUrls;

    } catch (error) {
      logger.error(`[ImageProcessService] 基础修图失败: ${error.message}`, { taskId, error });

      // 更新任务状态为failed
      await taskService.updateStatus(taskId, 'failed', {
        errorMessage: error.message || '图片处理失败'
      });

      throw error;
    }
  }

  /**
   * 构建数据万象处理规则
   * @param {string} taskId - 任务ID
   * @param {Object} params - 处理参数
   */
  buildPicOperations(taskId, params = {}) {
    return {
      is_pic_info: 1, // 返回原图信息
      rules: [
        {
          // 规则1: AI抠图 (仅抠图，透明背景)
          fileid: `output/${taskId}/matting.png`,
          rule: 'imageMogr2/cut-out'
        },
        {
          // 规则2: 抠图后添加白底
          fileid: `output/${taskId}/white-bg.png`,
          rule: 'imageMogr2/cut-out|imageMogr2/background/color/ffffff'
        },
        {
          // 规则3: 智能增强 (白底 + 锐化 + 亮度调整)
          fileid: `output/${taskId}/enhanced.png`,
          rule: 'imageMogr2/cut-out|imageMogr2/background/color/ffffff|imageMogr2/sharpen/1|imageMogr2/bright/10'
        }
      ]
    };
  }

  /**
   * 处理云上图片(已在COS) - 使用云上数据处理
   * @param {string} imageUrl - 图片URL
   * @param {Object} picOperations - 处理规则
   */
  async processCloudImage(imageUrl, picOperations) {
    try {
      // 从URL中提取ObjectKey
      const objectKey = this.extractObjectKeyFromUrl(imageUrl);
      if (!objectKey) {
        throw new Error('无法从URL中提取COS对象键');
      }

      logger.info(`[ImageProcessService] 开始云上数据处理`, {
        objectKey,
        rulesCount: picOperations.rules.length
      });

      // 使用COS SDK进行云上数据处理
      const result = await new Promise((resolve, reject) => {
        this.cos.processObject({
          Bucket: this.config.bucket,
          Region: this.config.region,
          Key: objectKey,
          PicOperations: JSON.stringify(picOperations)
        }, (err, data) => {
          if (err) {
            logger.error('[ImageProcessService] 云上数据处理失败', err);
            reject(new Error(`数据万象处理失败: ${err.message}`));
          } else {
            resolve(data);
          }
        });
      });

      // 解析处理结果
      const outputUrls = [];
      if (result.ProcessResults && result.ProcessResults.Object) {
        // 单个结果
        if (!Array.isArray(result.ProcessResults.Object)) {
          result.ProcessResults.Object = [result.ProcessResults.Object];
        }

        result.ProcessResults.Object.forEach(obj => {
          if (obj.Location) {
            // COS返回的Location格式可能是 //bucket-appid.cos.region.myqcloud.com/key
            let url = obj.Location;
            if (url.startsWith('//')) {
              url = 'https:' + url;
            }
            outputUrls.push(url);
          }
        });
      }

      if (outputUrls.length === 0) {
        throw new Error('数据万象处理完成但未返回结果');
      }

      logger.info(`[ImageProcessService] 云上数据处理完成`, {
        inputKey: objectKey,
        outputCount: outputUrls.length
      });

      return outputUrls;

    } catch (error) {
      logger.error('[ImageProcessService] 云上数据处理异常', {
        imageUrl,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 处理外部图片 - 下载后上传到COS进行处理
   * @param {string} taskId - 任务ID
   * @param {string} imageUrl - 外部图片URL
   * @param {Object} picOperations - 处理规则
   */
  async processExternalImage(taskId, imageUrl, picOperations) {
    try {
      logger.info(`[ImageProcessService] 开始处理外部图片`, {
        taskId,
        imageUrl,
        rulesCount: picOperations.rules.length
      });

      // 1. 下载外部图片
      const imageBuffer = await this.downloadImage(imageUrl);
      const originalKey = `input/${taskId}/original.jpg`;

      // 2. 上传原图到COS
      await this.uploadImageToCos(originalKey, imageBuffer, imageUrl);

      // 3. 对刚上传的图片进行数据万象处理
      const uploadedUrl = `https://${this.config.bucket}.cos.${this.config.region}.myqcloud.com/${originalKey}`;
      const resultUrls = await this.processCloudImage(uploadedUrl, picOperations);

      logger.info(`[ImageProcessService] 外部图片处理完成`, {
        taskId,
        originalKey,
        outputCount: resultUrls.length
      });

      return resultUrls;

    } catch (error) {
      logger.error('[ImageProcessService] 外部图片处理异常', {
        taskId,
        imageUrl,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 下载图片
   * @param {string} url - 图片URL
   */
  async downloadImage(url) {
    try {
      logger.info(`[ImageProcessService] 开始下载图片`, { url });

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const buffer = Buffer.from(response.data);
      logger.info(`[ImageProcessService] 图片下载完成`, {
        url,
        size: buffer.length,
        contentType: response.headers['content-type']
      });

      return buffer;
    } catch (error) {
      logger.error(`[ImageProcessService] 下载图片失败: ${error.message}`, { url });
      throw new Error(`下载图片失败: ${error.message}`);
    }
  }

  /**
   * 上传图片到COS
   * @param {string} key - COS对象键
   * @param {Buffer} buffer - 图片数据
   * @param {string} originalUrl - 原始URL（用于获取Content-Type）
   */
  async uploadImageToCos(key, buffer, originalUrl) {
    try {
      logger.info(`[ImageProcessService] 开始上传图片到COS`, {
        key,
        size: buffer.length
      });

      // 获取Content-Type
      let contentType = 'image/jpeg'; // 默认
      try {
        const headResponse = await axios.head(originalUrl, { timeout: 5000 });
        contentType = headResponse.headers['content-type'] || contentType;
      } catch (e) {
        logger.warn(`[ImageProcessService] 无法获取原始图片Content-Type，使用默认值`);
      }

      const result = await new Promise((resolve, reject) => {
        this.cos.putObject({
          Bucket: this.config.bucket,
          Region: this.config.region,
          Key: key,
          Body: buffer,
          ContentType: contentType
        }, (err, data) => {
          if (err) {
            logger.error('[ImageProcessService] COS上传失败', err);
            reject(new Error(`COS上传失败: ${err.message}`));
          } else {
            resolve(data);
          }
        });
      });

      logger.info(`[ImageProcessService] COS上传完成`, {
        key,
        etag: result.ETag
      });

      return result;

    } catch (error) {
      logger.error(`[ImageProcessService] COS上传异常`, {
        key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取图片信息
   * @param {string} imageUrl - 图片URL
   */
  async getImageInfo(imageUrl) {
    try {
      // 调用数据万象imageInfo接口
      const infoUrl = `${imageUrl}?imageInfo`;
      const response = await axios.get(infoUrl, { timeout: 10000 });

      return response.data;
    } catch (error) {
      logger.error(`[ImageProcessService] 获取图片信息失败: ${error.message}`, { imageUrl });
      throw new Error('获取图片信息失败');
    }
  }

  /**
   * 验证图片格式和大小
   * @param {string} imageUrl - 图片URL
   */
  async validateImage(imageUrl) {
    try {
      const info = await this.getImageInfo(imageUrl);

      // 验证格式(仅支持JPG/PNG)
      const format = info.format?.toLowerCase();
      if (!['jpg', 'jpeg', 'png'].includes(format)) {
        throw new Error('不支持的图片格式,仅支持JPG/PNG');
      }

      // 验证大小(最大10MB)
      const maxSize = 10 * 1024 * 1024;
      if (info.size > maxSize) {
        throw new Error('图片大小超过10MB限制');
      }

      // 验证尺寸(最小100x100)
      if (info.width < 100 || info.height < 100) {
        throw new Error('图片尺寸过小,最小100x100像素');
      }

      return true;
    } catch (error) {
      logger.error(`[ImageProcessService] 图片验证失败: ${error.message}`, { imageUrl });
      throw error;
    }
  }

  /**
   * Mock模式处理 - 用于开发测试
   * @param {string} taskId - 任务ID
   * @param {string} inputImageUrl - 输入图片URL
   */
  async mockProcessBasicClean(taskId, inputImageUrl) {
    logger.info(`[ImageProcessService] Mock模式处理基础修图`, { taskId });

    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 生成Mock结果URL
    const mockUrls = [
      `http://localhost:3000/mock-images/${taskId}/matting.png`,
      `http://localhost:3000/mock-images/${taskId}/white-bg.png`,
      `http://localhost:3000/mock-images/${taskId}/enhanced.png`
    ];

    logger.info(`[ImageProcessService] Mock处理完成`, {
      taskId,
      resultCount: mockUrls.length
    });

    return mockUrls;
  }

  /**
   * 从COS URL中提取ObjectKey
   * @param {string} url - COS URL
   */
  extractObjectKeyFromUrl(url) {
    try {
      const urlObj = new URL(url);

      // 检查是否是COS域名
      if (!urlObj.hostname.includes('cos.') || !urlObj.hostname.includes('myqcloud.com')) {
        logger.warn(`[ImageProcessService] 非COS域名URL`, { url });
        return null;
      }

      // 提取路径部分作为ObjectKey
      let objectKey = urlObj.pathname;

      // 移除开头的斜杠
      if (objectKey.startsWith('/')) {
        objectKey = objectKey.substring(1);
      }

      // 移除查询参数
      const queryIndex = objectKey.indexOf('?');
      if (queryIndex > -1) {
        objectKey = objectKey.substring(0, queryIndex);
      }

      return objectKey;

    } catch (error) {
      logger.error(`[ImageProcessService] 解析COS URL失败`, {
        url,
        error: error.message
      });
      return null;
    }
  }

  /**
   * 重试机制
   * @param {Function} fn - 要重试的函数
   * @param {number} maxRetries - 最大重试次数
   * @param {number} delay - 重试间隔(毫秒)
   */
  async retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }

        logger.warn(`[ImageProcessService] 操作失败，准备重试`, {
          attempt: i + 1,
          maxRetries,
          error: error.message
        });

        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
}

module.exports = new ImageProcessService();
