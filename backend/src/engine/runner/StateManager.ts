import { Redis } from 'ioredis';

export enum PipelineStatus {
    PENDING = 'PENDING',
    DISPATCHED = 'DISPATCHED', // Sent to BullMQ
    RUNNING = 'RUNNING',       // Worker picked it up
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED'
}

export type PipelineState = {
    status: PipelineStatus;
    updatedAt: number;
    error?: string;
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

}
