import { APIResponse } from '@/types';
import type { APIClient } from '@/lib/api';

export class AuthService {
    private client: APIClient;

    constructor(client: APIClient) {
        this.client = client;
    }

    // ========== 验证码发送 ==========
    sendCode(phone: string) {
        return this.client.post<APIResponse>('/auth/send-code', { phone });
    }

    sendEmailCode(email: string, scene?: string) {
        return this.client.post<APIResponse>('/auth/email/send-code', { email, scene });
    }

    // ========== 登录接口 ==========
    loginWithCode(phone: string, code: string, referrerId?: string | null) {
        return this.client.post<APIResponse>('/auth/login', {
            phone,
            code,
            referrer_id: referrerId ?? null
        });
    }

    /**
     * @deprecated Use loginWithCode instead
     */
    login(phone: string, code: string, referrerId?: string | null) {
        return this.loginWithCode(phone, code, referrerId);
    }

    loginWithPassword(account: string, password: string) {
        return this.client.post<APIResponse>('/auth/login/password', { account, password });
    }

    /**
     * @deprecated Use loginWithPassword instead
     */
    passwordLogin(account: string, password: string) {
        return this.loginWithPassword(account, password);
    }

    loginWithEmailCode(email: string, code: string, referrerId?: string | null) {
        return this.client.post<APIResponse>('/auth/email/login', {
            email,
            code,
            referrer_id: referrerId ?? null,
        });
    }

    loginWithEmail(email: string, code: string) {
        return this.client.post<APIResponse>('/auth/login/email', { email, code });
    }

    // ========== 注册接口 ==========
    register(phone: string, password: string, referrerId?: string | null) {
        return this.client.post<APIResponse>('/auth/register', {
            phone,
            password,
            referrer_id: referrerId ?? null,
        });
    }

    registerWithEmail(email: string, code: string, password: string, referrerId?: string | null) {
        return this.client.post<APIResponse>('/auth/email/register', {
            email,
            code,
            password,
            referrer_id: referrerId ?? null,
        });
    }

    wechatLogin(code: string) {
        return this.client.post<APIResponse>('/auth/wechat/miniprogram/login', { code });
    }

    setPassword(newPassword: string, oldPassword?: string) {
        return this.client.post<APIResponse>('/auth/set-password', {
            newPassword,
            oldPassword,
        });
    }

    resetPassword(params: { phone?: string; email?: string; code: string; newPassword: string }) {
        return this.client.post<APIResponse>('/auth/reset-password', params);
    }

    me() {
        return this.client.get<APIResponse>('/auth/me');
    }
}
