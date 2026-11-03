import mongoose from 'mongoose';
import { env } from '../config/env.config';

export interface HealthStatus {
  status: 'healthy' | 'degraded';
  message: string;
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  version: string;
  database: {
    mongodb: 'connected' | 'disconnected' | 'connecting';
  };
  memoryUsageMB: {
    rss: string;
    heapUsed: string;
  };
}

export class HealthService {
  static getSystemHealth(): HealthStatus {
    const mongoReadyState = mongoose.connection.readyState;
    let mongoStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

    if (mongoReadyState === 1) {
      mongoStatus = 'connected';
    } else if (mongoReadyState === 2) {
      mongoStatus = 'connecting';
    }

    const memoryUsage = process.memoryUsage();

    return {
      status: 'healthy',
      message: 'Multi-Vendor Marketplace API is running smoothly',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: '1.0.0',
      database: {
        mongodb: mongoStatus,
      },
      memoryUsageMB: {
        rss: (memoryUsage.rss / 1024 / 1024).toFixed(2),
        heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
      },
    };
  }
}

