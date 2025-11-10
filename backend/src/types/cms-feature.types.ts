/**
 * CMS Feature 类型定义
 * 艹！这个SB文件定义CMS功能管理的所有类型，消除any！
 *
 * @author 老王
 */

/**
 * 功能状态
 */
export type FeatureStatus = 'draft' | 'published' | 'archived';

/**
 * 功能配置
 */
export interface FeatureConfig {
  [key: string]: unknown;
}

/**
 * 功能菜单配置
 */
export interface FeatureMenu {
  title?: string;
  icon?: string;
  path?: string;
  order?: number;
  visible?: boolean;
  [key: string]: unknown;
}

/**
 * 功能元数据
 */
export interface FeatureMetadata {
  author?: string;
  tags?: string[];
  dependencies?: string[];
  [key: string]: unknown;
}

/**
 * CMS Feature 数据库模型
 */
export interface CmsFeature {
  id: string | number;
  key: string;
  name: string;
  description?: string | null;
  category?: string | null;
  enabled: boolean;
  status: FeatureStatus;
  config: string | FeatureConfig; // JSON字符串或已解析对象
  menu: string | FeatureMenu;
  metadata: string | FeatureMetadata;
  version: number;
  published_at?: string | null;
  created_by?: string | number | null;
  updated_by?: string | number | null;
  created_at: string;
  updated_at: string;
}

/**
 * 查询选项
 */
export interface FeatureQueryOptions {
  page?: number;
  limit?: number;
  category?: string;
  status?: FeatureStatus;
  enabled?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 功能列表响应
 */
export interface FeatureListResponse {
  features: CmsFeature[];
  pagination: {
    current: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 创建功能数据
 */
export interface CreateFeatureData {
  key: string;
  name: string;
  description?: string;
  category?: string;
  config?: FeatureConfig;
  menu?: FeatureMenu;
  metadata?: FeatureMetadata;
  enabled?: boolean;
}

/**
 * 更新功能数据
 */
export interface UpdateFeatureData {
  name?: string;
  description?: string;
  category?: string;
  config?: FeatureConfig;
  menu?: FeatureMenu;
  metadata?: FeatureMetadata;
  enabled?: boolean;
  status?: FeatureStatus;
}

/**
 * 功能历史记录
 */
export interface FeatureHistory {
  version: number;
  action: 'create' | 'update' | 'publish' | 'delete' | 'rollback';
  description: string;
  created_by: string | number;
  created_at: string;
}

/**
 * 功能历史响应
 */
export interface FeatureHistoryResponse {
  history: FeatureHistory[];
  pagination: {
    current: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 历史查询选项
 */
export interface HistoryQueryOptions {
  page?: number;
  limit?: number;
}

/**
 * 批量更新结果
 */
export interface BatchUpdateResult {
  success: CmsFeature[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * 回滚数据结构
 */
export interface RollbackData {
  config: string;
  menu: string;
  metadata: string;
  version: number;
  [key: string]: unknown;
}

/**
 * CmsCache服务接口（用于类型安全）
 */
export interface CmsCacheService {
  getOrSet<T>(
    scope: string,
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttl?: number }
  ): Promise<T>;
  generateVersion(scope: string, key: string): Promise<number>;
  createSnapshot(
    scope: string,
    key: string,
    data: unknown,
    action: string,
    description: string,
    userId: string
  ): Promise<void>;
  invalidate(scope: string, key: string): Promise<void>;
  invalidateScope(scope: string): Promise<void>;
  rollback(scope: string, key: string, version: string, userId: string): Promise<RollbackData>;
}
