import { Request, Response } from 'express';
import { HealthService } from '../services/health.service';
import { checkElasticsearchHealth } from '../config/elastic.config';
import { checkRedisHealth } from '../config/redis.config';
import { ApiResponse } from '../utils/apiResponse';

export class HealthController {
  static getHealth = async (_req: Request, res: Response): Promise<void> => {
    const healthData = await HealthService.getSystemHealth();
    ApiResponse.success(res, healthData, 'Server status retrieved successfully');
  };

  static getRedisHealth = async (_req: Request, res: Response): Promise<void> => {
    const health = await checkRedisHealth();
    ApiResponse.success(res, health, 'Redis cache health status retrieved');
  };

  static getElasticHealth = async (_req: Request, res: Response): Promise<void> => {
    const health = await checkElasticsearchHealth();
    ApiResponse.success(res, health, 'Elasticsearch health status retrieved');
  };
}

