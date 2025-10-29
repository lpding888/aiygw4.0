const featureService = require('../services/feature.service');
const logger = require('../utils/logger');

/**
 * Feature Controller - 功能卡片控制器
 * 处理功能卡片相关的HTTP请求
 */
class FeatureController {
  /**
   * GET /api/features
   * 获取当前用户可用的功能卡片列表
   */
  async getFeatures(req, res) {
    try {
      const userId = req.user.id; // 从JWT中间件获取用户ID

      const features = await featureService.getAvailableFeatures(userId);

      res.json({
        success: true,
        features
      });

    } catch (error) {
      logger.error(`[FeatureController] 获取功能列表失败: ${error.message}`, { error });
      res.status(error.statusCode || 500).json({
        success: false,
        errorCode: error.errorCode || 5000,
        message: error.message || '获取功能列表失败'
      });
    }
  }

  /**
   * GET /api/features/:featureId/form-schema
   * 获取功能的表单Schema
   */
  async getFormSchema(req, res) {
    try {
      const { featureId } = req.params;
      const userId = req.user.id;

      const formSchema = await featureService.getFormSchema(featureId, userId);

      res.json({
        success: true,
        ...formSchema
      });

    } catch (error) {
      logger.error(`[FeatureController] 获取表单Schema失败: ${error.message}`, { error });
      res.status(error.statusCode || 500).json({
        success: false,
        errorCode: error.errorCode || 5000,
        message: error.message || '获取表单Schema失败'
      });
    }
  }
}

module.exports = new FeatureController();
