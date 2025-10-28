const tencentcloud = require('tencentcloud-sdk-nodejs');
const COS = require('cos-nodejs-sdk-v5');
const logger = require('../utils/logger');
const taskService = require('./task.service');

// 腾讯云图片内容审核客户端
const ImsClient = tencentcloud.ims.v20201229.Client;

/**
 * 内容审核服务 - 集成腾讯云图片内容审核
 */
class ContentAuditService {
  constructor() {
    this.config = {
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY,
      region: process.env.TENCENT_COS_REGION || 'ap-guangzhou',
      bucket: process.env.TENCENT_COS_BUCKET
    };

    // 初始化审核客户端
    this.imsClient = new ImsClient({
      credential: {
        secretId: this.config.secretId,
        secretKey: this.config.secretKey
      },
      region: this.config.region
    });

    // 初始化COS客户端(用于删除违规图片)
    this.cos = new COS({
      SecretId: this.config.secretId,
      SecretKey: this.config.secretKey
    });
  }

  /**
   * 审核单张图片
   * @param {string} imageUrl - 图片URL
   * @returns {Object} 审核结果 { pass: boolean, reason: string }
   */
  async auditImage(imageUrl) {
    try {
      logger.info(`[ContentAudit] 开始审核图片: ${imageUrl}`);

      const params = {
        FileUrl: imageUrl,
        Biztype: 'default' // 使用默认策略,检测色情、暴力、违法等
      };

      const response = await this.imsClient.ImageModeration(params);
      const result = response.Data;

      // 审核结果判断
      // Suggestion: Pass(通过) | Block(拦截) | Review(人工复审)
      const suggestion = result.Suggestion;
      const pass = suggestion === 'Pass';

      // 收集违规原因
      let reason = '';
      if (!pass) {
        const labels = [];
        
        // 色情内容
        if (result.PornInfo && result.PornInfo.HitFlag === 1) {
          labels.push(`色情(${result.PornInfo.Label})`);
        }
        
        // 暴力内容
        if (result.TerrorismInfo && result.TerrorismInfo.HitFlag === 1) {
          labels.push(`暴力(${result.TerrorismInfo.Label})`);
        }
        
        // 违法内容
        if (result.IllegalInfo && result.IllegalInfo.HitFlag === 1) {
          labels.push(`违法(${result.IllegalInfo.Label})`);
        }
        
        // 广告内容
        if (result.AdsInfo && result.AdsInfo.HitFlag === 1) {
          labels.push(`广告(${result.AdsInfo.Label})`);
        }

        reason = labels.length > 0 ? labels.join(', ') : '内容不合规';
      }

      logger.info(`[ContentAudit] 审核完成: ${imageUrl} pass=${pass} reason=${reason}`);

      return {
        pass,
        reason,
        suggestion,
        rawResult: result
      };

    } catch (error) {
      logger.error(`[ContentAudit] 审核图片失败: ${error.message}`, { imageUrl, error });
      // 审核失败时默认通过,避免误杀
      return {
        pass: true,
        reason: '',
        error: error.message
      };
    }
  }

  /**
   * 审核任务的所有输出图片
   * @param {string} taskId - 任务ID
   * @param {Array<string>} resultUrls - 结果图片URL列表
   */
  async auditTaskResults(taskId, resultUrls) {
    try {
      logger.info(`[ContentAudit] 开始审核任务结果 taskId=${taskId} imageCount=${resultUrls.length}`);

      const auditResults = [];
      let hasViolation = false;
      const violationReasons = [];

      // 逐张审核
      for (const url of resultUrls) {
        const result = await this.auditImage(url);
        auditResults.push({
          url,
          ...result
        });

        if (!result.pass) {
          hasViolation = true;
          violationReasons.push(`${url}: ${result.reason}`);
        }
      }

      // 如果有违规内容,处理失败流程
      if (hasViolation) {
        logger.warn(`[ContentAudit] 任务包含违规内容 taskId=${taskId}`, { violationReasons });

        // 1. 删除所有结果图片
        await this.deleteResultImages(resultUrls);

        // 2. 更新任务状态为失败
        await taskService.updateStatus(taskId, 'failed', {
          errorMessage: `内容审核未通过: ${violationReasons.join('; ')}`
        });

        logger.info(`[ContentAudit] 已删除违规图片并标记任务失败 taskId=${taskId}`);

        return {
          pass: false,
          reasons: violationReasons,
          auditResults
        };
      }

      logger.info(`[ContentAudit] 任务审核通过 taskId=${taskId}`);

      return {
        pass: true,
        auditResults
      };

    } catch (error) {
      logger.error(`[ContentAudit] 审核任务结果失败: ${error.message}`, { taskId, error });
      throw error;
    }
  }

  /**
   * 删除结果图片(从COS中删除)
   * @param {Array<string>} imageUrls - 图片URL列表
   */
  async deleteResultImages(imageUrls) {
    try {
      const deletePromises = imageUrls.map(url => {
        // 从URL提取Key
        // https://bucket-xxx.cos.ap-guangzhou.myqcloud.com/output/taskId/xxx.png
        const urlObj = new URL(url);
        const key = urlObj.pathname.substring(1); // 去掉开头的/

        return new Promise((resolve, reject) => {
          this.cos.deleteObject(
            {
              Bucket: this.config.bucket,
              Region: this.config.region,
              Key: key
            },
            (err, data) => {
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
      });

      await Promise.all(deletePromises);
      logger.info(`[ContentAudit] 批量删除图片完成 count=${imageUrls.length}`);

    } catch (error) {
      logger.error(`[ContentAudit] 批量删除图片失败: ${error.message}`, error);
      // 删除失败不抛出错误,避免影响主流程
    }
  }

  /**
   * 获取审核统计信息(管理后台使用)
   */
  async getAuditStats() {
    try {
      // 这里可以扩展,统计审核拦截率、违规类型分布等
      // 暂时返回基础信息
      return {
        enabled: true,
        provider: 'Tencent Cloud IMS',
        region: this.config.region
      };
    } catch (error) {
      logger.error(`[ContentAudit] 获取审核统计失败: ${error.message}`, error);
      throw error;
    }
  }
}

module.exports = new ContentAuditService();

