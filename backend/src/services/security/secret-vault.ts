import crypto from 'node:crypto';
import logger from '../../utils/logger.js';

const MASTER_KEY_BYTES = 32;
const CREDENTIAL_KEY_BYTES = 32;

const toBufferFromBase64 = (value: string): Buffer => Buffer.from(value, 'base64');
const toBufferFromHex = (value: string): Buffer => Buffer.from(value, 'hex');

class SecretVault {
  private readonly masterKey: Buffer;
  private readonly credentialKey: Buffer;

  constructor() {
    this.masterKey = this.loadMasterKey();
    this.credentialKey = this.loadCredentialKey();
  }

  private loadMasterKey(): Buffer {
    const raw = process.env.MASTER_KEY;
    if (!raw) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('MASTER_KEY 未设置。生产环境必须提供 32 字节 Base64 密钥');
      }

      const tempKey = crypto.randomBytes(MASTER_KEY_BYTES);
      logger.warn('[SecretVault] 未配置 MASTER_KEY，生成临时密钥（仅限本地/测试环境）');
      return tempKey;
    }

    try {
      const buf = toBufferFromBase64(raw);
      if (buf.length !== MASTER_KEY_BYTES) {
        throw new Error(
          `MASTER_KEY 长度错误：期望 ${MASTER_KEY_BYTES} 字节，实际 ${buf.length} 字节`
        );
      }
      return buf;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`加载MASTER_KEY失败: ${err.message}`);
    }
  }

  private loadCredentialKey(): Buffer {
    const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
    if (!raw) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CREDENTIALS_ENCRYPTION_KEY 未配置，无法加密敏感凭证');
      }
      const tempKey = crypto.randomBytes(CREDENTIAL_KEY_BYTES);
      logger.warn(
        '[SecretVault] 未配置 CREDENTIALS_ENCRYPTION_KEY，生成临时密钥（仅限本地/测试环境）'
      );
      return tempKey;
    }

    if (raw.length !== CREDENTIAL_KEY_BYTES * 2) {
      throw new Error('CREDENTIALS_ENCRYPTION_KEY 必须是32字节（64位hex）字符串');
    }

    return toBufferFromHex(raw);
  }

  public getMasterKey(): Buffer {
    return this.masterKey;
  }

  public getCredentialKey(): Buffer {
    return this.credentialKey;
  }
}

const secretVault = new SecretVault();
export default secretVault;
