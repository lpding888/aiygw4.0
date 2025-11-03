const Redis = require('ioredis');

class RedisClient {
  constructor() {
    this.client = null;
  }

  async connect() {
    if (!this.client) {
      this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    }
    return this.client;
  }

  get client() {
    return this.client;
  }
}

const redisInstance = new RedisClient();

// 兼容现有代码的导入方式
const redis = {
  get: async (key) => {
    const client = await redisInstance.connect();
    return client.get(key);
  },
  set: async (key, value) => {
    const client = await redisInstance.connect();
    return client.set(key, value);
  },
  setex: async (key, seconds, value) => {
    const client = await redisInstance.connect();
    return client.setex(key, seconds, value);
  },
  del: async (key) => {
    const client = await redisInstance.connect();
    return client.del(key);
  },
  exists: async (key) => {
    const client = await redisInstance.connect();
    return client.exists(key);
  },
  expire: async (key, seconds) => {
    const client = await redisInstance.connect();
    return client.expire(key, seconds);
  },
  ttl: async (key) => {
    const client = await redisInstance.connect();
    return client.ttl(key);
  },
  keys: async (pattern) => {
    const client = await redisInstance.connect();
    return client.keys(pattern);
  },
  flushall: async () => {
    const client = await redisInstance.connect();
    return client.flushall();
  },
  ping: async () => {
    const client = await redisInstance.connect();
    return client.ping();
  },
  zadd: async (key, score, member) => {
    const client = await redisInstance.connect();
    return client.zadd(key, score, member);
  },
  zrem: async (key, member) => {
    const client = await redisInstance.connect();
    return client.zrem(key, member);
  },
  zrange: async (key, start, stop) => {
    const client = await redisInstance.connect();
    return client.zrange(key, start, stop);
  },
  zrangebyscore: async (key, min, max) => {
    const client = await redisInstance.connect();
    return client.zrangebyscore(key, min, max);
  },
  zremrangebyscore: async (key, min, max) => {
    const client = await redisInstance.connect();
    return client.zremrangebyscore(key, min, max);
  },
  zcard: async (key) => {
    const client = await redisInstance.connect();
    return client.zcard(key);
  },
  zrank: async (key, member) => {
    const client = await redisInstance.connect();
    return client.zrank(key, member);
  },
  zincrby: async (key, increment, member) => {
    const client = await redisInstance.connect();
    return client.zincrby(key, increment, member);
  },
  hget: async (key, field) => {
    const client = await redisInstance.connect();
    return client.hget(key, field);
  },
  hset: async (key, field, value) => {
    const client = await redisInstance.connect();
    return client.hset(key, field, value);
  },
  hdel: async (key, field) => {
    const client = await redisInstance.connect();
    return client.hdel(key, field);
  },
  hexists: async (key, field) => {
    const client = await redisInstance.connect();
    return client.hexists(key, field);
  },
  hgetall: async (key) => {
    const client = await redisInstance.connect();
    return client.hgetall(key);
  },
  hkeys: async (key) => {
    const client = await redisInstance.connect();
    return client.hkeys(key);
  },
  hvals: async (key) => {
    const client = await redisInstance.connect();
    return client.hvals(key);
  },
  hlen: async (key) => {
    const client = await redisInstance.connect();
    return client.hlen(key);
  },
  hincrby: async (key, field, increment) => {
    const client = await redisInstance.connect();
    return client.hincrby(key, field, increment);
  },
  lpush: async (key, ...values) => {
    const client = await redisInstance.connect();
    return client.lpush(key, ...values);
  },
  rpush: async (key, ...values) => {
    const client = await redisInstance.connect();
    return client.rpush(key, ...values);
  },
  lpop: async (key) => {
    const client = await redisInstance.connect();
    return client.lpop(key);
  },
  rpop: async (key) => {
    const client = await redisInstance.connect();
    return client.rpop(key);
  },
  llen: async (key) => {
    const client = await redisInstance.connect();
    return client.llen(key);
  },
  lindex: async (key, index) => {
    const client = await redisInstance.connect();
    return client.lindex(key, index);
  },
  lrange: async (key, start, stop) => {
    const client = await redisInstance.connect();
    return client.lrange(key, start, stop);
  },
  ltrim: async (key, start, stop) => {
    const client = await redisInstance.connect();
    return client.ltrim(key, start, stop);
  },
  lset: async (key, index, value) => {
    const client = await redisInstance.connect();
    return client.lset(key, index, value);
  },
  lrem: async (key, count, value) => {
    const client = await redisInstance.connect();
    return client.lrem(key, count, value);
  },
  sadd: async (key, ...members) => {
    const client = await redisInstance.connect();
    return client.sadd(key, ...members);
  },
  srem: async (key, ...members) => {
    const client = await redisInstance.connect();
    return client.srem(key, ...members);
  },
  sismember: async (key, member) => {
    const client = await redisInstance.connect();
    return client.sismember(key, member);
  },
  smembers: async (key) => {
    const client = await redisInstance.connect();
    return client.smembers(key);
  },
  scard: async (key) => {
    const client = await redisInstance.connect();
    return client.scard(key);
  },
  sinter: async (...keys) => {
    const client = await redisInstance.connect();
    return client.sinter(...keys);
  },
  sunion: async (...keys) => {
    const client = await redisInstance.connect();
    return client.sunion(...keys);
  },
  sdiff: async (...keys) => {
    const client = await redisInstance.connect();
    return client.sdiff(...keys);
  },
  publish: async (channel, message) => {
    const client = await redisInstance.connect();
    return client.publish(channel, message);
  },
  subscribe: async (channel, callback) => {
    const client = await redisInstance.connect();
    return client.subscribe(channel, callback);
  },
  unsubscribe: async (channel) => {
    const client = await redisInstance.connect();
    return client.unsubscribe(channel);
  },
  psubscribe: async (pattern, callback) => {
    const client = await redisInstance.connect();
    return client.psubscribe(pattern, callback);
  },
  punsubscribe: async (pattern) => {
    const client = await redisInstance.connect();
    return client.punsubscribe(pattern);
  }
};

module.exports = redis;