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
/**
 * 主函数
 */
declare function main(): Promise<void>;
export { main as testP0APIs };
//# sourceMappingURL=test-p0-apis.d.ts.map
