import { getRedisClient } from '../config/redis.config';
import { logger } from '../utils/logger';

export class AnalyticsCacheService {
  private static readonly DEFAULT_TTL_SECONDS = 300; // 5 minutes

  /**
   * Generates a deterministic namespaced cache key for an analytics query.
   */
  static getCacheKey(namespace: string, params: Record<string, any> = {}): string {
    const sortedKeys = Object.keys(params).sort();
    const queryPart = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
    return `analytics:${namespace}${queryPart ? `:${queryPart}` : ''}`;
  }

  /**
   * Retrieves cached analytics data from Redis.
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const redis = getRedisClient();
      if (redis.status !== 'ready' && redis.status !== 'connect') {
        return null;
      }

      const cached = await redis.get(key);
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as T;
    } catch (error) {
      logger.warn(`Redis get error for analytics key "${key}"; bypassing cache:`, error);
      return null;
    }
  }

  /**
   * Stores analytics data in Redis with TTL.
   */
  static async set(key: string, data: any, ttlSeconds: number = this.DEFAULT_TTL_SECONDS): Promise<void> {
    try {
      const redis = getRedisClient();
      if (redis.status !== 'ready' && redis.status !== 'connect') {
        return;
      }

      const serialized = JSON.stringify(data);
      await redis.setex(key, ttlSeconds, serialized);
    } catch (error) {
      logger.warn(`Redis set error for analytics key "${key}":`, error);
    }
  }

  /**
   * Flushes all analytics cache keys (e.g. after orders are placed, paid, or manual refresh).
   */
  static async invalidateAll(): Promise<void> {
    try {
      const redis = getRedisClient();
      if (redis.status !== 'ready' && redis.status !== 'connect') {
        return;
      }

      const keys = await redis.keys('analytics:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Invalidated ${keys.length} analytics cache keys`);
      }
    } catch (error) {
      logger.warn('Redis error during analytics cache invalidation:', error);
    }
  }
}

