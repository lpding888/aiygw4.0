/**
 * Agent 记忆服务
 * 实现短期记忆（当前会话）和长期记忆（Redis 持久化）
 * 
 * 借鉴 AutoGPT 的记忆架构
 */

import logger from '../utils/logger.js';
import { getRedis } from '../config/redis.js';

// ============ 类型定义 ============

export interface AgentMemory {
    sessionId: string;
    userId: string;
    shortTerm: ShortTermMemory;
    longTerm?: LongTermMemory;
}

export interface ShortTermMemory {
    messages: MemoryMessage[];
    toolResults: Record<string, unknown>;
    context: Record<string, unknown>;
    createdAt: Date;
    lastAccessed: Date;
}

export interface LongTermMemory {
    userPreferences: Record<string, unknown>;
    taskHistory: TaskSummary[];
    frequentTools: string[];
    lastUpdated: Date;
}

export interface MemoryMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    timestamp: Date;
    toolCallId?: string;
}

export interface TaskSummary {
    taskId: string;
    description: string;
    toolsUsed: string[];
    success: boolean;
    completedAt: Date;
}

// ============ 记忆服务 ============

class AgentMemoryService {
    private shortTermCache: Map<string, ShortTermMemory> = new Map();

    // Redis key 前缀
    private readonly REDIS_PREFIX = 'agent_memory:';
    private readonly SHORT_TERM_TTL = 3600; // 1小时
    private readonly LONG_TERM_TTL = 86400 * 30; // 30天

    /**
     * 获取或创建会话记忆
     */
    async getOrCreateMemory(sessionId: string, userId: string): Promise<AgentMemory> {
        // 优先从内存缓存获取短期记忆
        let shortTerm = this.shortTermCache.get(sessionId);

        if (!shortTerm) {
            // 尝试从 Redis 恢复
            shortTerm = await this.loadShortTermFromRedis(sessionId) ?? undefined;

            if (!shortTerm) {
                // 创建新的短期记忆
                shortTerm = {
                    messages: [],
                    toolResults: {},
                    context: {},
                    createdAt: new Date(),
                    lastAccessed: new Date()
                };
            }

            this.shortTermCache.set(sessionId, shortTerm);
        }

        shortTerm.lastAccessed = new Date();

        // 加载长期记忆
        const longTerm = await this.loadLongTermMemory(userId);

        return {
            sessionId,
            userId,
            shortTerm,
            longTerm
        };
    }

    /**
     * 添加消息到短期记忆
     */
    addMessage(sessionId: string, message: Omit<MemoryMessage, 'timestamp'>): void {
        const shortTerm = this.shortTermCache.get(sessionId);
        if (!shortTerm) {
            logger.warn(`[AgentMemory] 会话不存在: ${sessionId}`);
            return;
        }

        shortTerm.messages.push({
            ...message,
            timestamp: new Date()
        });

        // 限制消息数量（滑动窗口）
        if (shortTerm.messages.length > 50) {
            shortTerm.messages = shortTerm.messages.slice(-50);
        }

        shortTerm.lastAccessed = new Date();
    }

    /**
     * 保存工具调用结果
     */
    saveToolResult(sessionId: string, toolName: string, result: unknown): void {
        const shortTerm = this.shortTermCache.get(sessionId);
        if (!shortTerm) return;

        shortTerm.toolResults[toolName] = result;
        shortTerm.lastAccessed = new Date();
    }

    /**
     * 获取最近的消息上下文
     */
    getRecentMessages(sessionId: string, limit: number = 10): MemoryMessage[] {
        const shortTerm = this.shortTermCache.get(sessionId);
        if (!shortTerm) return [];

        return shortTerm.messages.slice(-limit);
    }

    /**
     * 持久化短期记忆到 Redis
     */
    async persistShortTerm(sessionId: string): Promise<void> {
        const shortTerm = this.shortTermCache.get(sessionId);
        if (!shortTerm) return;

        try {
            const key = `${this.REDIS_PREFIX}short:${sessionId}`;
            await getRedis().setex(key, this.SHORT_TERM_TTL, JSON.stringify(shortTerm));
            logger.debug(`[AgentMemory] 短期记忆已持久化: ${sessionId}`);
        } catch (error) {
            logger.error(`[AgentMemory] 持久化短期记忆失败: ${sessionId}`, error);
        }
    }

    /**
     * 从 Redis 加载短期记忆
     */
    private async loadShortTermFromRedis(sessionId: string): Promise<ShortTermMemory | null> {
        try {
            const key = `${this.REDIS_PREFIX}short:${sessionId}`;
            const data = await getRedis().get(key);

            if (data) {
                const parsed = JSON.parse(data);
                // 恢复日期对象
                parsed.createdAt = new Date(parsed.createdAt);
                parsed.lastAccessed = new Date(parsed.lastAccessed);
                parsed.messages = parsed.messages.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                return parsed;
            }
        } catch (error) {
            logger.error(`[AgentMemory] 加载短期记忆失败: ${sessionId}`, error);
        }
        return null;
    }

    /**
     * 加载长期记忆
     */
    async loadLongTermMemory(userId: string): Promise<LongTermMemory | undefined> {
        try {
            const key = `${this.REDIS_PREFIX}long:${userId}`;
            const data = await getRedis().get(key);

            if (data) {
                const parsed = JSON.parse(data);
                parsed.lastUpdated = new Date(parsed.lastUpdated);
                parsed.taskHistory = parsed.taskHistory.map((t: any) => ({
                    ...t,
                    completedAt: new Date(t.completedAt)
                }));
                return parsed;
            }
        } catch (error) {
            logger.error(`[AgentMemory] 加载长期记忆失败: ${userId}`, error);
        }
        return undefined;
    }

    /**
     * 保存任务完成记录到长期记忆
     */
    async saveTaskToLongTerm(
        userId: string,
        task: Omit<TaskSummary, 'completedAt'>
    ): Promise<void> {
        try {
            let longTerm = await this.loadLongTermMemory(userId);

            if (!longTerm) {
                longTerm = {
                    userPreferences: {},
                    taskHistory: [],
                    frequentTools: [],
                    lastUpdated: new Date()
                };
            }

            // 添加任务记录
            longTerm.taskHistory.push({
                ...task,
                completedAt: new Date()
            });

            // 限制历史记录数量
            if (longTerm.taskHistory.length > 100) {
                longTerm.taskHistory = longTerm.taskHistory.slice(-100);
            }

            // 更新常用工具
            this.updateFrequentTools(longTerm, task.toolsUsed);

            longTerm.lastUpdated = new Date();

            // 持久化
            const key = `${this.REDIS_PREFIX}long:${userId}`;
            await getRedis().setex(key, this.LONG_TERM_TTL, JSON.stringify(longTerm));

            logger.debug(`[AgentMemory] 任务已保存到长期记忆: ${userId}`);
        } catch (error) {
            logger.error(`[AgentMemory] 保存长期记忆失败: ${userId}`, error);
        }
    }

    /**
     * 更新常用工具列表
     */
    private updateFrequentTools(longTerm: LongTermMemory, toolsUsed: string[]): void {
        const toolCount: Record<string, number> = {};

        // 统计历史使用频率
        for (const task of longTerm.taskHistory) {
            for (const tool of task.toolsUsed) {
                toolCount[tool] = (toolCount[tool] || 0) + 1;
            }
        }

        // 加入当前任务的工具
        for (const tool of toolsUsed) {
            toolCount[tool] = (toolCount[tool] || 0) + 1;
        }

        // 排序取 Top 10
        longTerm.frequentTools = Object.entries(toolCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tool]) => tool);
    }

    /**
     * 保存用户偏好
     */
    async saveUserPreference(
        userId: string,
        key: string,
        value: unknown
    ): Promise<void> {
        let longTerm = await this.loadLongTermMemory(userId);

        if (!longTerm) {
            longTerm = {
                userPreferences: {},
                taskHistory: [],
                frequentTools: [],
                lastUpdated: new Date()
            };
        }

        longTerm.userPreferences[key] = value;
        longTerm.lastUpdated = new Date();

        const redisKey = `${this.REDIS_PREFIX}long:${userId}`;
        await getRedis().setex(redisKey, this.LONG_TERM_TTL, JSON.stringify(longTerm));
    }

    /**
     * 获取用户偏好
     */
    async getUserPreference(userId: string, key: string): Promise<unknown> {
        const longTerm = await this.loadLongTermMemory(userId);
        return longTerm?.userPreferences[key];
    }

    /**
     * 清理过期的短期记忆缓存
     */
    cleanupExpiredMemories(): void {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30分钟未访问则清理

        for (const [sessionId, memory] of this.shortTermCache.entries()) {
            if (now - memory.lastAccessed.getTime() > maxAge) {
                this.shortTermCache.delete(sessionId);
                logger.debug(`[AgentMemory] 清理过期会话: ${sessionId}`);
            }
        }
    }

    /**
     * 构建增强的用户输入（注入相关记忆上下文）
     */
    async enhanceInputWithMemory(
        sessionId: string,
        userId: string,
        input: string
    ): Promise<string> {
        const memory = await this.getOrCreateMemory(sessionId, userId);

        const parts: string[] = [];

        // 注入用户偏好
        if (memory.longTerm?.userPreferences && Object.keys(memory.longTerm.userPreferences).length > 0) {
            parts.push(`[用户偏好]\n${JSON.stringify(memory.longTerm.userPreferences, null, 2)}`);
        }

        // 注入常用工具提示
        if (memory.longTerm?.frequentTools && memory.longTerm.frequentTools.length > 0) {
            parts.push(`[常用工具]\n${memory.longTerm.frequentTools.join(', ')}`);
        }

        // 注入最近任务上下文
        if (memory.longTerm?.taskHistory && memory.longTerm.taskHistory.length > 0) {
            const recentTasks = memory.longTerm.taskHistory.slice(-3);
            const taskSummary = recentTasks.map(t => `- ${t.description} (${t.success ? '成功' : '失败'})`).join('\n');
            parts.push(`[最近任务]\n${taskSummary}`);
        }

        // 用户输入
        parts.push(`[当前请求]\n${input}`);

        return parts.join('\n\n');
    }

    /**
     * 结束会话并清理
     */
    async endSession(sessionId: string): Promise<void> {
        // 持久化后清理
        await this.persistShortTerm(sessionId);
        this.shortTermCache.delete(sessionId);
        logger.debug(`[AgentMemory] 会话已结束: ${sessionId}`);
    }
}

// 导出单例
export const agentMemoryService = new AgentMemoryService();
export default agentMemoryService;
