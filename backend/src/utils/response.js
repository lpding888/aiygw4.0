/**
 * 统一响应格式工具
 */

/**
 * 创建成功响应
 * @param {*} data 响应数据
 * @param {string} message 响应消息
 * @param {number} code HTTP状态码
 * @returns {Object} 标准响应格式
 */
function createSuccessResponse(data = null, message = '操作成功', code = 200) {
  return {
    success: true,
    code,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * 创建错误响应
 * @param {string} error 错误代码
 * @param {string} message 错误消息
 * @param {*} details 错误详情
 * @param {number} code HTTP状态码
 * @returns {Object} 标准错误响应格式
 */
function createErrorResponse(error, message = '操作失败', details = null, code = 400) {
  return {
    success: false,
    code,
    error,
    message,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * 创建分页响应
 * @param {Array} items 数据列表
 * @param {number} total 总数量
 * @param {number} page 当前页码
 * @param {number} limit 每页数量
 * @param {string} message 响应消息
 * @returns {Object} 分页响应格式
 */
function createPaginatedResponse(items, total, page, limit, message = '获取数据成功') {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    code: 200,
    message,
    data: {
      items,
      pagination: {
        current: page,
        total: totalPages,
        pageSize: limit,
        totalCount: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse
};