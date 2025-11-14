import crypto from 'crypto';
import logger from './logger.js';
import secretVault from '../services/security/secret-vault.js';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_VERSION = 'v1';

/**
 * 通用密钥管理工具
 * 艹，这玩意负责系统配置、Provider密钥等敏感字段的加解密
 */
class SecretManager {
  private readonly key: Buffer;

  constructor() {
    this.key = secretVault.getCredentialKey();
  }

  encrypt(plaintext: string, version: string = DEFAULT_VERSION): string {
    if (!plaintext) {
      throw new Error('无法加密空字符串');
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${version}:${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
  }

  decrypt(payload: string | null): string | null {
    if (!payload) {
      return null;
    }

    const segments = payload.split(':');
    if (segments.length !== 4) {
      throw new Error('密文格式错误');
    }

    const [version, ivHex, dataHex, tagHex] = segments;
    if (version !== DEFAULT_VERSION) {
      throw new Error(`不支持的密钥版本: ${version}`);
    }

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const ciphertext = Buffer.from(dataHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (error) {
      const err = error as Error;
      logger.error(`[SecretManager] 密文解密失败: ${err.message}`);
      throw err;
    }
  }

  mask(value: string | null, visible = 4): string {
    if (!value || value.length === 0) {
      return '***';
    }

    if (value.length <= visible * 2) {
      return '*'.repeat(value.length);
    }

    const prefix = value.slice(0, visible);
    const suffix = value.slice(-visible);
    return `${prefix}${'*'.repeat(Math.max(value.length - visible * 2, 4))}${suffix}`;
  }
}

const secretManager = new SecretManager();
export default secretManager;
