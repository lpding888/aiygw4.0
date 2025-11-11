import type { AuthRequest } from '../middlewares/auth.middleware.js';

/**
 * KMS (密钥管理服务) 类型定义
 * 艹！这个SB文件定义密钥管理的所有类型，消除any！
 *
 * @author 老王
 */

/**
 * 密钥类型
 */
export type KeyType = 'AES' | 'RSA' | 'HMAC';

/**
 * 密钥用途
 */
export type KeyPurpose = 'data_encryption' | 'signing' | 'verification' | 'key_exchange';

/**
 * 密钥状态
 */
export type KeyStatus = 'active' | 'deprecated' | 'destroyed';

/**
 * 密钥生成配置
 */
export interface KeyGenerationConfig {
  keyName: string;
  keyAlias?: string | null;
  keyType?: KeyType;
  keyPurpose?: KeyPurpose;
  keySize?: number;
  algorithm?: string;
  metadata?: Record<string, unknown>;
  notAfter?: Date | string | null;
}

/**
 * 密钥信息
 */
export interface KeyInfo {
  id: string;
  keyName: string;
  keyAlias?: string | null;
  keyType: KeyType;
  keyPurpose: KeyPurpose;
  keySize: number;
  algorithm: string;
  keyVersion: string;
  status: KeyStatus;
  isPrimary: boolean;
  notBefore?: Date | string | null;
  notAfter?: Date | string | null;
  publicKey?: string | null;
}

/**
 * 加密选项
 */
export interface EncryptionOptions {
  dataType?: string;
  resourceId?: string;
  resourceType?: string;
  additionalData?: string;
}

/**
 * 加密请求
 */
export interface EncryptRequest {
  data: string;
  keyNameOrId: string;
  dataType?: string;
  resourceId?: string;
  resourceType?: string;
  additionalData?: string;
}

/**
 * 加密结果
 */
export interface EncryptionResult {
  id: string;
  encryptedData: string;
  algorithm: string;
  keyId: string;
  keyVersion: string;
  metadata?: Record<string, unknown>;
}

/**
 * 解密请求
 */
export interface DecryptRequest {
  cipherText: string;
  keyNameOrId: string;
  dataType?: string;
  resourceId?: string;
  resourceType?: string;
  additionalData?: string;
}

/**
 * 解密结果
 */
export interface DecryptionResult {
  data: string;
}

/**
 * 密钥列表查询参数
 */
export interface KeyListQuery {
  keyType?: KeyType;
  keyPurpose?: KeyPurpose;
  status?: KeyStatus;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 密钥列表响应
 */
export interface KeyListResponse {
  keys: KeyInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * 删除密钥选项
 */
export interface DeleteKeyOptions {
  force?: boolean;
}

/**
 * 认证请求类型
 */
export type AuthenticatedRequest = AuthRequest;

/**
 * KMS服务接口（用于 controller 调用）
 */
export interface KMSService {
  generateKey(config: KeyGenerationConfig): Promise<KeyInfo>;
  encrypt(params: {
    data: string;
    keyNameOrId: string;
    options: EncryptionOptions;
  }): Promise<EncryptionResult>;
  decrypt(params: {
    cipherText: string;
    keyNameOrId: string;
    options: EncryptionOptions;
  }): Promise<{ data: string }>;
  deleteKey(keyNameOrId: string, options: DeleteKeyOptions): Promise<boolean>;
  getKeyInfo?(keyNameOrId: string): Promise<KeyInfo[]>;
}
