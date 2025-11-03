const Redis = require('ioredis');
const logger = require('./logger');

class RedisManager {
  constructor() {
    this._commandClient = null;
    this._subscriberClient = null;
    this._patternSubscriber = null;
    this._channelHandlers = new Map();
    this._patternHandlers = new Map();
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  }

  async _getCommandClient() {
    if (!this._commandClient) {
      this._commandClient = this._createClient('command');
    }
    return this._commandClient;
  }

  async _getSubscriberClient() {
    if (!this._subscriberClient) {
      this._subscriberClient = this._createClient('subscriber');
      this._subscriberClient.on('message', (channel, message) => {
        const handlers = this._channelHandlers.get(channel);
        if (!handlers) return;
        handlers.forEach((handler) => {
          try {
            const result = handler(message, channel);
            if (result && typeof result.then === 'function') {
              result.catch((error) => {
                logger.error('[Redis] 订阅回调执行失败', { channel, error });
              });
            }
          } catch (error) {
            logger.error('[Redis] 处理订阅消息失败', { channel, error });
          }
        });
      });
    }
    return this._subscriberClient;
  }

  async _getPatternSubscriber() {
    if (!this._patternSubscriber) {
      this._patternSubscriber = this._createClient('pattern-subscriber');
      this._patternSubscriber.on('pmessage', (pattern, channel, message) => {
        const handlers = this._patternHandlers.get(pattern);
        if (!handlers) return;
        handlers.forEach((handler) => {
          try {
            const result = handler(message, channel, pattern);
            if (result && typeof result.then === 'function') {
              result.catch((error) => {
                logger.error('[Redis] 模式订阅回调执行失败', { pattern, channel, error });
              });
            }
          } catch (error) {
            logger.error('[Redis] 处理模式订阅消息失败', { pattern, channel, error });
          }
        });
      });
    }
    return this._patternSubscriber;
  }

  _createClient(label) {
    const client = new Redis(this.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true
    });

    client.on('error', (error) => {
      logger.error(`[Redis] ${label} 客户端错误`, { error });
    });

    client.on('reconnecting', () => {
      logger.warn(`[Redis] ${label} 客户端正在重连`);
    });

    return client;
  }

  // ============ 基础命令 ============
  async get(key) {
    const client = await this._getCommandClient();
    return client.get(key);
  }

  async set(key, value) {
    const client = await this._getCommandClient();
    return client.set(key, value);
  }

  async setex(key, seconds, value) {
    const client = await this._getCommandClient();
    return client.setex(key, seconds, value);
  }

  async del(key) {
    const client = await this._getCommandClient();
    return client.del(key);
  }

  async exists(key) {
    const client = await this._getCommandClient();
    return client.exists(key);
  }

  async expire(key, seconds) {
    const client = await this._getCommandClient();
    return client.expire(key, seconds);
  }

  async ttl(key) {
    const client = await this._getCommandClient();
    return client.ttl(key);
  }

  async keys(pattern) {
    const client = await this._getCommandClient();
    return client.keys(pattern);
  }

  async flushall() {
    const client = await this._getCommandClient();
    return client.flushall();
  }

  async ping() {
    const client = await this._getCommandClient();
    return client.ping();
  }

  // ============ Sorted Set ============
  async zadd(key, score, member) {
    const client = await this._getCommandClient();
    return client.zadd(key, score, member);
  }

  async zrem(key, member) {
    const client = await this._getCommandClient();
    return client.zrem(key, member);
  }

  async zrange(key, start, stop) {
    const client = await this._getCommandClient();
    return client.zrange(key, start, stop);
  }

  async zrangebyscore(key, min, max) {
    const client = await this._getCommandClient();
    return client.zrangebyscore(key, min, max);
  }

  async zremrangebyscore(key, min, max) {
    const client = await this._getCommandClient();
    return client.zremrangebyscore(key, min, max);
  }

  async zcard(key) {
    const client = await this._getCommandClient();
    return client.zcard(key);
  }

  async zrank(key, member) {
    const client = await this._getCommandClient();
    return client.zrank(key, member);
  }

  async zincrby(key, increment, member) {
    const client = await this._getCommandClient();
    return client.zincrby(key, increment, member);
  }

  // ============ Hash ============
  async hget(key, field) {
    const client = await this._getCommandClient();
    return client.hget(key, field);
  }

  async hset(key, field, value) {
    const client = await this._getCommandClient();
    return client.hset(key, field, value);
  }

  async hdel(key, field) {
    const client = await this._getCommandClient();
    return client.hdel(key, field);
  }

  async hexists(key, field) {
    const client = await this._getCommandClient();
    return client.hexists(key, field);
  }

  async hgetall(key) {
    const client = await this._getCommandClient();
    return client.hgetall(key);
  }

  async hkeys(key) {
    const client = await this._getCommandClient();
    return client.hkeys(key);
  }

  async hvals(key) {
    const client = await this._getCommandClient();
    return client.hvals(key);
  }

  async hlen(key) {
    const client = await this._getCommandClient();
    return client.hlen(key);
  }

  async hincrby(key, field, increment) {
    const client = await this._getCommandClient();
    return client.hincrby(key, field, increment);
  }

  // ============ List ============
  async lpush(key, ...values) {
    const client = await this._getCommandClient();
    return client.lpush(key, ...values);
  }

  async rpush(key, ...values) {
    const client = await this._getCommandClient();
    return client.rpush(key, ...values);
  }

  async lpop(key) {
    const client = await this._getCommandClient();
    return client.lpop(key);
  }

  async rpop(key) {
    const client = await this._getCommandClient();
    return client.rpop(key);
  }

  async llen(key) {
    const client = await this._getCommandClient();
    return client.llen(key);
  }

  async lindex(key, index) {
    const client = await this._getCommandClient();
    return client.lindex(key, index);
  }

  async lrange(key, start, stop) {
    const client = await this._getCommandClient();
    return client.lrange(key, start, stop);
  }

  async ltrim(key, start, stop) {
    const client = await this._getCommandClient();
    return client.ltrim(key, start, stop);
  }

  async lset(key, index, value) {
    const client = await this._getCommandClient();
    return client.lset(key, index, value);
  }

  async lrem(key, count, value) {
    const client = await this._getCommandClient();
    return client.lrem(key, count, value);
  }

  // ============ Set ============
  async sadd(key, ...members) {
    const client = await this._getCommandClient();
    return client.sadd(key, ...members);
  }

  async srem(key, ...members) {
    const client = await this._getCommandClient();
    return client.srem(key, ...members);
  }

  async sismember(key, member) {
    const client = await this._getCommandClient();
    return client.sismember(key, member);
  }

  async smembers(key) {
    const client = await this._getCommandClient();
    return client.smembers(key);
  }

  async scard(key) {
    const client = await this._getCommandClient();
    return client.scard(key);
  }

  async sinter(...keys) {
    const client = await this._getCommandClient();
    return client.sinter(...keys);
  }

  async sunion(...keys) {
    const client = await this._getCommandClient();
    return client.sunion(...keys);
  }

  async sdiff(...keys) {
    const client = await this._getCommandClient();
    return client.sdiff(...keys);
  }

  // ============ Pub/Sub ============
  async publish(channel, message) {
    const client = await this._getCommandClient();
    return client.publish(channel, message);
  }

  async subscribe(channel, handler) {
    const subscriber = await this._getSubscriberClient();
    let handlers = this._channelHandlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this._channelHandlers.set(channel, handlers);
      await subscriber.subscribe(channel);
      logger.info('[Redis] 订阅频道', { channel });
    }
    handlers.add(handler);
    return () => this.unsubscribe(channel, handler);
  }

  async unsubscribe(channel, handler) {
    if (!this._subscriberClient) {
      return;
    }

    const handlers = this._channelHandlers.get(channel);
    if (!handlers) {
      return;
    }

    if (handler) {
      handlers.delete(handler);
    } else {
      handlers.clear();
    }

    if (handlers.size === 0) {
      await this._subscriberClient.unsubscribe(channel);
      this._channelHandlers.delete(channel);
      logger.info('[Redis] 取消订阅频道', { channel });
    }
  }

  async psubscribe(pattern, handler) {
    const subscriber = await this._getPatternSubscriber();
    let handlers = this._patternHandlers.get(pattern);
    if (!handlers) {
      handlers = new Set();
      this._patternHandlers.set(pattern, handlers);
      await subscriber.psubscribe(pattern);
      logger.info('[Redis] 模式订阅', { pattern });
    }
    handlers.add(handler);
    return () => this.punsubscribe(pattern, handler);
  }

  async punsubscribe(pattern, handler) {
    if (!this._patternSubscriber) {
      return;
    }

    const handlers = this._patternHandlers.get(pattern);
    if (!handlers) {
      return;
    }

    if (handler) {
      handlers.delete(handler);
    } else {
      handlers.clear();
    }

    if (handlers.size === 0) {
      await this._patternSubscriber.punsubscribe(pattern);
      this._patternHandlers.delete(pattern);
      logger.info('[Redis] 取消模式订阅', { pattern });
    }
  }
}

const redisManager = new RedisManager();

module.exports = redisManager;
