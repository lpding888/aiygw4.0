const redis = require('../utils/redis');

class ConfigCacheService {
  async getOrSet(options, fetcher) {
    try {
      const { scope, key, version } = options;
      const cacheKey = `${scope}:${key}:${version}`;

      // 尝试从缓存获取
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // 从数据源获取
      const data = await fetcher();

      // 存入缓存
      await redis.setex(cacheKey, 3600, JSON.stringify(data)); // 1小时过期

      return data;
    } catch (error) {
      console.error('Cache error:', error);
      return await fetcher();
    }
  }

  async invalidate(scope) {
    try {
      const pattern = `${scope}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await Promise.all(keys.map(key => redis.del(key)));
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
}

const configCacheService = new ConfigCacheService();
module.exports = configCacheService;