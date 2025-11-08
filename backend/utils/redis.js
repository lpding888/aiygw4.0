import { Redis } from 'ioredis';
import logger from './logger.js';
export class RedisManager {
    constructor() {
        this.clients = {
            command: null,
            subscriber: null,
            patternSubscriber: null
        };
        this.channelHandlers = new Map();
        this.patternHandlers = new Map();
        this.redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
        this.baseOptions = {
            lazyConnect: true,
            maxRetriesPerRequest: null,
            enableReadyCheck: true
        };
    }
    createClient(label) {
        const client = new Redis(this.redisUrl, this.baseOptions);
        client.on('error', (error) => {
            logger.error(`[Redis] ${label} 客户端错误`, { error });
        });
        client.on('reconnecting', () => {
            logger.warn(`[Redis] ${label} 客户端正在重连`);
        });
        return client;
    }
    async getCommandClient() {
        if (!this.clients.command) {
            this.clients.command = this.createClient('command');
        }
        return this.clients.command;
    }
    async getSubscriberClient() {
        if (!this.clients.subscriber) {
            const subscriber = this.createClient('subscriber');
            subscriber.on('message', (channel, message) => {
                const handlers = this.channelHandlers.get(channel);
                if (!handlers)
                    return;
                handlers.forEach((handler) => {
                    Promise.resolve(handler(message, channel)).catch((error) => {
                        logger.error('[Redis] 订阅回调执行失败', { channel, error });
                    });
                });
            });
            this.clients.subscriber = subscriber;
        }
        return this.clients.subscriber;
    }
    async getPatternSubscriber() {
        if (!this.clients.patternSubscriber) {
            const patternSubscriber = this.createClient('patternSubscriber');
            patternSubscriber.on('pmessage', (pattern, channel, message) => {
                const handlers = this.patternHandlers.get(pattern);
                if (!handlers)
                    return;
                handlers.forEach((handler) => {
                    Promise.resolve(handler(message, channel, pattern)).catch((error) => {
                        logger.error('[Redis] 模式订阅回调执行失败', { pattern, channel, error });
                    });
                });
            });
            this.clients.patternSubscriber = patternSubscriber;
        }
        return this.clients.patternSubscriber;
    }
    // ===== 基础命令 =====
    async get(key) {
        const client = await this.getCommandClient();
        return client.get(key);
    }
    async set(key, value) {
        const client = await this.getCommandClient();
        return client.set(key, value);
    }
    async setex(key, seconds, value) {
        const client = await this.getCommandClient();
        return client.setex(key, seconds, value);
    }
    async del(...keys) {
        const client = await this.getCommandClient();
        return client.del(...keys);
    }
    async exists(key) {
        const client = await this.getCommandClient();
        return client.exists(key);
    }
    async expire(key, seconds) {
        const client = await this.getCommandClient();
        return client.expire(key, seconds);
    }
    async ttl(key) {
        const client = await this.getCommandClient();
        return client.ttl(key);
    }
    async keys(pattern) {
        const client = await this.getCommandClient();
        return client.keys(pattern);
    }
    async flushall() {
        const client = await this.getCommandClient();
        return client.flushall();
    }
    async publish(channel, message) {
        const client = await this.getCommandClient();
        return client.publish(channel, message);
    }
    // ===== 列表操作 (部分示例，保留原有API) =====
    async lrange(key, start, stop) {
        const client = await this.getCommandClient();
        return client.lrange(key, start, stop);
    }
    async lpush(key, ...values) {
        const client = await this.getCommandClient();
        return client.lpush(key, ...values);
    }
    async rpush(key, ...values) {
        const client = await this.getCommandClient();
        return client.rpush(key, ...values);
    }
    async ltrim(key, start, stop) {
        const client = await this.getCommandClient();
        return client.ltrim(key, start, stop);
    }
    // ===== Set 操作 =====
    async sadd(key, ...members) {
        const client = await this.getCommandClient();
        return client.sadd(key, ...members);
    }
    async srem(key, ...members) {
        const client = await this.getCommandClient();
        return client.srem(key, ...members);
    }
    async smembers(key) {
        const client = await this.getCommandClient();
        return client.smembers(key);
    }
    // ===== Pub/Sub =====
    async subscribe(channel, handler) {
        const subscriber = await this.getSubscriberClient();
        let handlers = this.channelHandlers.get(channel);
        if (!handlers) {
            handlers = new Set();
            this.channelHandlers.set(channel, handlers);
            await subscriber.subscribe(channel);
            logger.info('[Redis] 订阅频道', { channel });
        }
        handlers.add(handler);
        return async () => this.unsubscribe(channel, handler);
    }
    async unsubscribe(channel, handler) {
        const subscriber = this.clients.subscriber;
        if (!subscriber) {
            return;
        }
        const handlers = this.channelHandlers.get(channel);
        if (!handlers) {
            return;
        }
        if (handler) {
            handlers.delete(handler);
        }
        else {
            handlers.clear();
        }
        if (handlers.size === 0) {
            await subscriber.unsubscribe(channel);
            this.channelHandlers.delete(channel);
            logger.info('[Redis] 取消订阅频道', { channel });
        }
    }
    async psubscribe(pattern, handler) {
        const subscriber = await this.getPatternSubscriber();
        let handlers = this.patternHandlers.get(pattern);
        if (!handlers) {
            handlers = new Set();
            this.patternHandlers.set(pattern, handlers);
            await subscriber.psubscribe(pattern);
            logger.info('[Redis] 模式订阅', { pattern });
        }
        handlers.add(handler);
        return async () => this.punsubscribe(pattern, handler);
    }
    async punsubscribe(pattern, handler) {
        const subscriber = this.clients.patternSubscriber;
        if (!subscriber) {
            return;
        }
        const handlers = this.patternHandlers.get(pattern);
        if (!handlers) {
            return;
        }
        if (handler) {
            handlers.delete(handler);
        }
        else {
            handlers.clear();
        }
        if (handlers.size === 0) {
            await subscriber.punsubscribe(pattern);
            this.patternHandlers.delete(pattern);
            logger.info('[Redis] 取消模式订阅', { pattern });
        }
    }
}
const redisManager = new RedisManager();
export default redisManager;
