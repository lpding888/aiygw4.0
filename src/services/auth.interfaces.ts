import type { TokenPair, TokenPayload, UserForToken } from './token.service.js';

export interface TokenSigner {
  generateAccessToken(payload: TokenPayload): string;
  generateRefreshToken(payload: TokenPayload): string;
  generateTokenPair(user: UserForToken): TokenPair;
  refreshTokens(refreshToken: string): Promise<TokenPair | null>;
  addToBlacklist(jti: string, ttl?: number): Promise<boolean>;
  isTokenBlacklisted(jti: string): Promise<boolean>;
  revokeUserTokens(userId: string): Promise<boolean>;
  isUserRevoked(userId: string): Promise<boolean>;
  getTokenRemainingTime(token: string): number | null;
}

export interface AuthSendCodeResult {
  expireIn: number;
}

export interface AuthTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthLoginResult extends AuthTokenResult {
  user: unknown;
}

export interface AuthRegisterResult extends AuthTokenResult {
  user: unknown;
}

export interface AuthProvider {
  sendCode(phone: string, ip: string): Promise<AuthSendCodeResult>;
  loginWithCode(phone: string, code: string, referrerId?: string | null): Promise<AuthLoginResult>;
  loginWithPassword(
    phone: string,
    password: string
  ): Promise<AuthLoginResult>;
  registerWithPassword(
    phone: string,
    password: string,
    referrerId?: string | null
  ): Promise<AuthRegisterResult>;
  getUser(userId: string): Promise<unknown>;
  refreshToken(refreshToken: string): Promise<AuthTokenResult | null>;
  logout(userId: string): Promise<boolean>;
  verifyTokenStatus(userId: string, jti?: string): Promise<boolean>;
}
