import { Request, Response } from 'express';
import { HealthService } from '../services/health.service';
import { ApiResponse } from '../utils/apiResponse';

export class HealthController {
  static getHealth(_req: Request, res: Response) {
    const healthData = HealthService.getSystemHealth();
    return ApiResponse.success(res, healthData, 'Server status retrieved successfully');
  }
}

