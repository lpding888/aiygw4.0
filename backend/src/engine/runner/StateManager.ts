import { Redis } from 'ioredis';

export enum PipelineStatus {
    PENDING = 'PENDING',
    DISPATCHED = 'DISPATCHED', // Sent to BullMQ
    RUNNING = 'RUNNING',       // Worker picked it up
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED'
}

export enum NodeStatus {
    PENDING = 'PENDING',       // 等待执行
    RUNNING = 'RUNNING',       // 执行中
    COMPLETED = 'COMPLETED',   // 执行成功
    FAILED = 'FAILED',         // 执行失败
    SKIPPED = 'SKIPPED'        // 被跳过
}

export type PipelineState = {
    status: PipelineStatus;
    updatedAt: number;
    error?: string;
}

export type NodeState = {
    status: NodeStatus;
    startedAt?: number;
    completedAt?: number;
    error?: string;
    retries?: number;
}

/**
 * StateManager: Atomic State Machine backed by Redis.
 * Uses Lua scripts to ensure CAS (Compare-And-Swap) semantics.
 */
export class StateManager {
    private redis: Redis;

    constructor(redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379') {
        this.redis = new Redis(redisUrl);
        this.defineLuaScripts();
    }

    private defineLuaScripts() {
        // Lua Script: Atomic Compare-And-Set
        // KEYS[1]: State Key (exec:{runId}:state)
        // ARGV[1]: Expected Old Status (or 'null')
        // ARGV[2]: New Status
        // ARGV[3]: Timestamp
        // Returns: [success (1/0), current_status]
        this.redis.defineCommand('casStatus', {
            numberOfKeys: 1,
            lua: `
                local key = KEYS[1]
                local expected = ARGV[1]
                local newStatus = ARGV[2]
                local ts = ARGV[3]
                
                local current = redis.call('HGET', key, 'status')
                
                -- Handle 'null' string case for clarity
                if current == false then current = 'null' end
                
                if current == expected then
                    redis.call('HSET', key, 'status', newStatus, 'updatedAt', ts)
                    return {1, newStatus}
                else
                    return {0, current}
                end
            `
        });
    }

    /**
     * Atomically transitions state from expected -> new.
     * Returns true if successful, false if state changed in mean time.
     * Throws error if transition is invalid logic (business logic can be here or caller).
     */
    async transition(runId: string, expectedStatus: PipelineStatus | null, newStatus: PipelineStatus): Promise<{ success: boolean, current: PipelineStatus }> {
        const key = `exec:${runId}:state`;
        const expected = expectedStatus || 'null';
        const now = Date.now();

        // @ts-ignore - 'casStatus' is dynamically defined
        const result = await (this.redis as any).casStatus(key, expected, newStatus, now);

        return {
            success: result[0] === 1,
            current: result[1] as PipelineStatus
        };
    }

    /**
     * Force set state (e.g. for initialization or admin override)
     */
    async setState(runId: string, status: PipelineStatus, error?: string) {
        const key = `exec:${runId}:state`;
        const data: any = {
            status,
            updatedAt: Date.now()
        };
        if (error) data.error = error;
        await this.redis.hset(key, data);
    }

    async tryDispatch(runId: string): Promise<boolean> {
        const result = await this.transition(runId, PipelineStatus.PENDING, PipelineStatus.DISPATCHED);
        return result.success;
    }

    async setExecutionSchema(runId: string, schemaId: string) {
        await this.redis.hset(`exec:${runId}:meta`, 'schemaId', schemaId);
    }

    async getExecutionSchema(runId: string): Promise<string | null> {
        return this.redis.hget(`exec:${runId}:meta`, 'schemaId');
    }

    /**
     * Store node output execution result.
     */
    async setNodeOutput(runId: string, nodeId: string, output: any) {
        const key = `exec:${runId}:outputs`;
        // Serialize to JSON
        await this.redis.hset(key, nodeId, JSON.stringify(output));
    }

    /**
     * Retrieve upstream node output.
     */
    async getNodeOutput(runId: string, nodeId: string): Promise<any> {
        const key = `exec:${runId}:outputs`;
        const raw = await this.redis.hget(key, nodeId);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return raw;
        }
    }

    /**
     * 设置节点执行状态（细粒度状态管理）
     * 节点状态键格式: exec:{runId}:nodes:{nodeId}
     */
    async setNodeState(runId: string, nodeId: string, status: NodeStatus, error?: string) {
        const key = `exec:${runId}:nodes:${nodeId}`;
        const now = Date.now();

        const state: NodeState = {
            status,
            ...(status === NodeStatus.RUNNING && { startedAt: now }),
            ...(status === NodeStatus.COMPLETED || status === NodeStatus.FAILED ? { completedAt: now } : {}),
            ...(error && { error })
        };

        // 存储完整状态
        await this.redis.hset(key, state as any);

        // 设置过期时间（7天后自动清理）
        await this.redis.expire(key, 7 * 24 * 60 * 60);
    }

    /**
     * 获取节点执行状态
     */
    async getNodeState(runId: string, nodeId: string): Promise<NodeState | null> {
        const key = `exec:${runId}:nodes:${nodeId}`;
        const data = await this.redis.hgetall(key);

        if (!data || Object.keys(data).length === 0) {
            return null;
        }

        return {
            status: data.status as NodeStatus,
            startedAt: data.startedAt ? parseInt(data.startedAt) : undefined,
            completedAt: data.completedAt ? parseInt(data.completedAt) : undefined,
            error: data.error,
            retries: data.retries ? parseInt(data.retries) : undefined
        };
    }

    /**
     * 获取Pipeline中所有节点的状态
     */
    async getAllNodeStates(runId: string, nodeIds: string[]): Promise<Map<string, NodeState>> {
        const states = new Map<string, NodeState>();

        // 批量获取所有节点状态
        await Promise.all(
            nodeIds.map(async (nodeId) => {
                const state = await this.getNodeState(runId, nodeId);
                if (state) {
                    states.set(nodeId, state);
                }
            })
        );

        return states;
    }

    /**
     * 增加节点重试次数
     */
    async incrementNodeRetries(runId: string, nodeId: string): Promise<number> {
        const key = `exec:${runId}:nodes:${nodeId}`;
        const retries = await this.redis.hincrby(key, 'retries', 1);
        return retries;
    }

    /**
     * 清理执行状态（包括节点状态）
     */
    async cleanupExecution(runId: string) {
        const pattern = `exec:${runId}:*`;
        const keys = await this.redis.keys(pattern);

        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
    }

}
