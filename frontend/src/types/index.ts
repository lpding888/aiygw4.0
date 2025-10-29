export interface User {
  id: string;
  phone: string;
  role: 'user' | 'admin'; // 艹，怎么能忘记role字段！
  isMember: boolean;
  quota_remaining: number;
  quota_expireAt: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  userId: string;
  type: 'basic_clean' | 'model_pose12' | string; // 支持动态类型
  status: 'processing' | 'success' | 'failed' | 'pending';
  inputUrl: string;
  resultUrls: string[] | null;
  params: any;
  errorReason?: string;
  error_message?: string; // 后端可能用这个字段
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  thumbnail?: string;
  // 新架构字段
  feature_id?: string;
  output_type?: 'singleImage' | 'multiImage' | 'video' | 'zip' | 'textBundle';
  artifacts?: Array<{
    type: string;
    url: string;
    metadata?: any;
  }>;
  quota_cost?: number;
  // 视频专用字段
  resultVideoUrl?: string;
  resultVideoUrls?: string[];
}

export interface MembershipStatus {
  isMember: boolean;
  quota_remaining: number;
  quota_expireAt: string | null;
  quotaRemaining: number; // 老王我加上这个，后端返回的可能是这个
  expireDays: number;
  price: number;
  totalUsed?: number; // 历史使用总数，workspace页面需要
}

export interface STSCredentials {
  credentials: {
    tmpSecretId: string;
    tmpSecretKey: string;
    sessionToken: string;
  };
  expiredTime: number;
  bucket: string;
  region: string;
  allowPrefix: string;
}

// 功能卡片相关类型
export interface Feature {
  feature_id: string;
  display_name: string;
  category: string;
  description: string;
  quota_cost: number;
  rate_limit_policy: string | null;
  is_enabled: boolean;
  plan_required: string;
  output_type: 'singleImage' | 'multiImage' | 'video' | 'zip' | 'textBundle';
  save_to_asset_library: boolean;
  access_scope: 'plan' | 'whitelist';
  allowed_accounts: string[] | null;
  icon?: string; // 可选的图标类型
  color?: string; // 可选的主题色
}

// 表单字段类型
export interface FormField {
  name: string;
  label: string;
  type: 'imageUpload' | 'multiImageUpload' | 'enum' | 'text' | 'number' | 'date';
  required: boolean;
  helpText?: string;
  validation?: {
    maxSize?: number;
    allowedTypes?: string[];
    max?: number;
    min?: number;
    pattern?: string;
  };
  options?: Array<{
    value: string;
    label: string;
  }>;
  defaultValue?: any;
}

// 表单Schema
export interface FormSchema {
  feature_id: string;
  display_name: string;
  description: string;
  quota_cost: number;
  fields: FormField[];
}

// 素材相关类型
export interface Asset {
  id: string;
  user_id: string;
  task_id: string;
  feature_id: string;
  feature_display_name: string;
  asset_type: 'image' | 'video' | 'zip' | 'text';
  asset_url: string;
  thumbnail_url?: string;
  metadata?: any;
  created_at: string;
}
