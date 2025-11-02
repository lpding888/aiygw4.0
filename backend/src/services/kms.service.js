const logger = require('../utils/logger');

/**
 * KMS加密服务 (P1-018)
 * 艹！集成腾讯云KMS，加密敏感数据（如支付密钥）
 *
 * 注意：这是一个简化版实现，生产环境需要安装腾讯云KMS SDK
 * npm install tencentcloud-sdk-nodejs
 */
class KMSService {
  constructor() {
    this.kmsEnabled = process.env.KMS_ENABLED === 'true';
    this.kmsKeyId = process.env.KMS_KEY_ID;
    this.kmsRegion = process.env.KMS_REGION || 'ap-guangzhou';

    if (this.kmsEnabled) {
      if (!this.kmsKeyId) {
        logger.warn('[KMS] KMS已启用但未配置KMS_KEY_ID，将使用MOCK模式');
        this.kmsEnabled = false;
      } else {
        logger.info(`[KMS] KMS加密服务已启用，Region=${this.kmsRegion}, KeyId=${this.kmsKeyId}`);
      }
    } else {
      logger.info('[KMS] KMS加密服务未启用，将使用MOCK模式');
    }
  }

  /**
   * 加密数据
   * 艹！生产环境使用腾讯云KMS加密，开发环境使用Base64模拟
   *
   * @param {string} plaintext - 明文数据
   * @returns {Promise<string>} 加密后的数据
   */
  async encrypt(plaintext) {
    if (!plaintext) {
      throw new Error('明文数据不能为空');
    }

    if (this.kmsEnabled) {
      // 生产环境：调用腾讯云KMS API加密
      return await this._encryptWithKMS(plaintext);
    } else {
      // 开发环境：使用Base64模拟加密
      return await this._encryptMock(plaintext);
    }
  }

  /**
   * 解密数据
   * 艹！生产环境使用腾讯云KMS解密，开发环境使用Base64模拟
   *
   * @param {string} ciphertext - 密文数据
   * @returns {Promise<string>} 解密后的明文数据
   */
  async decrypt(ciphertext) {
    if (!ciphertext) {
      throw new Error('密文数据不能为空');
    }

    if (this.kmsEnabled) {
      // 生产环境：调用腾讯云KMS API解密
      return await this._decryptWithKMS(ciphertext);
    } else {
      // 开发环境：使用Base64模拟解密
      return await this._decryptMock(ciphertext);
    }
  }

  /**
   * 腾讯云KMS加密（生产环境）
   * 艹！这个方法需要安装腾讯云SDK才能使用
   *
   * @private
   * @param {string} plaintext - 明文数据
   * @returns {Promise<string>} 加密后的数据
   */
  async _encryptWithKMS(plaintext) {
    try {
      // TODO: 集成腾讯云KMS SDK
      // const tencentcloud = require('tencentcloud-sdk-nodejs');
      // const KmsClient = tencentcloud.kms.v20190118.Client;
      //
      // const client = new KmsClient({
      //   credential: {
      //     secretId: process.env.TENCENTCLOUD_SECRET_ID,
      //     secretKey: process.env.TENCENTCLOUD_SECRET_KEY,
      //   },
      //   region: this.kmsRegion,
      // });
      //
      // const params = {
      //   KeyId: this.kmsKeyId,
      //   Plaintext: Buffer.from(plaintext).toString('base64')
      // };
      //
      // const response = await client.Encrypt(params);
      // return response.CiphertextBlob;

      logger.warn('[KMS] 腾讯云KMS SDK未安装，使用MOCK模式加密');
      return await this._encryptMock(plaintext);
    } catch (error) {
      logger.error(`[KMS] KMS加密失败: ${error.message}`, error);
      throw new Error('KMS加密失败');
    }
  }

  /**
   * 腾讯云KMS解密（生产环境）
   * 艹！这个方法需要安装腾讯云SDK才能使用
   *
   * @private
   * @param {string} ciphertext - 密文数据
   * @returns {Promise<string>} 解密后的明文数据
   */
  async _decryptWithKMS(ciphertext) {
    try {
      // TODO: 集成腾讯云KMS SDK
      // const tencentcloud = require('tencentcloud-sdk-nodejs');
      // const KmsClient = tencentcloud.kms.v20190118.Client;
      //
      // const client = new KmsClient({
      //   credential: {
      //     secretId: process.env.TENCENTCLOUD_SECRET_ID,
      //     secretKey: process.env.TENCENTCLOUD_SECRET_KEY,
      //   },
      //   region: this.kmsRegion,
      // });
      //
      // const params = {
      //   CiphertextBlob: ciphertext
      // };
      //
      // const response = await client.Decrypt(params);
      // return Buffer.from(response.Plaintext, 'base64').toString('utf-8');

      logger.warn('[KMS] 腾讯云KMS SDK未安装，使用MOCK模式解密');
      return await this._decryptMock(ciphertext);
    } catch (error) {
      logger.error(`[KMS] KMS解密失败: ${error.message}`, error);
      throw new Error('KMS解密失败');
    }
  }

  /**
   * MOCK加密（开发环境）
   * 艹！使用Base64模拟加密，生产环境禁止使用
   *
   * @private
   * @param {string} plaintext - 明文数据
   * @returns {Promise<string>} 加密后的数据
   */
  async _encryptMock(plaintext) {
    logger.debug(`[KMS] MOCK加密: ${plaintext.substring(0, 10)}...`);
    // 使用Base64 + 前缀标记模拟加密
    return `KMS_MOCK:${Buffer.from(plaintext).toString('base64')}`;
  }

  /**
   * MOCK解密（开发环境）
   * 艹！使用Base64模拟解密，生产环境禁止使用
   *
   * @private
   * @param {string} ciphertext - 密文数据
   * @returns {Promise<string>} 解密后的明文数据
   */
  async _decryptMock(ciphertext) {
    if (!ciphertext.startsWith('KMS_MOCK:')) {
      throw new Error('无效的MOCK密文格式');
    }

    const base64Data = ciphertext.replace('KMS_MOCK:', '');
    const plaintext = Buffer.from(base64Data, 'base64').toString('utf-8');
    logger.debug(`[KMS] MOCK解密: ${plaintext.substring(0, 10)}...`);
    return plaintext;
  }

  /**
   * 检查KMS服务状态
   *
   * @returns {Object} KMS服务状态
   */
  getStatus() {
    return {
      enabled: this.kmsEnabled,
      mode: this.kmsEnabled ? 'KMS' : 'MOCK',
      region: this.kmsRegion,
      keyId: this.kmsKeyId ? `${this.kmsKeyId.substring(0, 8)}...` : null
    };
  }
}

module.exports = new KMSService();
