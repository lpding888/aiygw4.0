const authService = require('../services/auth.service');
const logger = require('../utils/logger');

/**
 * 认证控制器
 */
class AuthController {
  /**
   * 发送验证码
   * POST /api/auth/send-code
   */
  async sendCode(req, res, next) {
    try {
      const { phone } = req.body;

      // 参数验证
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 2000,
            message: '手机号格式错误'
          }
        });
      }

      const ip = req.ip || req.connection.remoteAddress;
      const result = await authService.sendCode(phone, ip);

      res.json({
        success: true,
        data: result,
        message: '验证码已发送'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 登录/注册
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { phone, code } = req.body;

      // 参数验证
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 2000,
            message: '手机号格式错误'
          }
        });
      }

      if (!code || !/^\d{6}$/.test(code)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 2002,
            message: '验证码格式错误'
          }
        });
      }

      const result = await authService.login(phone, code);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取当前用户信息
   * GET /api/auth/me
   */
  async getMe(req, res, next) {
    try {
      const userId = req.userId;
      const user = await authService.getUser(userId);

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
