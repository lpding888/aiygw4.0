const logger = require('../utils/logger');

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // 默认错误响应
  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 9999;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message
    }
  });
}

/**
 * 404处理中间件
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 404,
      message: '接口不存在'
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
