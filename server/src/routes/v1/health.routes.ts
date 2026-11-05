import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisClient } from '../../config/redis.config';
import { getElasticsearchClient } from '../../config/elastic.config';
import { ApiResponse } from '../../utils/apiResponse';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = redisClient.status === 'ready' ? 'connected' : 'disconnected';

  let elasticsearchStatus = 'disconnected';
  try {
    const esPing = await Promise.race([
      getElasticsearchClient().ping(),
      new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
    ]);
    if (esPing) {
      elasticsearchStatus = 'connected';
    }
  } catch {
    elasticsearchStatus = 'disconnected';
  }

  const systemHealth = {
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      apiServer: 'healthy',
      mongodb: mongoStatus,
      redis: redisStatus,
      elasticsearch: elasticsearchStatus,
    },
    memoryUsageMB: {
      rss: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
      heapUsed: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
    },
  };

  return ApiResponse.success(res, systemHealth, 'Marketplace Core API is operational');
});

export const healthRoutes = router;
