import { getRedisClient } from '../config/redis.config';
import { CartResponse } from './cart.service';
import { logger } from '../utils/logger';

export class CartCacheService {
  private static readonly CART_TTL_SECONDS = 3600; // 1 hour cache expiration

  /**
   * Generates a namespaced cache key using the customer's authenticated user ID.
   */
  static getCacheKey(userId: string): string {
    return `cart:${userId}`;
  }

  /**
   * Retrieves cached cart response from Redis.
   * Returns null if cache miss, expired, or Redis unavailable.
   */
  static async get(userId: string): Promise<CartResponse | null> {
    try {
      const redis = getRedisClient();
      if (redis.status !== 'ready' && redis.status !== 'connect') {
        return null;
      }

      const key = this.getCacheKey(userId);
      const cached = await redis.get(key);
      if (!cached) {
        return null;
      }

      const parsed: CartResponse = JSON.parse(cached);
      // Re-hydrate date objects
      if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt);
      if (parsed.updatedAt) parsed.updatedAt = new Date(parsed.updatedAt);

      return parsed;
    } catch (error) {
      logger.warn(`Redis get error for user ${userId}; proceeding with MongoDB source of truth:`, error);
      return null;
    }
  }

  /**
   * Serializes and writes cart response to Redis with expiration TTL.
   * Non-blocking: failures will never corrupt persistent MongoDB state.
   */
  static async set(userId: string, cart: CartResponse): Promise<void> {
    try {
      const redis = getRedisClient();
      if (redis.status !== 'ready' && redis.status !== 'connect') {
        return;
      }

      const key = this.getCacheKey(userId);
      const serialized = JSON.stringify(cart);
      await redis.set(key, serialized, 'EX', this.CART_TTL_SECONDS);
    } catch (error) {
      logger.warn(`Redis set error for user ${userId}; continuing without cache:`, error);
    }
  }

  /**
   * Invalidates a specific customer's cart cache on modification.
   */
  static async delete(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      if (redis.status !== 'ready' && redis.status !== 'connect') {
        return;
      }

      const key = this.getCacheKey(userId);
      await redis.del(key);
    } catch (error) {
      logger.warn(`Redis delete error for user ${userId}:`, error);
    }
  }

  /**
   * Invalidates all cart caches (e.g., when merchant modifies product prices or stock in bulk).
   */
  static async invalidateAll(): Promise<void> {
    try {
      const redis = getRedisClient();
      if (redis.status !== 'ready' && redis.status !== 'connect') {
        return;
      }

      const keys = await redis.keys('cart:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.warn('Redis invalidateAll error:', error);
    }
  }
}

