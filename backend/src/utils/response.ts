/**
 * 统一响应格式工具
 * 艹，TypeScript版本，不偷懒！
 */

export interface SuccessResponse<T = any> {
  success: true;
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  code: number;
  error: string;
  message: string;
  details: any;
  timestamp: string;
}

export interface PaginationInfo {
  current: number;
  total: number;
  pageSize: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T = any> {
  success: true;
  code: number;
  message: string;
  data: {
    items: T[];
    pagination: PaginationInfo;
  };
  timestamp: string;
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T = any>(
  data: T = null as any,
  message: string = '操作成功',
  code: number = 200
): SuccessResponse<T> {
  return {
    success: true,
    code,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  error: string,
  message: string = '操作失败',
  details: any = null,
  code: number = 400
): ErrorResponse {
  return {
    success: false,
    code,
    error,
    message,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T = any>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  message: string = '获取数据成功'
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    code: 200,
    message,
    data: {
      items,
      pagination: {
        current: page,
        total: totalPages,
        pageSize: limit,
        totalCount: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    },
    timestamp: new Date().toISOString()
  };
}
