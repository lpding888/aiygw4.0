/**
 * Admin 权限验证中间件
 * 用于保护管理后台 API,只允许 admin 角色访问
 */

const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * 验证用户是否为管理员
 * 必须在 authenticate 中间件之后使用
 */
async function requireAdmin(req, res, next) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 4001, message: '未登录' }
      });
    }

    // 从数据库查询用户角色
    const user = await db('users')
      .where('id', userId)
      .first('id', 'phone', 'role');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 4004, message: '用户不存在' }
      });
    }

    // 检查是否为 admin 角色
    if (user.role !== 'admin') {
      logger.warn(`[AdminAuth] 非管理员尝试访问管理接口 userId=${userId} role=${user.role}`);

      return res.status(403).json({
        success: false,
        error: { code: 4003, message: '无权访问,仅限管理员' }
      });
    }

    // 将用户信息附加到 request,供后续使用
    req.admin = {
      id: user.id,
      phone: user.phone,
      role: user.role
    };

    next();
  } catch (error) {
    logger.error(`[AdminAuth] 权限验证失败: ${error.message}`, { userId: req.user?.id, error });

    return res.status(500).json({
      success: false,
      error: { code: 9999, message: '服务器内部错误' }
    });
  }
}

module.exports = {
  requireAdmin
};
