/**
 * Seed: LLM Providers (适配新表结构)
 * 初始化AI大模型供应商（OpenAI, Claude, Qwen, DeepSeek, RunningHub）
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
 * 加密API Key（AES-256-CBC）
 * @returns {string} 加密后的十六进制字符串格式: iv:encrypted
 */
function encryptApiKey(text) {
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
  console.log('🚀 开始初始化 LLM Providers...');

  // 1. 清空旧数据
  await knex('provider_endpoints')
    .whereIn('provider_ref', ['llm_openai', 'llm_claude', 'llm_qwen', 'llm_deepseek', 'img_runninghub'])
    .del();

  // 2. 准备数据
  const providersData = [
    {
      ref: 'llm_openai',
      name: 'OpenAI GPT',
      url: 'https://api.openai.com/v1',
      authType: 'bearer',
      credentials: {
        apiKey: process.env.OPENAI_API_KEY || 'placeholder-openai-key',
        type: 'openai'
      }
    },
    {
      ref: 'llm_claude',
      name: 'Anthropic Claude',
      url: 'https://api.anthropic.com/v1',
      authType: 'x-api-key',
      credentials: {
        apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || 'placeholder-claude-key',
        type: 'claude'
      }
    },
    {
      ref: 'llm_qwen',
      name: '阿里通义千问',
      url: 'https://dashscope.aliyuncs.com/api/v1',
      authType: 'bearer',
      credentials: {
        apiKey: process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || 'placeholder-qwen-key',
        type: 'qwen'
      }
    },
    {
      ref: 'llm_deepseek',
      name: 'DeepSeek',
      url: 'https://api.deepseek.com',
      authType: 'bearer',
      credentials: {
        apiKey: process.env.DEEPSEEK_API_KEY || 'placeholder-deepseek-key',
        type: 'openai' // 兼容OpenAI协议
      }
    },
    {
      ref: 'img_runninghub',
      name: 'RunningHub',
      url: 'https://www.runninghub.cn/task/openapi',
      authType: 'apikey',
      credentials: {
        apiKey: process.env.RUNNINGHUB_API_KEY || 'placeholder-runninghub-key',
        type: 'runninghub'
      }
    }
  ];

  const endpoints = [];

  for (const p of providersData) {
    const credentialsJson = JSON.stringify(p.credentials);
    const encryptedCredentials = encryptApiKey(credentialsJson);

    endpoints.push({
      provider_ref: p.ref,
      provider_name: p.name,
      endpoint_url: p.url,
      credentials_encrypted: encryptedCredentials,
      auth_type: p.authType,
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  // 3. 插入数据
  if (endpoints.length > 0) {
    await knex('provider_endpoints').insert(endpoints);
    console.log(`✅ 成功插入 ${endpoints.length} 个 LLM Provider 记录`);
  }
};
