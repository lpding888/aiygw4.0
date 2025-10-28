export interface User {
  id: string;
  phone: string;
  isMember: boolean;
  quota_remaining: number;
  quota_expireAt: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  userId: string;
  type: 'basic_clean' | 'model_pose12';
  status: 'processing' | 'done' | 'failed';
  inputUrl: string;
  resultUrls: string[] | null;
  params: any;
  errorReason?: string;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
}

export interface MembershipStatus {
  isMember: boolean;
  quota_remaining: number;
  quota_expireAt: string | null;
  expireDays: number;
  price: number;
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
