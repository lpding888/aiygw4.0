const crypto = require('crypto');
const { knex } = require('../db/connection');
const logger = require('../utils/logger');

/**
 * 简易 KMS 服务
 *
 * - 采用 AES-256-GCM 对敏感信息进行应用层加密
 * - 使用 kms_secrets 表持久化密文
 * - 提供 encrypt/decrypt/delete/rotate 等能力
 */
class KMSService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 12; // GCM 推荐 96 bit
  private masterKey: Buffer;
  private fallbackKeyGenerated = false;

  constructor() {
    this.masterKey = this.loadMasterKey();
  }

  /**
   * 加密敏感信息并保存
   */
  async encrypt(plaintext: string, reference?: string, scope?: string): Promise<{ id: string; reference?: string }> {
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('待加密数据不能为空');
    }

    const id = reference || this.generateId();
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const payload = {
      id,
      reference: reference || null,
      scope: scope || null,
      ciphertext: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      auth_tag: authTag.toString('hex'),
      updated_at: new Date()
    };

    try {
      await knex('kms_secrets').insert({
        ...payload,
        created_at: new Date()
      });
    } catch (error) {
      // 如果主键冲突，则执行更新（密钥轮换场景）
      if (error.code === 'ER_DUP_ENTRY' || error.code === 'SQLITE_CONSTRAINT' || error.code === '23505') {
        await knex('kms_secrets')
          .where({ id })
          .update(payload);
      } else {
        logger.error('[KMS] 保存密钥失败:', error);
        throw error;
      }
    }

    logger.debug('[KMS] Secret encrypted', { reference: reference || id, scope });
    return { id, reference };
  }

  /**
   * 解密敏感信息
   */
  async decrypt(id: string): Promise<string> {
    if (!id) {
      throw new Error('密钥 ID 不能为空');
    }

    const secret = await knex('kms_secrets')
      .where({ id })
      .first();

    if (!secret) {
      throw new Error(`密钥不存在: ${id}`);
    }

    const iv = Buffer.from(secret.iv, 'hex');
    const ciphertext = Buffer.from(secret.ciphertext, 'hex');
    const authTag = Buffer.from(secret.auth_tag, 'hex');

    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * 删除密钥
   */
  async delete(id: string): Promise<boolean> {
    if (!id) {
      return false;
    }

    const deleted = await knex('kms_secrets')
      .where({ id })
      .del();

    if (deleted) {
      logger.debug('[KMS] Secret deleted', { id });
    }

    return Boolean(deleted);
  }

  /**
   * 对外暴露的脱敏输出
   */
  maskSecret(value: string, visible = 4): string {
    if (!value) {
      return '';
    }

    const trimmed = value.trim();
    if (trimmed.length <= visible * 2) {
      return '*'.repeat(Math.max(trimmed.length - visible, 0)) + trimmed.slice(-visible);
    }

    return `${trimmed.slice(0, visible)}${'*'.repeat(trimmed.length - visible * 2)}${trimmed.slice(-visible)}`;
  }

  /**
   * 轮换主密钥（需要预先保证新旧密钥并行）
   * 这里只提供基础实现，实际生产应使用事务与重试。
   */
  async rotateMasterKey(newKeyMaterial: string): Promise<void> {
    const previousKey = this.masterKey;
    this.masterKey = this.normalizeKey(newKeyMaterial);

    const secrets = await knex('kms_secrets').select('id', 'ciphertext', 'iv', 'auth_tag');

    for (const secret of secrets) {
      const plaintext = await this.decryptWithKey(secret, previousKey);
      await this.encrypt(plaintext, secret.id);
    }

    logger.info('[KMS] Master key rotated, secrets re-encrypted');
  }

  // ============ 内部实现 ============

  private loadMasterKey(): Buffer {
    const envKey = process.env.KMS_MASTER_KEY || process.env.PROVIDER_SECRET_KEY;
    if (!envKey) {
      this.fallbackKeyGenerated = true;
      logger.warn('[KMS] 未配置 KMS_MASTER_KEY，将生成临时密钥（仅适用于开发环境）');
      return crypto.randomBytes(32);
    }

    return this.normalizeKey(envKey);
  }

  private normalizeKey(rawKey: string): Buffer {
    try {
      if (/^[0-9a-fA-F]+$/.test(rawKey) && rawKey.length === 64) {
        return Buffer.from(rawKey, 'hex');
      }

      if (/^[A-Za-z0-9+/=]+$/.test(rawKey)) {
        const buffer = Buffer.from(rawKey, 'base64');
        if (buffer.length === 32) {
          return buffer;
        }
      }

      const hashed = crypto.createHash('sha256').update(rawKey).digest();
      return hashed;
    } catch (error) {
      logger.error('[KMS] 解析主密钥失败，回退至随机密钥:', error);
      return crypto.randomBytes(32);
    }
  }

  private generateId(): string {
    return `kms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private async decryptWithKey(
    secret: { ciphertext: string; iv: string; auth_tag: string },
    key: Buffer
  ): Promise<string> {
    const iv = Buffer.from(secret.iv, 'hex');
    const ciphertext = Buffer.from(secret.ciphertext, 'hex');
    const authTag = Buffer.from(secret.auth_tag, 'hex');

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }
}

const kmsService = new KMSService();

module.exports = kmsService;
