const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * JWT认证中间件
 */
async function authenticate(req, res, next) {
  try {
    // 获取token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 1001,
          message: '未登录'
        }
      });
    }

    const token = authHeader.substring(7);

    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 将用户信息附加到请求对象
    req.userId = decoded.userId;
    req.user = decoded;

    next();
  } catch (error) {
    logger.error('JWT验证失败:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 1001,
          message: '登录已过期,请重新登录'
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 1001,
        message: 'Token无效'
      }
    });
  }
}

/**
 * 可选认证中间件(用于某些接口既可登录也可不登录访问)
 */
async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      req.user = decoded;
    }
    next();
  } catch (error) {
    // 可选认证失败不阻止请求继续
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuthenticate
};
