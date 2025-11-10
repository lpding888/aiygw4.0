import logger from '../utils/logger.js';
import { checkRateLimit, type RateLimitResult } from '../config/redis.js';

export interface ParsedPolicy {
  window: number; // seconds
  limit: number;
}

export function parseRateLimitPolicy(policy?: string | null): ParsedPolicy | null {
  if (!policy) return null;
  try {
    const [period, limitStr] = policy.split(':');
    const limit = Number.parseInt(limitStr, 10);
    let windowSeconds: number;
    switch (period) {
      case 'minute':
      case 'minutely':
        windowSeconds = 60;
        break;
      case 'hour':
      case 'hourly':
        windowSeconds = 60 * 60;
        break;
      case 'day':
      case 'daily':
        windowSeconds = 60 * 60 * 24;
        break;
      default:
        logger.warn(`[RateLimiter] 未知的限流周期: ${period}`);
        return null;
    }
    return { window: windowSeconds, limit };
  } catch (error) {
    const err = error as Error;
    logger.error(`[RateLimiter] 解析限流策略失败: ${err.message}`, { policy });
    return null;
  }
}

export async function checkFeatureRateLimit(
  featureId: string,
  rateLimitPolicy: string | null | undefined,
  userId: string
): Promise<RateLimitResult | { allowed: true; remaining: number }> {
  if (!rateLimitPolicy) {
    return { allowed: true, remaining: Infinity };
  }
  const policy = parseRateLimitPolicy(rateLimitPolicy);
  if (!policy) {
    return { allowed: true, remaining: Infinity };
  }
  const key = `rate_limit:${userId}:${featureId}:${Math.floor(Date.now() / (policy.window * 1000))}`;
  try {
    const result = await checkRateLimit(key, policy.limit, policy.window);
    logger.info(
      `[RateLimiter] 限流检查 userId=${userId} featureId=${featureId} current=${result.current} limit=${policy.limit} allowed=${result.allowed}`
    );
    return result;
  } catch (error) {
    const err = error as Error;
    logger.error(`[RateLimiter] 限流检查失败: ${err.message}`, { userId, featureId, error });
    return { allowed: true, remaining: policy.limit };
  }
}

export default { parseRateLimitPolicy, checkFeatureRateLimit };
