/**
 * Seed: LLM Providers
 * 初始化AI大模型供应商（OpenAI, Claude, Qwen）
 * 适配旧表结构：provider_ref, provider_name, endpoint_url, credentials_encrypted, auth_type
 */

const crypto = require('crypto');

/**
 * 加密API Key（AES-256-CBC，兼容provider_secrets表格式）
 * @param {string} text - 明文API Key
 * @returns {string} 加密结果（格式: iv:encrypted）
 */
function encryptApiKey(text) {
  if (!text) {
    return 'placeholder:placeholder';
  }

  const algorithm = 'aes-256-cbc';
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    console.warn('⚠️  缺少环境变量 ENCRYPTION_KEY，使用占位符');
    return 'placeholder:placeholder';
  }

  // 派生32字节密钥
  let key;
  if (encryptionKey.length === 64 && /^[0-9a-fA-F]+$/.test(encryptionKey)) {
    key = Buffer.from(encryptionKey, 'hex');
  } else {
    key = crypto.createHash('sha256').update(encryptionKey).digest();
  }

  // 生成随机IV（16字节）
  const iv = crypto.randomBytes(16);

  // 创建加密器
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  // 加密数据
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // 返回格式: iv:encrypted（与002_provider_endpoints.cjs兼容）
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Seed 数据
 */
exports.seed = async function (knex) {
  console.log('🚀 开始初始化LLM Providers...');

  // 检查环境变量
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasClaude = !!process.env.ANTHROPIC_API_KEY || !!process.env.CLAUDE_API_KEY;
  const hasQwen = !!process.env.DASHSCOPE_API_KEY || !!process.env.QWEN_API_KEY;

  if (!hasOpenAI && !hasClaude && !hasQwen) {
    console.warn('⚠️  警告：未配置任何LLM API Key，将创建占位符Provider');
    console.warn('');
    console.warn('请配置以下任一环境变量：');
    console.warn('  - OPENAI_API_KEY (OpenAI GPT系列)');
    console.warn('  - ANTHROPIC_API_KEY 或 CLAUDE_API_KEY (Claude系列)');
    console.warn('  - DASHSCOPE_API_KEY 或 QWEN_API_KEY (通义千问系列)');
    console.warn('');
  }

  // 清空现有LLM Provider数据（使用provider_ref匹配）
  await knex('provider_endpoints')
    .whereIn('provider_ref', ['llm_openai', 'llm_claude', 'llm_qwen'])
    .del();

  // 准备Provider数据（使用旧表结构）
  const providers = [
    {
      provider_ref: 'llm_openai',
      provider_name: 'OpenAI GPT',
      endpoint_url: 'https://api.openai.com/v1',
      credentials_encrypted: encryptApiKey(process.env.OPENAI_API_KEY || ''),
      auth_type: 'bearer',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      provider_ref: 'llm_claude',
      provider_name: 'Anthropic Claude',
      endpoint_url: 'https://api.anthropic.com/v1',
      credentials_encrypted: encryptApiKey(
        process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || ''
      ),
      auth_type: 'api_key',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      provider_ref: 'llm_qwen',
      provider_name: '阿里通义千问',
      endpoint_url: 'https://dashscope.aliyuncs.com/api/v1',
      credentials_encrypted: encryptApiKey(
        process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || ''
      ),
      auth_type: 'bearer',
      created_at: new Date(),
      updated_at: new Date()
    }
  ];

  // 插入Provider数据
  await knex('provider_endpoints').insert(providers);

  console.log('✅ LLM Providers初始化完成');
  console.log('');
  console.log('已创建的Provider：');
  console.log(`  ${hasOpenAI ? '✅' : '⚠️ '} OpenAI GPT (llm_openai) - ${hasOpenAI ? '已配置API Key' : '使用占位符'}`);
  console.log(`  ${hasClaude ? '✅' : '⚠️ '} Anthropic Claude (llm_claude) - ${hasClaude ? '已配置API Key' : '使用占位符'}`);
  console.log(`  ${hasQwen ? '✅' : '⚠️ '} 阿里通义千问 (llm_qwen) - ${hasQwen ? '已配置API Key' : '使用占位符'}`);
  console.log('');

  if (!hasOpenAI || !hasClaude || !hasQwen) {
    console.log('💡 提示：要配置API Key，请：');
    console.log('   1. 在.env文件中添加对应的API Key');
    console.log('   2. 重新运行: npm run db:seed');
    console.log('');
  }
};
