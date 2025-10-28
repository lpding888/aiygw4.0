const crypto = require('crypto');

/**
 * 生成随机ID
 * @param {number} length - ID长度
 * @returns {string}
 */
function generateId(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 生成随机seed (1 ~ 2147483647)
 * @returns {number}
 */
function generateSeed() {
  return Math.floor(Math.random() * 2147483647) + 1;
}

/**
 * 生成验证码
 * @param {number} length - 验证码长度
 * @returns {string}
 */
function generateCode(length = 6) {
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0');
}

/**
 * 生成订单号
 * @returns {string}
 */
function generateOrderId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `order_${timestamp}${random}`;
}

/**
 * 生成任务ID
 * @returns {string}
 */
function generateTaskId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `task_${timestamp}${random}`;
}

module.exports = {
  generateId,
  generateSeed,
  generateCode,
  generateOrderId,
  generateTaskId
};
