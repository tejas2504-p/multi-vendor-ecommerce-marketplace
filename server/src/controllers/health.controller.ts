import { Request, Response } from 'express';
import { HealthService } from '../services/health.service';
import { checkElasticsearchHealth } from '../config/elastic.config';
import { ApiResponse } from '../utils/apiResponse';

export class HealthController {
  static getHealth(_req: Request, res: Response) {
    const healthData = HealthService.getSystemHealth();
    return ApiResponse.success(res, healthData, 'Server status retrieved successfully');
  }

  static getElasticHealth = async (_req: Request, res: Response): Promise<void> => {
    const health = await checkElasticsearchHealth();
    ApiResponse.success(res, health, 'Elasticsearch health status retrieved');
  };
}

