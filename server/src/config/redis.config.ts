import Redis from 'ioredis';
import { env } from './env.config';
import { logger } from '../utils/logger';

export interface RedisHealthResult {
  status: 'connected' | 'disconnected';
  latencyMs: number;
  client: string;
  uptimeSeconds?: number;
}

let redisInstance: Redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) {
      return null; // Stop reconnecting after 3 attempts
    }
    return Math.min(times * 100, 1000);
  },
  lazyConnect: true,
  enableOfflineQueue: false,
});

export const getRedisClient = (): Redis => redisInstance;

/**
 * Setter to inject custom or mock Redis client during automated tests.
 */
export const setRedisClient = (client: Redis): void => {
  redisInstance = client;
};

// Export proxy for backwards-compatibility
export const redisClient = new Proxy({} as Redis, {
  get(_target, prop: string | symbol) {
    const instance = getRedisClient();
    const val = (instance as any)[prop];
    if (typeof val === 'function') {
      return val.bind(instance);
    }
    return val;
  },
});

export const connectRedis = async (): Promise<void> => {
  try {
    if (redisInstance.status === 'wait') {
      await redisInstance.connect();
      logger.info(`✅ Connected to Redis cache successfully [${env.REDIS_URL}]`);
    }
  } catch {
    logger.warn('⚠️ Unable to connect to Redis. Operating in standalone mode until Redis starts.');
  }
};

redisInstance.on('error', (err) => {
  if ((err as { code?: string }).code !== 'ECONNREFUSED') {
    logger.error('Redis client error:', err);
  }
});

redisInstance.on('reconnecting', () => {
  logger.info('Reconnecting to Redis...');
});

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisInstance.status === 'ready' || redisInstance.status === 'connecting') {
      await redisInstance.quit();
      logger.info('Redis connection cleanly terminated.');
    }
  } catch (error) {
    logger.error('Error disconnecting Redis:', error);
  }
};

/**
 * Comprehensive health check for Redis cache.
 */
export const checkRedisHealth = async (): Promise<RedisHealthResult> => {
  const start = Date.now();
  try {
    if (redisInstance.status === 'wait') {
      try {
        await redisInstance.connect();
      } catch {
        // Fallback
      }
    }

    if (redisInstance.status !== 'ready' && redisInstance.status !== 'connect') {
      return {
        status: 'disconnected',
        latencyMs: Date.now() - start,
        client: 'ioredis',
      };
    }

    const ping = await Promise.race([
      redisInstance.ping(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
    ]);

    const latencyMs = Date.now() - start;
    if (ping === 'PONG') {
      return {
        status: 'connected',
        latencyMs,
        client: 'ioredis',
      };
    }
    return {
      status: 'disconnected',
      latencyMs,
      client: 'ioredis',
    };
  } catch {
    return {
      status: 'disconnected',
      latencyMs: Date.now() - start,
      client: 'ioredis',
    };
  }
};
