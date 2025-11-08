import crypto from 'crypto';

/**
 * 生成随机ID
 * @param length - ID长度
 * @returns 随机ID字符串
 */
export function generateId(length = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 生成随机seed (1 ~ 2147483647)
 * @returns 随机seed数字
 */
export function generateSeed(): number {
  return Math.floor(Math.random() * 2147483647) + 1;
}

/**
 * 生成验证码
 * @param length - 验证码长度
 * @returns 验证码字符串
 */
export function generateCode(length = 6): string {
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0');
}

/**
 * 生成订单号
 * @returns 订单号字符串
 */
export function generateOrderId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `order_${timestamp}${random}`;
}

/**
 * 生成任务ID
 * @returns 任务ID字符串
 */
export function generateTaskId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `task_${timestamp}${random}`;
}

// 默认导出，兼容旧的require方式
export default {
  generateId,
  generateSeed,
  generateCode,
  generateOrderId,
  generateTaskId
};
