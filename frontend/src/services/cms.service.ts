import { APIResponse } from '@/types';
import type { APIClient } from '@/lib/api';

export class CMSService {
    private client: APIClient;

    constructor(client: APIClient) {
        this.client = client;
    }

    // ============ Content Texts (文案配置) ============

    /**
     * 获取页面文案 (前台用)
     */
    getPageTexts(page: string) {
        return this.client.get<any>(`/content/texts/${page}`);
    }

    /**
     * 获取文案列表 (管理端)
     */
    listTexts(params?: { page?: number; limit?: number; module?: string }) {
        return this.client.get<any>('/admin/content/texts', { params });
    }

    /**
     * 创建文案
     */
    createText(data: { module: string; key: string; value: string; description?: string }) {
        return this.client.post<any>('/admin/content/texts', data);
    }

    /**
     * 更新文案
     */
    updateText(id: string, data: { value?: string; description?: string }) {
        return this.client.put<any>(`/admin/content/texts/${id}`, data);
    }

    /**
     * 删除文案
     */
    deleteText(id: string) {
        return this.client.delete<any>(`/admin/content/texts/${id}`);
    }

    /**
     * 批量导入/更新文案
     */
    batchUpsertTexts(data: { texts: Array<{ module: string; key: string; value: string }> }) {
        return this.client.post<any>('/admin/content/texts/batch', data);
    }
}
