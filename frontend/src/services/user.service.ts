import { APIResponse } from '@/types';
import type { APIClient } from '@/lib/api';

export class UserService {
    private client: APIClient;

    constructor(client: APIClient) {
        this.client = client;
    }

    // 会员相关
    membership = {
        purchase: (channel: string) =>
            this.client.post<APIResponse>('/membership/purchase', { channel }),

        status: () => this.client.get<APIResponse>('/membership/status'),
    };

    // 管理相关
    admin = {
        getUsers: (params: any) =>
            this.client.get<APIResponse>('/admin/users', { params }),

        updateUser: (userId: string, data: { status: string }) =>
            this.client.patch<APIResponse>(`/admin/users/${userId}`, data),
    };
}
