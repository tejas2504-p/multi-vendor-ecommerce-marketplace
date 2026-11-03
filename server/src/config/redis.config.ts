import Redis from 'ioredis';
import { env } from './env.config';
import { logger } from '../utils/logger';

export const redisClient = new Redis(env.REDIS_URL, {
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

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    logger.info('✅ Connected to Redis successfully.');
  } catch {
    logger.warn('⚠️ Unable to connect to Redis. Operating in standalone mode until Redis starts.');
  }
};

redisClient.on('error', (err) => {
  if ((err as { code?: string }).code !== 'ECONNREFUSED') {
    logger.error('Redis client error:', err);
  }
});

redisClient.on('reconnecting', () => {
  logger.info('Reconnecting to Redis...');
});

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
      await redisClient.quit();
      logger.info('Redis connection cleanly terminated.');
    }
  } catch (error) {
    logger.error('Error disconnecting Redis:', error);
  }
};

