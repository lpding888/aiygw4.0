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
export type EndpointStatus = 'active' | 'inactive' | 'error' | 'testing';

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
  server_type: ServerType;
  connection_string: string;
  enabled: boolean;
  status: EndpointStatus;
  timeout?: number;
  retry_count?: number;
  last_connected_at?: Date | string | null;
  last_tested_at?: Date | string | null;
  server_info?: string | Record<string, unknown> | null;
  available_tools?: string | unknown[] | null;
  created_by?: string | number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * 端点查询选项
 */
export interface EndpointQueryOptions {
  page?: number;
  limit?: number;
  server_type?: ServerType;
  status?: EndpointStatus;
  enabled?: boolean | string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 端点列表响应
 */
export interface EndpointListResponse {
  endpoints: McpEndpoint[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * 端点测试结果
 */
export interface EndpointTestResult {
  success: boolean;
  execution_time_ms?: number;
  timestamp?: string;
  error_message?: string | null;
  server_info?: Record<string, unknown> | null;
  available_tools?: unknown[] | null;
  responseTime?: number;
  message?: string;
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
  active: number;
  inactive: number;
  error: number;
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
