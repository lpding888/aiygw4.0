const crypto = require('crypto');
const logger = require('./logger');

/**
 * 加密工具 - 用于加密敏感数据(如provider credentials)
 * 使用AES-256-GCM算法
 */

// 从环境变量获取加密密钥,如果未设置则使用默认值(仅开发环境)
const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY || 'default-dev-key-please-change-in-production-32chars';

// 确保密钥长度为32字节(256位)
function getEncryptionKey() {
  const key = Buffer.from(ENCRYPTION_KEY);
  if (key.length !== 32) {
    // 如果密钥长度不是32字节,使用SHA256哈希生成固定长度密钥
    return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  }
  return key;
}

/**
 * 加密数据
 * @param {string} plainText - 明文
 * @returns {string} 加密后的数据(格式: iv:authTag:encryptedData,全部base64编码)
 */
function encrypt(plainText) {
  try {
    if (!plainText) {
      throw new Error('plainText不能为空');
    }

    // 生成随机IV(初始化向量)
    const iv = crypto.randomBytes(16);

    // 创建加密器
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);

    // 加密数据
    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // 获取认证标签
    const authTag = cipher.getAuthTag();

    // 返回格式: iv:authTag:encryptedData
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;

  } catch (error) {
    logger.error(`[Encryption] 加密失败: ${error.message}`);
    throw new Error('数据加密失败');
  }
}

/**
 * 解密数据
 * @param {string} encryptedText - 加密的数据(格式: iv:authTag:encryptedData)
 * @returns {string} 明文
 */
function decrypt(encryptedText) {
  try {
    if (!encryptedText) {
      throw new Error('encryptedText不能为空');
    }

    // 分离IV、authTag和加密数据
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('加密数据格式错误');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = parts[2];

    // 创建解密器
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);

    // 解密数据
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;

  } catch (error) {
    logger.error(`[Encryption] 解密失败: ${error.message}`);
    throw new Error('数据解密失败');
  }
}

/**
 * 加密JSON对象
 * @param {Object} obj - 要加密的对象
 * @returns {string} 加密后的字符串
 */
function encryptJSON(obj) {
  try {
    const jsonStr = JSON.stringify(obj);
    return encrypt(jsonStr);
  } catch (error) {
    logger.error(`[Encryption] JSON加密失败: ${error.message}`);
    throw new Error('JSON加密失败');
  }
}

/**
 * 解密JSON对象
 * @param {string} encryptedText - 加密的字符串
 * @returns {Object} 解密后的对象
 */
function decryptJSON(encryptedText) {
  try {
    const jsonStr = decrypt(encryptedText);
    return JSON.parse(jsonStr);
  } catch (error) {
    logger.error(`[Encryption] JSON解密失败: ${error.message}`);
    throw new Error('JSON解密失败');
  }
}

/**
 * 生成HMAC签名
 * @param {string} data - 要签名的数据
 * @param {string} secret - 密钥
 * @returns {string} 签名(hex格式)
 */
function generateHMAC(data, secret) {
  try {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  } catch (error) {
    logger.error(`[Encryption] HMAC签名生成失败: ${error.message}`);
    throw new Error('签名生成失败');
  }
}

/**
 * 验证HMAC签名
 * @param {string} data - 原始数据
 * @param {string} signature - 签名
 * @param {string} secret - 密钥
 * @returns {boolean} 是否验证通过
 */
function verifyHMAC(data, signature, secret) {
  try {
    const expectedSignature = generateHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error(`[Encryption] HMAC签名验证失败: ${error.message}`);
    return false;
  }
}

/**
 * 生成随机密钥
 * @param {number} length - 密钥长度(字节)
 * @returns {string} base64编码的随机密钥
 */
function generateRandomKey(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

module.exports = {
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  generateHMAC,
  verifyHMAC,
  generateRandomKey
};
