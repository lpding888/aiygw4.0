/**
 * PromptTemplate 类型定义
 * 艹！这个文件定义 PromptTemplate 服务的所有类型，消除 any！
 *
 * @author 老王
 */

/**
 * 模板状态
 */
export type TemplateStatus = 'draft' | 'published' | 'archived';

/**
 * 模板分类
 */
export type TemplateCategory = 'system' | 'user' | 'assistant' | 'function';

/**
 * 变量定义
 */
export interface VariableDefinition {
  type?: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  [key: string]: unknown;
}

/**
 * 变量集合
 */
export type Variables = Record<string, VariableDefinition>;

/**
 * 模板元数据
 */
export interface TemplateMetadata {
  [key: string]: unknown;
}

/**
 * PromptTemplate 数据库模型
 */
export interface PromptTemplate {
  id: string | number;
  key: string;
  name: string;
  description?: string | null;
  content: string;
  category: TemplateCategory;
  variables: Variables | null;
  metadata: TemplateMetadata | null;
  status: TemplateStatus;
  version: number;
  created_by: string | number;
  updated_by: string | number;
  created_at: string;
  updated_at: string;
  // 关联用户信息（JOIN查询）
  created_by_username?: string;
  updated_by_username?: string;
}

/**
 * 查询选项
 */
export interface TemplateQueryOptions {
  page?: number;
  limit?: number;
  category?: TemplateCategory;
  status?: TemplateStatus | TemplateStatus[];
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  created_by?: string | number;
}

/**
 * 分页结果
 */
export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 模板列表响应
 */
export interface TemplateListResponse {
  templates: PromptTemplate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 版本查询选项
 */
export interface VersionQueryOptions {
  page?: number;
  limit?: number;
}

/**
 * 模板版本
 */
export interface TemplateVersion {
  id: string | number;
  template_id: string | number;
  version: number;
  content: string;
  variables: string | null;
  metadata: string | null;
  change_log?: string | null;
  status: TemplateStatus;
  created_by: string | number;
  created_at: string;
}

/**
 * 版本列表响应
 */
export interface VersionListResponse {
  template: {
    id: string | number;
    key: string;
    name: string;
  };
  versions: Array<{
    version: number;
    status: TemplateStatus;
    change_log: string | null;
    created_by: string | number;
    created_at: string;
  }>;
  pagination: {
    current: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 预览结果
 */
export interface PreviewResult {
  templateId: string | number;
  templateKey: string;
  templateName: string;
  variables: {
    provided: Record<string, unknown>;
    required: string[];
    missing: string[];
  };
  content: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
  variables: {
    extracted: string[];
    defined: Variables;
    count: number;
  };
}

/**
 * 模板统计
 */
export interface TemplateStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  system: number;
  user: number;
  assistant: number;
  function: number;
}

/**
 * 批量预览项
 */
export interface BatchPreviewItem {
  id: string;
  variables?: Record<string, unknown>;
}

/**
 * 批量预览结果
 */
export interface BatchPreviewResult {
  results: Array<PreviewResult | { error: string }>;
}
