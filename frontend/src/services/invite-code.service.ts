import { APIResponse } from '@/types';
import type { APIClient } from '@/lib/api';

export class InviteCodeService {
    private client: APIClient;

    constructor(client: APIClient) {
        this.client = client;
    }

    /**
     * 验证邀请码是否有效
     */
    validate(code: string) {
        return this.client.post<any>('/invite-codes/validate', { code });
    }

    /**
     * 使用邀请码
     */
    use(code: string, options?: { inviterId?: string; inviteeEmail?: string; inviteePhone?: string }) {
        return this.client.post<any>('/invite-codes/use', {
            code,
            ...options
        });
    }

    /**
     * 获取当前用户的邀请统计
     */
    getStats() {
        return this.client.get<any>('/invite-codes/stats/me');
    }

    /**
     * 获取邀请记录
     */
    getLogs(params?: {
        page?: number;
        limit?: number;
        status?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc'
    }) {
        return this.client.get<any>('/invite-codes/logs', { params });
    }
}
