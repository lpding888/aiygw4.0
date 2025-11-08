#!/usr/bin/env ts-node
/**
 * P0 API测试脚本
 * 艹，这个脚本用于测试3个新注册的P0路由是否正常工作！
 *
 * 测试的API：
 * 1. POST /api/ai/chat - 统一推理API（BE-API-001）
 * 2. POST /api/admin/uploads/sts - COS临时密钥API（BE-COS-001）
 * 3. POST /api/admin/kb/documents - 知识库文档上传API（BE-RAG-003）
 *
 * 使用方法：
 *   node -r ts-node/register scripts/test-p0-apis.ts
 *   node -r ts-node/register scripts/test-p0-apis.ts --base-url http://localhost:3000
 *   node -r ts-node/register scripts/test-p0-apis.ts --token YOUR_JWT_TOKEN
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
/**
 * 解析命令行参数
 */
function parseArgs() {
  const config = {
    baseUrl: 'http://localhost:3000',
    timeout: 10000
  };
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--base-url') {
      config.baseUrl = process.argv[++i];
    } else if (arg === '--token') {
      config.token = process.argv[++i];
    } else if (arg === '--timeout') {
      config.timeout = parseInt(process.argv[++i]);
    }
  }
  return config;
}
/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
P0 API测试脚本

用法:
  node -r ts-node/register scripts/test-p0-apis.ts [options]

选项:
  --base-url <url>    API基础URL（默认：http://localhost:3000）
  --token <token>     JWT认证token（可选，如需要管理员权限）
  --timeout <ms>      请求超时时间（默认：10000ms）
  --help             显示帮助信息

示例:
  # 测试本地服务
  node -r ts-node/register scripts/test-p0-apis.ts

  # 测试远程服务
  node -r ts-node/register scripts/test-p0-apis.ts --base-url https://api.example.com

  # 使用认证token测试
  node -r ts-node/register scripts/test-p0-apis.ts --token eyJhbGciOiJIUzI1NiIs...
`);
}
/**
 * 测试1: 统一推理API（BE-API-001）
 */
async function testAIChatAPI(config) {
  const result = {
    name: 'BE-API-001: 统一推理API',
    endpoint: '/api/ai/chat',
    method: 'POST',
    success: false
  };
  const startTime = Date.now();
  try {
    const response = await axios.post(
      `${config.baseUrl}/api/ai/chat`,
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: '你好' }],
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(config.token && { Authorization: `Bearer ${config.token}` })
        },
        timeout: config.timeout,
        validateStatus: (status) => status < 500 // 允许400+，检查API是否可达
      }
    );
    result.responseTime = Date.now() - startTime;
    result.statusCode = response.status;
    // 检查响应
    if (response.status === 200) {
      result.success = true;
      result.details = {
        hasChoices: !!response.data.choices,
        hasUsage: !!response.data.usage,
        model: response.data.model
      };
    } else if (response.status === 401) {
      result.success = false;
      result.error = '需要认证token（API可达但需要登录）';
      result.details = response.data;
    } else if (response.status === 400) {
      result.success = false;
      result.error = '请求参数错误（API可达但参数有误）';
      result.details = response.data;
    } else {
      result.success = false;
      result.error = `HTTP ${response.status}: ${response.data.message || '未知错误'}`;
      result.details = response.data;
    }
  } catch (error) {
    result.responseTime = Date.now() - startTime;
    if (error.code === 'ECONNREFUSED') {
      result.error = '连接被拒绝（服务器未启动？）';
    } else if (error.code === 'ETIMEDOUT') {
      result.error = '请求超时';
    } else if (error.response) {
      result.statusCode = error.response.status;
      result.error = `HTTP ${error.response.status}: ${error.response.data?.message || '未知错误'}`;
      result.details = error.response.data;
    } else {
      result.error = error.message;
    }
  }
  return result;
}
/**
 * 测试2: COS临时密钥API（BE-COS-001）
 */
async function testCOSSTSAPI(config) {
  const result = {
    name: 'BE-COS-001: COS临时密钥API',
    endpoint: '/api/admin/uploads/sts',
    method: 'POST',
    success: false
  };
  const startTime = Date.now();
  try {
    const response = await axios.post(
      `${config.baseUrl}/api/admin/uploads/sts`,
      {
        filename: 'test-file.txt',
        contentType: 'text/plain'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(config.token && { Authorization: `Bearer ${config.token}` })
        },
        timeout: config.timeout,
        validateStatus: (status) => status < 500
      }
    );
    result.responseTime = Date.now() - startTime;
    result.statusCode = response.status;
    if (response.status === 200) {
      result.success = true;
      result.details = {
        hasCredentials: !!response.data.credentials,
        hasUploadUrl: !!response.data.uploadUrl,
        expiresIn: response.data.expiresIn
      };
    } else if (response.status === 401) {
      result.success = false;
      result.error = '需要认证token（API可达但需要登录）';
      result.details = response.data;
    } else if (response.status === 403) {
      result.success = false;
      result.error = '需要管理员权限（API可达但权限不足）';
      result.details = response.data;
    } else {
      result.success = false;
      result.error = `HTTP ${response.status}: ${response.data.message || '未知错误'}`;
      result.details = response.data;
    }
  } catch (error) {
    result.responseTime = Date.now() - startTime;
    if (error.code === 'ECONNREFUSED') {
      result.error = '连接被拒绝（服务器未启动？）';
    } else if (error.code === 'ETIMEDOUT') {
      result.error = '请求超时';
    } else if (error.response) {
      result.statusCode = error.response.status;
      result.error = `HTTP ${error.response.status}: ${error.response.data?.message || '未知错误'}`;
      result.details = error.response.data;
    } else {
      result.error = error.message;
    }
  }
  return result;
}
/**
 * 测试3: 知识库文档上传API（BE-RAG-003）
 */
async function testKBDocumentAPI(config) {
  const result = {
    name: 'BE-RAG-003: 知识库文档API',
    endpoint: '/api/admin/kb/documents',
    method: 'POST',
    success: false
  };
  const startTime = Date.now();
  try {
    const response = await axios.post(
      `${config.baseUrl}/api/admin/kb/documents`,
      {
        title: 'Test Document',
        content: '这是一个测试文档内容',
        kbId: 'test-kb',
        format: 'text'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...(config.token && { Authorization: `Bearer ${config.token}` })
        },
        timeout: config.timeout,
        validateStatus: (status) => status < 500
      }
    );
    result.responseTime = Date.now() - startTime;
    result.statusCode = response.status;
    if (response.status === 200 || response.status === 201) {
      result.success = true;
      result.details = {
        hasDocumentId: !!response.data.documentId,
        hasJobId: !!response.data.jobId,
        status: response.data.status
      };
    } else if (response.status === 401) {
      result.success = false;
      result.error = '需要认证token（API可达但需要登录）';
      result.details = response.data;
    } else if (response.status === 403) {
      result.success = false;
      result.error = '需要管理员权限（API可达但权限不足）';
      result.details = response.data;
    } else {
      result.success = false;
      result.error = `HTTP ${response.status}: ${response.data.message || '未知错误'}`;
      result.details = response.data;
    }
  } catch (error) {
    result.responseTime = Date.now() - startTime;
    if (error.code === 'ECONNREFUSED') {
      result.error = '连接被拒绝（服务器未启动？）';
    } else if (error.code === 'ETIMEDOUT') {
      result.error = '请求超时';
    } else if (error.response) {
      result.statusCode = error.response.status;
      result.error = `HTTP ${error.response.status}: ${error.response.data?.message || '未知错误'}`;
      result.details = error.response.data;
    } else {
      result.error = error.message;
    }
  }
  return result;
}
/**
 * 显示测试结果
 */
function displayResults(results) {
  console.log('\n========================================');
  console.log('         P0 API 测试结果');
  console.log('========================================\n');
  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.length - successCount;
  results.forEach((result, index) => {
    const statusIcon = result.success ? '✅' : '❌';
    const statusText = result.success ? '成功' : '失败';
    console.log(`${index + 1}. ${statusIcon} ${result.name}`);
    console.log(`   端点: ${result.method} ${result.endpoint}`);
    console.log(`   状态: ${statusText}`);
    if (result.statusCode) {
      console.log(`   HTTP状态码: ${result.statusCode}`);
    }
    if (result.responseTime) {
      console.log(`   响应时间: ${result.responseTime}ms`);
    }
    if (result.error) {
      console.log(`   错误: ${result.error}`);
    }
    if (result.details && Object.keys(result.details).length > 0) {
      console.log(`   详情: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log('');
  });
  console.log('========================================');
  console.log(`总计: ${results.length} 个测试`);
  console.log(`✅ 成功: ${successCount}`);
  console.log(`❌ 失败: ${failedCount}`);
  console.log('========================================\n');
  // 返回退出码
  return failedCount === 0 ? 0 : 1;
}
/**
 * 主函数
 */
async function main() {
  // 检查是否需要显示帮助
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  const config = parseArgs();
  console.log('🧪 P0 API测试工具启动...\n');
  console.log(`基础URL: ${config.baseUrl}`);
  console.log(`超时时间: ${config.timeout}ms`);
  console.log(`使用Token: ${config.token ? '是' : '否'}\n`);
  console.log('开始执行测试...\n');
  const results = [];
  // 测试1: AI Chat API
  console.log('⏳ 测试 BE-API-001: 统一推理API...');
  const result1 = await testAIChatAPI(config);
  results.push(result1);
  // 测试2: COS STS API
  console.log('⏳ 测试 BE-COS-001: COS临时密钥API...');
  const result2 = await testCOSSTSAPI(config);
  results.push(result2);
  // 测试3: KB Document API
  console.log('⏳ 测试 BE-RAG-003: 知识库文档API...');
  const result3 = await testKBDocumentAPI(config);
  results.push(result3);
  // 显示结果
  const exitCode = displayResults(results);
  // 生成测试报告文件
  const reportPath = path.join(__dirname, '..', 'P0-API测试报告.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        config,
        results,
        summary: {
          total: results.length,
          success: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length
        }
      },
      null,
      2
    )
  );
  console.log(`📄 测试报告已保存: ${reportPath}\n`);
  process.exit(exitCode);
}
// 执行主函数
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 测试脚本执行失败:', error);
    process.exit(1);
  });
}
export { main as testP0APIs };
//# sourceMappingURL=test-p0-apis.js.map
