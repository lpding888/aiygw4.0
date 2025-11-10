/**
 * 微信登录服务相关的类型定义
 */

/**
 * 微信登录平台类型
 */
export type WechatLoginPlatform = 'officialAccount' | 'miniProgram' | 'openPlatform';

/**
 * State数据结构
 */
export interface StateData {
  redirectUri: string;
  platform: WechatLoginPlatform;
  createdAt: number;
}

/**
 * 微信用户基础信息
 */
export interface WechatUserInfo {
  openid: string;
  unionid?: string;
  nickname?: string;
  nickName?: string;
  headimgurl?: string;
  avatarUrl?: string;
  sex?: number;
  province?: string;
  city?: string;
  country?: string;
  platform?: WechatLoginPlatform;
  [key: string]: unknown;
}

/**
 * OAuth回调返回数据
 */
export interface OAuthCallbackResult {
  success: boolean;
  user: UserLoginData;
  tokens: TokenPair;
  isNewUser: boolean;
  platform: WechatLoginPlatform;
  sessionKey?: string;
}

/**
 * Token数据
 */
export interface TokenData {
  access_token: string;
  openid: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
  session_key?: string;
}

/**
 * 用户登录数据
 */
export interface UserLoginData {
  id: string;
  email: string;
  username: string;
  wechat_nickname?: string;
  wechat_avatar?: string;
  role: string;
  isMember: boolean;
  quota_remaining: number;
  created_at: Date;
}

/**
 * 小程序登录返回数据
 */
export interface MiniProgramLoginResult {
  success: boolean;
  user: UserLoginData;
  tokens: TokenPair;
  isNewUser: boolean;
  platform: 'miniProgram';
  sessionKey: string;
}

/**
 * Token对
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * 用户微信绑定信息
 */
export interface WechatBindings {
  openid?: string;
  unionid?: string;
  nickname?: string;
  avatar?: string;
  lastLoginPlatform?: WechatLoginPlatform;
}

/**
 * 授权URL返回结果
 */
export interface AuthUrlResult {
  authUrl: string;
  state: string;
}

/**
 * 用户登录结果（内部使用）
 */
export interface ProcessLoginResult {
  user: UserLoginData;
  tokens: TokenPair;
  userId: string;
  isNewUser: boolean;
}

/**
 * 会话缓存数据
 */
export interface SessionCacheData {
  openid: string;
  unionid?: string;
  platform: WechatLoginPlatform;
  loginAt: number;
}

/**
 * 统计信息
 */
export interface LoginStats {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  newUsers: number;
  existingUsers: number;
  lastReset: number;
  uptime?: number;
  activeSessions?: number;
  cachedAccessTokens?: number;
  cachedJsapiTickets?: number;
  timestamp?: string;
}

/**
 * API响应数据
 */
export interface WechatApiResponse<T> {
  errcode?: number;
  errmsg?: string;
  [key: string]: T | number | string | undefined;
}
