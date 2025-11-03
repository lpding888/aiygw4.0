<<<<<<< HEAD
// Jest测试设置文件
require('dotenv/config');

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = '';
process.env.DB_NAME = 'ai_photo_backend_test';

// 全局测试超时时间
jest.setTimeout(30000);
=======
/**
 * Jest测试环境设置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key';
process.env.REDIS_URL = 'redis://localhost:6379/1'; // 使用数据库1进行测试

// 模拟数据库连接
const mockKnex = {
  select: jest.fn(() => mockKnex),
  where: jest.fn(() => mockKnex),
  whereIn: jest.fn(() => mockKnex),
  whereNot: jest.fn(() => mockKnex),
  whereRaw: jest.fn(() => mockKnex),
  whereLike: jest.fn(() => mockKnex),
  orderBy: jest.fn(() => mockKnex),
  orderByRaw: jest.fn(() => mockKnex),
  limit: jest.fn(() => mockKnex),
  offset: jest.fn(() => mockKnex),
  first: jest.fn(() => mockKnex),
  insert: jest.fn(() => mockKnex),
  update: jest.fn(() => mockKnex),
  del: jest.fn(() => mockKnex),
  count: jest.fn(() => mockKnex),
  avg: jest.fn(() => mockKnex),
  sum: jest.fn(() => mockKnex),
  max: jest.fn(() => mockKnex),
  min: jest.fn(() => mockKnex),
  groupBy: jest.fn(() => mockKnex),
  having: jest.fn(() => mockKnex),
  join: jest.fn(() => mockKnex),
  leftJoin: jest.fn(() => mockKnex),
  rightJoin: jest.fn(() => mockKnex),
  innerJoin: jest.fn(() => mockKnex),
  transaction: jest.fn(() => Promise.resolve()),
  raw: jest.fn(() => mockKnex),
  clearSelect: jest.fn(() => mockKnex),
  clone: jest.fn(() => mockKnex),
  returning: jest.fn(() => mockKnex),
  into: jest.fn(() => mockKnex),
  from: jest.fn(() => mockKnex),
  exists: jest.fn(() => mockKnex),
  notExists: jest.fn(() => mockKnex),
  andWhere: jest.fn(() => mockKnex),
  orWhere: jest.fn(() => mockKnex),
  andWhereRaw: jest.fn(() => mockKnex),
  orWhereRaw: jest.fn(() => mockKnex),
  andWhereIn: jest.fn(() => mockKnex),
  orWhereIn: jest.fn(() => mockKnex),
  andWhereNotIn: jest.fn(() => mockKnex),
  orWhereNotIn: jest.fn(() => mockKnex),
  andWhereBetween: jest.fn(() => mockKnex),
  orWhereBetween: jest.fn(() => mockKnex),
  andWhereNull: jest.fn(() => mockKnex),
  orWhereNull: jest.fn(() => mockKnex),
  andWhereNotNull: jest.fn(() => mockKnex),
  orWhereNotNull: jest.fn(() => mockKnex)
};

// 模拟Redis客户端
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  keys: jest.fn(),
  flushall: jest.fn(),
  ping: jest.fn(() => Promise.resolve('PONG')),
  zadd: jest.fn(),
  zrem: jest.fn(),
  zrange: jest.fn(),
  zrangebyscore: jest.fn(),
  zremrangebyscore: jest.fn(),
  zcard: jest.fn(),
  zrank: jest.fn(),
  zincrby: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hexists: jest.fn(),
  hgetall: jest.fn(),
  hkeys: jest.fn(),
  hvals: jest.fn(),
  hlen: jest.fn(),
  hincrby: jest.fn(),
  lpush: jest.fn(),
  rpush: jest.fn(),
  lpop: jest.fn(),
  rpop: jest.fn(),
  llen: jest.fn(),
  lindex: jest.fn(),
  lrange: jest.fn(),
  ltrim: jest.fn(),
  lset: jest.fn(),
  lrem: jest.fn(),
  sadd: jest.fn(),
  srem: jest.fn(),
  sismember: jest.fn(),
  smembers: jest.fn(),
  scard: jest.fn(),
  sinter: jest.fn(),
  sunion: jest.fn(),
  sdiff: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  psubscribe: jest.fn(),
  punsubscribe: jest.fn()
};

// 模拟模块
jest.mock('../src/db/connection', () => ({
  knex: mockKnex
}));

jest.mock('../src/utils/redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  keys: jest.fn(),
  flushall: jest.fn(),
  ping: jest.fn(() => Promise.resolve('PONG')),
  zadd: jest.fn(),
  zrem: jest.fn(),
  zrange: jest.fn(),
  zrangebyscore: jest.fn(),
  zremrangebyscore: jest.fn(),
  zcard: jest.fn(),
  zrank: jest.fn(),
  zincrby: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hexists: jest.fn(),
  hgetall: jest.fn(),
  hkeys: jest.fn(),
  hvals: jest.fn(),
  hlen: jest.fn(),
  hincrby: jest.fn(),
  lpush: jest.fn(),
  rpush: jest.fn(),
  lpop: jest.fn(),
  rpop: jest.fn(),
  llen: jest.fn(),
  lindex: jest.fn(),
  lrange: jest.fn(),
  ltrim: jest.fn(),
  lset: jest.fn(),
  lrem: jest.fn(),
  sadd: jest.fn(),
  srem: jest.fn(),
  sismember: jest.fn(),
  smembers: jest.fn(),
  scard: jest.fn(),
  sinter: jest.fn(),
  sunion: jest.fn(),
  sdiff: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  psubscribe: jest.fn(),
  punsubscribe: jest.fn()
}));

// 模拟logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// 模拟缓存服务
jest.mock('../src/cache/config-cache', () => ({
  getOrSet: jest.fn(),
  invalidate: jest.fn()
}));

// 全局测试超时
jest.setTimeout(30000);

// 全局 beforeEach 清理
beforeEach(() => {
  // 清除所有模拟调用记录
  jest.clearAllMocks();
});

// 全局 afterEach 清理
afterEach(() => {
  // 重置所有模拟
  jest.restoreAllMocks();
});

// 添加全局测试工具
global.createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    get: jest.fn()
  };
  return res;
};

global.createMockRequest = (overrides = {}) => {
  const req = {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { id: 'test-user-id', role: 'admin' },
    ip: '127.0.0.1',
    id: 'test-request-id',
    ...overrides
  };
  return req;
};

global.createMockNext = () => {
  return jest.fn();
};

// 添加数据库模拟数据工厂
global.createMockUser = (overrides = {}) => {
  return {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$10$hashedpassword',
    role: 'user',
    enabled: true,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  };
};

global.createMockFeature = (overrides = {}) => {
  return {
    id: 'feature-123',
    key: 'test-feature',
    name: 'Test Feature',
    description: 'A test feature',
    category: 'test',
    config: {},
    enabled: true,
    status: 'published',
    version: '1.0.0',
    created_by: 'user-123',
    updated_by: 'user-123',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  };
};

// 辅助函数：等待异步操作
global.waitFor = (condition, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 50);
      }
    };

    check();
  });
};

// 辅助函数：生成随机字符串
global.randomString = (length = 10) => {
  return Math.random().toString(36).substring(2, 2 + length);
};

// 辅助函数：生成随机数字
global.randomNumber = (min = 0, max = 100) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// 辅助函数：生成随机邮箱
global.randomEmail = () => {
  return `test-${randomString()}@example.com`;
};

// 控制台输出测试信息
console.log('✅ Jest test environment setup completed');
