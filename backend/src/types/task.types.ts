/**
 * Task 类型定义
 * 艹！这个SB文件定义任务管理的所有类型，消除any！
 *
 * @author 老王
 */

/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'processing' | 'success' | 'failed';

/**
 * 任务类型(旧三种类型)
 */
export type TaskType = 'basic_clean' | 'model_pose12' | 'video_generate';

/**
 * 任务参数
 */
export interface TaskParams {
  [key: string]: unknown;
}

/**
 * 输入数据
 */
export interface TaskInputData {
  imageUrl?: string;
  [key: string]: unknown;
}

/**
 * 任务数据库模型
 */
export interface Task {
  id: string;
  userId: string;
  type: string;
  status: TaskStatus;
  inputUrl?: string;
  inputImageUrl?: string;
  input_data?: string;
  params?: string | null;
  resultUrls?: string | null;
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
  errorReason?: string | null;
  vendorTaskId?: string | null;
  feature_id?: string | null;
  eligible_for_refund: boolean;
  refunded: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at?: Date | string | null;
}

/**
 * 任务创建结果
 */
export interface TaskCreateResult {
  taskId: string;
  type?: string;
  featureId?: string;
  status: TaskStatus;
  createdAt: string;
  quotaCost?: number;
}

/**
 * 任务详情响应
 */
export interface TaskDetailResponse {
  id: string;
  type: string;
  status: TaskStatus;
  inputImageUrl?: string;
  inputUrl?: string;
  params: TaskParams;
  resultUrls: string[];
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
  errorReason?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt?: Date | string | null;
}

/**
 * 任务列表查询选项
 */
export interface TaskListOptions {
  limit?: number;
  offset?: number;
  status?: TaskStatus | null;
  type?: string | null;
}

/**
 * 任务列表响应
 */
export interface TaskListResponse {
  tasks: TaskDetailResponse[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * 任务更新数据
 */
export interface TaskUpdateData {
  status?: TaskStatus;
  resultUrls?: string;
  errorMessage?: string;
  completed_at?: Date;
  updated_at: Date;
  vendorTaskId?: string;
}

/**
 * 限流结果
 */
export interface RateLimitResult {
  allowed: boolean;
  resetAt?: string;
  remaining?: number;
}

/**
 * 功能定义
 */
export interface FeatureDefinition {
  feature_id: string;
  is_enabled: boolean;
  quota_cost: number;
  rate_limit_policy?: string | null;
  deleted_at?: Date | string | null;
  [key: string]: unknown;
}

/**
 * 视频生成结果
 */
export interface VideoGenerateResult {
  vendorTaskId: string;
  [key: string]: unknown;
}

/**
 * 管理员任务筛选器
 */
export interface AdminTaskFilters {
  status?: string;
  type?: string;
  userId?: string;
  created_at?: (this: unknown) => void;
}

/**
 * 任务WebSocket推送数据
 */
export interface TaskWebSocketData {
  id: string;
  type: string;
  status: TaskStatus;
  inputUrl?: string;
  resultUrls?: string[] | null;
  errorMessage?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt?: Date | string | null;
}

/**
 * 自定义错误类型
 */
export interface TaskError {
  errorCode: number;
  message: string;
  rateLimitInfo?: {
    resetAt: string;
    remaining: number;
  };
}

/**
 * 任务请求体(创建任务)
 */
export interface CreateTaskRequest {
  type: string;
  inputImageUrl: string;
  params?: TaskParams;
}

/**
 * 任务请求体(基于功能创建任务)
 */
export interface CreateFeatureTaskRequest {
  featureId: string;
  inputData: TaskInputData;
}

/**
 * 任务状态更新请求体
 */
export interface UpdateTaskStatusRequest {
  status: TaskStatus;
  resultUrls?: string[];
  errorMessage?: string;
}

/**
 * 管理员任务查询参数
 */
export interface AdminTaskQuery {
  page?: string;
  limit?: string;
  status?: string;
  type?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * 任务搜索查询参数
 */
export interface TaskSearchQuery {
  q?: string;
  page?: string;
  limit?: string;
  status?: string;
  type?: string;
}

/**
 * 数据库性能查询参数
 */
export interface DbPerformanceQuery {
  table?: string;
  status?: string;
}

/**
 * Express Request扩展(包含用户信息)
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role?: string;
    [key: string]: unknown;
  };
  id?: string;
}
