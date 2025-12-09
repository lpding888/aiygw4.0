import { APIResponse } from '@/types';
import type { APIClient } from '@/lib/api';

export class SystemService {
    private client: APIClient;

    public cache: CacheService;
    public circuitBreaker: CircuitBreakerService;

    constructor(client: APIClient) {
        this.client = client;
        this.cache = new CacheService(client);
        this.circuitBreaker = new CircuitBreakerService(client);
    }
}

class CacheService {
    private client: APIClient;
    constructor(client: APIClient) { this.client = client; }

    getStats() {
        return this.client.get<any>('/cache/stats');
    }

    getHealth() {
        return this.client.get<any>('/cache/health');
    }

    invalidate(data: { namespace: string; pattern?: string }) {
        return this.client.post<any>('/cache/invalidate', data);
    }

    batchDelete(pattern: string) {
        return this.client.delete<any>('/cache/batch', { data: { pattern } }); // Axios delete body
    }
}

class CircuitBreakerService {
    private client: APIClient;
    constructor(client: APIClient) { this.client = client; }

    getHealth() {
        return this.client.get<any>('/circuit-breaker/health');
    }

    /**
     * 获取所有熔断器状态
     */
    getStates() {
        return this.client.get<any>('/circuit-breaker/circuit-breakers');
    }

    getStats() {
        return this.client.get<any>('/circuit-breaker/circuit-breakers/stats');
    }

    /**
     * 操作熔断器
     */
    operate(name: string, action: 'open' | 'close' | 'reset') {
        return this.client.post<any>(`/circuit-breaker/circuit-breakers/${name}/${action}`);
    }

    /**
     * 获取 Provider 下游服务状态
     */
    getProviderStates() {
        return this.client.get<any>('/circuit-breaker/providers');
    }
}
