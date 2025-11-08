import crypto from 'crypto';
import logger from './logger.js';

/**
 * 敏感信息加密工具
 * 使用AES-256-CBC算法加密身份证号等敏感信息
 * 艹，身份证号这种隐私信息必须加密存储！
 */
class EncryptionUtils {
  private readonly algorithm: string;
  private readonly key: Buffer;

  constructor() {
    this.algorithm = 'aes-256-cbc';

    // 从环境变量读取密钥（必须是32字节的hex字符串）
    const key = process.env.CREDENTIALS_ENCRYPTION_KEY;

    if (!key) {
      throw new Error('CREDENTIALS_ENCRYPTION_KEY环境变量未设置！');
    }

    if (key.length !== 64) {
      throw new Error('CREDENTIALS_ENCRYPTION_KEY必须是64位hex字符串（32字节）');
    }

    this.key = Buffer.from(key, 'hex');
  }

  /**
   * 加密身份证号
   * @param idCard - 明文身份证号
   * @returns 加密后的身份证号（格式: iv:encrypted）
   */
  encryptIdCard(idCard: string | null | undefined): string | null {
    try {
      if (!idCard) {
        return null;
      }

      // 生成随机IV
      const iv = crypto.randomBytes(16);

      // 创建加密器
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // 加密
      let encrypted = cipher.update(idCard, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // 返回格式: iv:encrypted
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      const err = error as Error;
      logger.error('身份证号加密失败: ' + err.message);
      throw error;
    }
  }

  /**
   * 解密身份证号
   * @param encryptedIdCard - 加密的身份证号（格式: iv:encrypted）
   * @returns 明文身份证号
   */
  decryptIdCard(encryptedIdCard: string | null | undefined): string | null {
    try {
      if (!encryptedIdCard) {
        return null;
      }

      // 分离IV和加密内容
      const parts = encryptedIdCard.split(':');
      if (parts.length !== 2) {
        throw new Error('加密格式错误');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      // 创建解密器
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

      // 解密
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      const err = error as Error;
      logger.error('身份证号解密失败: ' + err.message);
      throw error;
    }
  }

  /**
   * 身份证号脱敏显示
   * @param idCard - 明文身份证号
   * @returns 脱敏后的身份证号（格式: 110101********1234）
   */
  maskIdCard(idCard: string | null | undefined): string | null {
    if (!idCard) {
      return null;
    }

    // 保留前6位和后4位，中间用*代替
    return idCard.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2');
  }

  /**
   * 解密并脱敏身份证号
   * @param encryptedIdCard - 加密的身份证号
   * @returns 脱敏后的身份证号
   */
  decryptAndMaskIdCard(encryptedIdCard: string | null | undefined): string {
    try {
      const decrypted = this.decryptIdCard(encryptedIdCard);
      return this.maskIdCard(decrypted) ?? '********';
    } catch (error) {
      const err = error as Error;
      logger.error('解密并脱敏身份证号失败: ' + err.message);
      return '********';
    }
  }
}

// 导出单例
const encryptionUtils = new EncryptionUtils();
export default encryptionUtils;
