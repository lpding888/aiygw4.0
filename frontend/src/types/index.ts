export interface User {
  id: string;
  phone: string;
  username?: string;
  nickname?: string;
  avatar?: string;
  email?: string;
  role: 'user' | 'admin';
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

// ============ 分销代理系统类型定义 ============

// 分销员状态类型
export type DistributorStatus = 'none' | 'pending' | 'active' | 'disabled';

// 佣金状态类型
export type CommissionStatus = 'frozen' | 'settled' | 'withdrawn';

// 提现状态类型
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

// 提现方式类型
export type WithdrawalMethod = 'wechat' | 'alipay';

// 分销员状态信息
export interface DistributorStatusInfo {
  status: DistributorStatus;
  inviteCode?: string;
  inviteLink?: string;
  appliedAt?: string;
  approvedAt?: string;
}

// 分销中心数据概览
export interface DistributionDashboard {
  totalReferrals: number;
  totalCommission: number;
  availableCommission: number;
  withdrawnCommission: number;
}

// 推广用户信息
export interface Referral {
  userId: string;
  phone: string;
  registeredAt: string;
  hasPaid: boolean;
  commissionAmount?: number;
  avatar?: string;
}

// 推广用户列表响应
export interface ReferralsResponse {
  referrals: Referral[];
  total: number;
}

// 佣金记录
export interface Commission {
  id: string;
  orderId: string;
  orderAmount: number;
  commissionAmount: number;
  status: CommissionStatus;
  createdAt: string;
  settledAt?: string;
  freezeUntil?: string;
  referredUserPhone?: string;
}

// 佣金记录列表响应
export interface CommissionsResponse {
  commissions: Commission[];
  total: number;
}

// 提现申请信息
export interface Withdrawal {
  id: string;
  amount: number;
  method: WithdrawalMethod;
  accountInfo: {
    account: string;
    name: string;
  };
  status: WithdrawalStatus;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
}

// 提现记录列表响应
export interface WithdrawalsResponse {
  withdrawals: Withdrawal[];
  total: number;
}

// 管理端 - 分销员详细信息
export interface DistributorDetail {
  id: string;
  userId: string;
  phone: string;
  realName: string;
  idCard: string;
  contact: string;
  channel?: string;
  inviteCode: string;
  status: DistributorStatus;
  appliedAt: string;
  approvedAt?: string;
  totalReferrals: number;
  totalCommission: number;
  availableCommission: number;
  withdrawnCommission: number;
}

// 管理端 - 分销员列表项
export interface DistributorListItem {
  id: string;
  userId: string;
  phone: string;
  realName: string;
  status: DistributorStatus;
  appliedAt: string;
  approvedAt?: string;
  totalReferrals: number;
  totalCommission: number;
}

// 管理端 - 分销员列表响应
export interface DistributorsResponse {
  distributors: DistributorListItem[];
  total: number;
}

// 管理端 - 提现申请（含分销员信息）
export interface WithdrawalAdmin extends Withdrawal {
  distributorName: string;
  phone: string;
}

// 管理端 - 提现列表响应
export interface WithdrawalsAdminResponse {
  withdrawals: WithdrawalAdmin[];
  total: number;
  pending_count?: number;
}

// 管理端 - 分销数据统计
export interface DistributionStats {
  totalDistributors: number;
  activeDistributors: number;
  totalReferrals: number;
  paidReferrals: number;
  totalCommissionPaid: number;
  pendingWithdrawals: number;
  pendingWithdrawalAmount: number;
  referralTrend?: Array<{ date: string; count: number }>;
  commissionTrend?: Array<{ date: string; amount: number }>;
  topDistributors: Array<{
    id: string;
    realName: string;
    phone: string;
    referrals: number;
    commission: number;
  }>;
}

// 管理端 - 佣金设置
export interface DistributionSettings {
  commissionRate: number;
  minWithdrawal: number;
  freezeDays: number;
  autoApprove: boolean;
}

// ============ AI 聊天相关类型定义 ============

/**
 * AI 聊天消息
 */
export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

/**
 * AI 聊天请求参数
 */
export interface AIChatRequest {
  message: string;
  context?: string;
}

/**
 * AI 返回的 Schema 更新操作类型
 */
export type AISchemaAction = 'append' | 'replace' | 'delete';

/**
 * Formio 组件校验规则
 */
export interface FormioValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  custom?: string;
  customMessage?: string;
}

/**
 * Formio 组件基础类型
 * 与 formSchemas.ts 的 fields 结构对应
 */
export interface FormioComponent {
  type: string;  // 'textfield' | 'select' | 'file' | 'panel' | 'number' | 'checkbox' | ...
  key: string;
  label: string;
  input?: boolean;
  placeholder?: string;
  description?: string;
  tooltip?: string;
  hidden?: boolean;
  disabled?: boolean;
  tableView?: boolean;
  validate?: FormioValidation;
  conditional?: {
    show?: boolean;
    when?: string;
    eq?: string;
  };
  data?: {
    values?: Array<{ label: string; value: string }>;
    url?: string;
    resource?: string;
  };
  multiple?: boolean;
  defaultValue?: any;
  components?: FormioComponent[];  // 嵌套组件（Panel、Columns 等）
  columns?: Array<{ components: FormioComponent[]; width: number; offset?: number }>;
  [key: string]: any;  // 允许扩展属性
}

/**
 * Formio Schema 结构
 */
export interface FormioSchema {
  components: FormioComponent[];
  display?: 'form' | 'wizard' | 'pdf';
}

/**
 * AI 返回的 Schema 更新建议
 */
export interface AISchemaUpdate {
  /** 操作类型：追加、替换、删除 */
  action: AISchemaAction;
  /** 目标组件位置（用于 replace/delete） */
  targetIndex?: number;
  /** 目标组件 key（用于精确定位） */
  targetKey?: string;
  /** 新的 Formio 组件定义 */
  components: FormioComponent[];
}

/**
 * AI 聊天响应数据
 */
export interface AIChatResponse {
  reply: string;
  schemaUpdate?: AISchemaUpdate;
  suggestions?: string[];
}
