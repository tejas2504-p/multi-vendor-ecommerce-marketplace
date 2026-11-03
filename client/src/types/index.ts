export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; path?: string; message: string; issue?: string }>;
  };
}

export interface HealthData {
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

export type MarketplaceRole = 'customer' | 'vendor' | 'admin';
