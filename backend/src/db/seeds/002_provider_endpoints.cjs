/**
 * Seed: provider_endpoints 表数据 (适配新表结构)
 * 初始化内部云函数服务的端点信息
 *
 * 表结构:
 * - provider_ref: 主键，提供商引用ID
 * - provider_name: 提供商名称
 * - endpoint_url: 端点URL
 * - credentials_encrypted: 加密的凭证(JSON字符串)
 * - auth_type: 认证类型
 */

const crypto = require('crypto');

/**
 * 加密敏感信息（AES-256-CBC）
 * @returns {string} 加密后的十六进制字符串格式: iv:encrypted
 */
function encrypt(text) {
  if (!text) return '';

  const algorithm = 'aes-256-cbc';
  const encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY_V1;

  if (!encryptionKey) {
    console.warn('⚠️  警告：缺少加密密钥，使用默认值');
    // 使用固定的开发环境密钥
    const key = crypto.createHash('sha256').update('dev-encryption-key').digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  let key;
  if (encryptionKey.length === 64 && /^[0-9a-fA-F]+$/.test(encryptionKey)) {
    key = Buffer.from(encryptionKey, 'hex');
  } else {
    key = crypto.createHash('sha256').update(encryptionKey).digest();
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

exports.seed = async function (knex) {
  // 1. 清空旧数据
  await knex('provider_endpoints')
    .whereIn('provider_ref', [
      'internal_scf_video_compositor',
      'internal_scf_image_compositor',
      'internal_scf_text_processor'
    ])
    .del();

  // 2. 准备数据
  const services = [
    {
      ref: 'internal_scf_video_compositor',
      name: '内部视频合成服务',
      url: process.env.SCF_VIDEO_COMPOSITOR_URL || 'https://placeholder-video-compositor.example.com',
      authType: 'bearer',
      credentials: {
        apiKey: process.env.INTERNAL_CALLBACK_SECRET || 'placeholder-secret-video'
      }
    },
    {
      ref: 'internal_scf_image_compositor',
      name: '内部图片拼接服务',
      url: process.env.SCF_IMAGE_COMPOSITOR_URL || 'https://placeholder-image-compositor.example.com',
      authType: 'bearer',
      credentials: {
        apiKey: process.env.INTERNAL_CALLBACK_SECRET || 'placeholder-secret-image'
      }
    },
    {
      ref: 'internal_scf_text_processor',
      name: '内部文案处理服务',
      url: process.env.SCF_TEXT_PROCESSOR_URL || 'https://placeholder-text-processor.example.com',
      authType: 'bearer',
      credentials: {
        apiKey: process.env.INTERNAL_CALLBACK_SECRET || 'placeholder-secret-text'
      }
    }
  ];

  const endpoints = [];

  for (const svc of services) {
    const credentialsJson = JSON.stringify(svc.credentials);
    const encryptedCredentials = encrypt(credentialsJson);

    endpoints.push({
      provider_ref: svc.ref,
      provider_name: svc.name,
      endpoint_url: svc.url,
      credentials_encrypted: encryptedCredentials,
      auth_type: svc.authType,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  // 3. 插入数据
  if (endpoints.length > 0) {
    await knex('provider_endpoints').insert(endpoints);
    console.log(`✅ 成功插入 ${endpoints.length} 个 provider_endpoints 记录`);
  }
};

