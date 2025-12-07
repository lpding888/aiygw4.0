import type { AuthRequest } from '../middlewares/auth.middleware.js';

/**
 * MCP Endpoint 类型定义
 * 艹！这个SB文件定义MCP端点管理的所有类型，消除any！
 *
 * @author 老王
 */

/**
 * 端点状态
 */
export type EndpointStatus = 'active' | 'inactive' | 'error';

/**
 * 服务器类型
 */
export type ServerType = 'stdio' | 'http' | 'websocket';

/**
 * MCP端点数据库模型
 */
export interface McpEndpoint {
  id: string;
  name: string;
  description?: string | null;
  endpointUrl: string;
  apiKeyId: string;
  protocolVersion: string;
  capabilities: string[];
  supportedTools: ToolInfo[];
  status: EndpointStatus;
  healthy: boolean;
  timeoutMs: number;
  maxRetries: number;
  enabled: boolean;
  metadata?: Record<string, unknown>;
  lastSyncAt?: Date | string | null;
  lastError?: string | null;
  createdBy?: string | number | null;
  updatedBy?: string | number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * 端点查询选项
 */
export interface EndpointQueryOptions {
  page?: number;
  limit?: number;
  status?: EndpointStatus;
  enabled?: boolean;
  healthy?: boolean;
}

/**
 * 端点列表响应
 */
export interface EndpointListResponse {
  endpoints: McpEndpoint[];
  total: number;
}

/**
 * 端点测试结果
 */
export interface EndpointTestResult {
  success: boolean;
  latency?: number;
  toolsCount?: number;
  sampleTools?: string[];
  capabilities?: string[];
  error?: string | null;
}

/**
 * 工具信息
 */
export interface ToolInfo {
  name: string;
  description?: string;
  category?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  enabled?: boolean;
  status?: string;
}

/**
 * 批量测试结果
 */
export interface BatchTestResult {
  total: number;
  success: number;
  failed: number;
  results: PromiseSettledResult<EndpointTestResult>[];
}

/**
 * 批量测试汇总
 */
export interface BatchTestSummary {
  total: number;
  success: number;
  failed: number;
}

/**
 * 认证请求类型
 */
export type AuthenticatedRequest = AuthRequest;

/**
 * 端点统计信息
 */
export interface EndpointStats {
  total: number;
  byStatus: Record<string, number>;
  totalTools: number;
  activeTools: number;
  healthyEndpoints: number;
  enabledEndpoints: number;
}

/**
 * 工具执行请求体
 */
export interface ExecuteToolRequest {
  tool_name: string;
  arguments?: Record<string, unknown>;
}

/**
 * 批量测试请求体
 */
export interface BatchTestRequest {
  endpoint_ids: string[];
}
