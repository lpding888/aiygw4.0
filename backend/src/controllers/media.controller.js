const mediaService = require('../services/media.service');
const logger = require('../utils/logger');

/**
 * 媒体控制器 - 处理COS上传相关请求
 */
class MediaController {
  /**
   * 获取STS临时密钥
   * GET /api/media/sts?taskId=xxx
   */
  async getSTS(req, res, next) {
    try {
      const { taskId } = req.query;
      const userId = req.user.id; // 从JWT中获取用户ID

      // 获取STS临时凭证
      const stsData = await mediaService.getSTS(userId, taskId);

      logger.info(`[MediaController] STS密钥发放成功 userId=${userId} taskId=${stsData.taskId}`);

      res.json({
        success: true,
        data: stsData
      });

    } catch (error) {
      logger.error(`[MediaController] 获取STS失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 验证文件上传参数
   * POST /api/media/validate
   */
  async validateUpload(req, res, next) {
    try {
      const { fileName, fileSize } = req.body;

      // 验证文件大小(10MB)
      mediaService.validateFileSize(fileSize, 10 * 1024 * 1024);

      // 验证文件类型
      mediaService.validateFileType(fileName, ['jpg', 'jpeg', 'png']);

      res.json({
        success: true,
        message: '文件验证通过'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: error.message
        }
      });
    }
  }
}

module.exports = new MediaController();
